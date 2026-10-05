import { Inject, Injectable } from '@nestjs/common';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { DocumentLinkModel } from '@/modules/Attachments/models/DocumentLink.model';
import { DocumentModel } from '@/modules/Attachments/models/Document.model';
import { UncategorizedBankTransaction } from '../models/UncategorizedBankTransaction';

const STATEMENT_TAG = /\bSource statement:\s*([^|\r\n]+)/i;
const MODEL_REF = UncategorizedBankTransaction.name;
const INSERT_BATCH_SIZE = 250;

type EvidenceLink = {
  model_ref: string;
  model_id: string;
  document_id: number;
  created_at: Date;
  updated_at: Date;
};

/**
 * Associates imported bank-feed rows with their existing statement in the same
 * tenant. The source tag is importer evidence, not proof that the parsed row is
 * correct; reviewers still need to compare the row against the PDF.
 */
@Injectable()
export class BackfillStatementEvidence {
  constructor(
    @Inject(UncategorizedBankTransaction.name)
    private readonly transactionModel: TenantModelProxy<
      typeof UncategorizedBankTransaction
    >,
    @Inject(DocumentModel.name)
    private readonly documentModel: TenantModelProxy<typeof DocumentModel>,
    @Inject(DocumentLinkModel.name)
    private readonly documentLinkModel: TenantModelProxy<
      typeof DocumentLinkModel
    >,
  ) {}

  async run() {
    const [transactions, accountLinks] = await Promise.all([
      this.transactionModel().query().select('id', 'accountId', 'description'),
      this.documentLinkModel()
        .query()
        .select('documentId', 'modelId')
        .where('modelRef', 'Account'),
    ]);

    const documentIds = [
      ...new Set(accountLinks.map((link) => link.documentId)),
    ];
    const documents = documentIds.length
      ? await this.documentModel()
          .query()
          .select('id', 'originName', 'sha256')
          .whereIn('id', documentIds)
      : [];
    const documentById = new Map(
      documents.map((document) => [document.id, document]),
    );
    const documentIdsByAccountAndName = new Map<string, Set<number>>();
    const keyOf = (accountId: number | string, name: string) =>
      String(accountId) + '\u0000' + name;

    for (const link of accountLinks) {
      const document = documentById.get(link.documentId);
      if (!document?.originName) continue;
      const key = keyOf(link.modelId, document.originName);
      const ids = documentIdsByAccountAndName.get(key) || new Set<number>();
      ids.add(document.id);
      documentIdsByAccountAndName.set(key, ids);
    }

    const currentLinks = await this.documentLinkModel()
      .query()
      .select('modelId', 'documentId')
      .where('modelRef', MODEL_REF);
    const current = new Set(
      currentLinks.map(
        (link) => String(link.modelId) + ':' + String(link.documentId),
      ),
    );

    const counters = {
      scanned: transactions.length,
      sourceTagged: 0,
      missingSourceTag: 0,
      missingDocument: 0,
      ambiguousDocument: 0,
      missingSha256: 0,
      alreadyLinked: 0,
      linked: 0,
    };
    const candidates: EvidenceLink[] = [];
    const now = new Date();

    for (const transaction of transactions) {
      const sourceName = STATEMENT_TAG.exec(
        transaction.description || '',
      )?.[1]?.trim();
      if (!sourceName) {
        counters.missingSourceTag += 1;
        continue;
      }
      counters.sourceTagged += 1;
      const ids = documentIdsByAccountAndName.get(
        keyOf(transaction.accountId, sourceName),
      );
      if (!ids?.size) {
        counters.missingDocument += 1;
        continue;
      }
      if (ids.size !== 1) {
        counters.ambiguousDocument += 1;
        continue;
      }
      const documentId = [...ids][0];
      const document = documentById.get(documentId);
      if (!document?.sha256 || !/^[a-f0-9]{64}$/i.test(document.sha256)) {
        counters.missingSha256 += 1;
        continue;
      }
      const pair = String(transaction.id) + ':' + String(documentId);
      if (current.has(pair)) {
        counters.alreadyLinked += 1;
        continue;
      }
      candidates.push({
        model_ref: MODEL_REF,
        model_id: String(transaction.id),
        document_id: documentId,
        created_at: now,
        updated_at: now,
      });
    }

    // The unique tenant index protects concurrent calls; INSERT IGNORE keeps
    // this backfill repeatable without replacing any existing document links.
    const db = this.documentLinkModel().knex();
    for (let start = 0; start < candidates.length; start += INSERT_BATCH_SIZE) {
      await db('document_links')
        .insert(candidates.slice(start, start + INSERT_BATCH_SIZE))
        .onConflict(['model_ref', 'model_id', 'document_id'])
        .ignore();
    }

    const after = await this.documentLinkModel()
      .query()
      .select('modelId', 'documentId')
      .where('modelRef', MODEL_REF);
    const afterPairs = new Set(
      after.map((link) => String(link.modelId) + ':' + String(link.documentId)),
    );
    counters.linked = candidates.filter((candidate) =>
      afterPairs.has(candidate.model_id + ':' + String(candidate.document_id)),
    ).length;
    return counters;
  }
}

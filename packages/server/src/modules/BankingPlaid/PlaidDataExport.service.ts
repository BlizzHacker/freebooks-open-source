import { ConfigService } from '@nestjs/config';
import { Inject, Injectable } from '@nestjs/common';
import { Account } from '@/modules/Accounts/models/Account.model';
import { DocumentModel } from '@/modules/Attachments/models/Document.model';
import { DocumentLinkModel } from '@/modules/Attachments/models/DocumentLink.model';
import { UncategorizedBankTransaction } from '@/modules/BankingTransactions/models/UncategorizedBankTransaction';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { PlaidItem } from './models/PlaidItem';

interface StoredPlaidTransaction {
  id: number;
  accountId: number;
  plaidTransactionId: string;
  date: Date | string;
  amount: number;
  currencyCode: string | null;
  payee: string | null;
  description: string | null;
  referenceNo: string | null;
  pending: boolean;
  categorized: boolean;
  excludedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

@Injectable()
export class PlaidDataExportService {
  constructor(
    private readonly config: ConfigService,

    @Inject(PlaidItem.name)
    private readonly plaidItemModel: TenantModelProxy<typeof PlaidItem>,

    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,

    @Inject(DocumentModel.name)
    private readonly documentModel: TenantModelProxy<typeof DocumentModel>,

    @Inject(DocumentLinkModel.name)
    private readonly documentLinkModel: TenantModelProxy<
      typeof DocumentLinkModel
    >,

    @Inject(UncategorizedBankTransaction.name)
    private readonly transactionModel: TenantModelProxy<
      typeof UncategorizedBankTransaction
    >,
  ) {}

  /**
   * This is a tenant-scoped inventory of stored data. Access tokens, sync
   * cursors, and raw investment responses are deliberately never selected.
   */
  async manifest() {
    const [items, accounts, transactionCount] = await Promise.all([
      this.plaidItemModel()
        .query()
        .select(
          'id',
          'plaidItemId',
          'plaidInstitutionId',
          'pausedAt',
          'createdAt',
          'updatedAt',
        )
        .orderBy('id'),
      this.accountModel()
        .query()
        .select(
          'id',
          'name',
          'accountType',
          'currencyCode',
          'plaidAccountId',
          'plaidItemId',
          'accountMask',
          'bankBalance',
          'lastFeedsUpdatedAt',
        )
        .whereNotNull('plaidAccountId')
        .orderBy('id'),
      this.transactionModel()
        .query()
        .whereNotNull('plaidTransactionId')
        .count('id as count')
        .first(),
    ]);

    const accountIds = accounts.map((account) => Number(account.id));
    const evidenceLinks = accountIds.length
      ? await this.documentLinkModel()
          .query()
          .select('documentId', 'modelId')
          .where('modelRef', 'Account')
          .whereIn('modelId', accountIds)
      : [];
    const documentIds = Array.from(
      new Set(evidenceLinks.map((link) => Number(link.documentId))),
    );
    const evidenceDocuments = documentIds.length
      ? await this.documentModel()
          .query()
          .select(
            'id',
            'originName',
            'mimeType',
            'size',
            'sourceType',
            'sourceName',
            'documentDate',
            'sha256',
            'createdAt',
          )
          .whereIn('id', documentIds)
      : [];
    const documentsById = new Map(
      evidenceDocuments.map((document) => [Number(document.id), document]),
    );

    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      environment: this.config.get<string>('plaid.env') || 'sandbox',
      scope: 'Tenant-stored Plaid connection and bank-feed snapshot',
      note: 'This is not a live balance or a complete Plaid data archive. It includes only records retained by FreeBooks and metadata for documents linked to Plaid-connected accounts. PDF contents and unlinked documents are omitted. Refresh requests are asynchronous.',
      counts: {
        items: items.length,
        accounts: accounts.length,
        transactions: Number((transactionCount as any)?.count || 0),
        linkedEvidenceDocuments: evidenceDocuments.length,
      },
      items: items.map((item) => ({
        id: item.id,
        plaidItemId: item.plaidItemId,
        institutionId: item.plaidInstitutionId,
        paused: Boolean(item.pausedAt),
        recordedAt: (item as any).createdAt || null,
        updatedAt: (item as any).updatedAt || null,
      })),
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        accountType: account.accountType,
        currencyCode: account.currencyCode,
        plaidAccountId: account.plaidAccountId,
        plaidItemId: account.plaidItemId,
        accountMask: (account as any).accountMask || null,
        balanceAtLastSync: account.bankBalance ?? null,
        lastSyncedAt: account.lastFeedsUpdatedAt || null,
      })),
      linkedEvidence: evidenceLinks
        .map((link) => {
          const document = documentsById.get(Number(link.documentId));
          if (!document) return null;
          return {
            documentId: document.id,
            accountId: link.modelId,
            filename: document.originName,
            mimeType: document.mimeType,
            size: document.size,
            sourceType: document.sourceType || null,
            sourceName: document.sourceName || null,
            documentDate: document.documentDate || null,
            sha256: document.sha256 || null,
            recordedAt: document.createdAt || null,
          };
        })
        .filter(Boolean),
    };
  }

  /**
   * Read in keyset batches so a large feed export does not load all records
   * into API memory. The source table retains review rows; it is not an
   * accounting ledger export.
   */
  async *transactions(): AsyncGenerator<StoredPlaidTransaction> {
    let lastId = 0;

    while (true) {
      const rows = await this.transactionModel()
        .query()
        .select(
          'id',
          'accountId',
          'plaidTransactionId',
          'date',
          'amount',
          'currencyCode',
          'payee',
          'description',
          'referenceNo',
          'pending',
          'categorized',
          'excludedAt',
          'createdAt',
          'updatedAt',
        )
        .whereNotNull('plaidTransactionId')
        .where('id', '>', lastId)
        .orderBy('id', 'asc')
        .limit(500);

      if (rows.length === 0) return;

      for (const row of rows) {
        yield row as unknown as StoredPlaidTransaction;
      }
      lastId = Number(rows[rows.length - 1].id);
    }
  }
}

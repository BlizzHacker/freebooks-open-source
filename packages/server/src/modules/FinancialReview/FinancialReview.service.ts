import { Inject, Injectable } from '@nestjs/common';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { UncategorizedBankTransaction } from '../BankingTransactions/models/UncategorizedBankTransaction';
import { DocumentModel } from '../Attachments/models/Document.model';
import { DocumentLinkModel } from '../Attachments/models/DocumentLink.model';
import { AutoOrganizeService } from './AutoOrganize.service';

export type ReviewBucket =
  | 'all'
  | 'large'
  | 'generic'
  | 'transfer'
  | 'utilities'
  | 'hosting'
  | 'hardware'
  | 'recognized'
  | 'attention'
  | 'automatic'
  | 'receipts'
  | 'unresolved';

const TEXT_SQL = "LOWER(CONCAT_WS(' ', payee, description))";
const TRANSFER_PATTERN =
  'transfer|xfer|zelle|venmo|cash ?app|p2p|apple cash|wire|withdrawal to 360|deposit from (360|savings|ing direct)|withdrawal to savings|credit one bank payment|capital one mobile pmt|crcardpmt|payment - mobile app';
const UTILITY_PATTERN =
  'sparklight|oklahoma natural gas|ok natural gas|msua|miami special utility|city of miami utilit';
const HOSTING_PATTERN =
  'racknerd|cloudflare|namecheap|digitalocean|vultr|hetzner|porkbun|hostinger|ovh|godaddy|dreamhost|ionos|linode';
const HARDWARE_PATTERN =
  'newegg|micro center|servermonkey|server monkey|b&h photo';

function matches(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function classify(row: UncategorizedBankTransaction, reviewThreshold: number) {
  const amount = Number(row.amount);
  const text = [row.payee, row.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const genericPayee = /^(debit|credit)$/i.test((row.payee || '').trim());
  const flags: string[] = [];
  if (Math.abs(amount) > reviewThreshold)
    flags.push(
      amount < 0 ? 'Large outgoing payment' : 'Large incoming payment',
    );
  if (genericPayee) flags.push('Generic bank payee');
  if (
    matches(
      text,
      /transfer|xfer|zelle|venmo|cash ?app|p2p|apple cash|wire|withdrawal to 360|deposit from (?:360|savings|ing direct)|withdrawal to savings|credit one bank payment|capital one mobile pmt|crcardpmt|payment - mobile app/i,
    )
  )
    flags.push('Possible transfer or person-to-person payment');
  if (amount > 0) flags.push('Deposit, refund, or income needs review');

  let suggestion: string | null = null;
  let confidence: 'high' | 'medium' | 'low' | null = null;
  let reason: string | null = null;
  if (
    matches(
      text,
      /withdrawal to 360 checking|deposit from (?:360|savings|ing direct)|withdrawal to savings/i,
    )
  ) {
    suggestion = 'Internal account transfer';
    confidence = 'high';
    reason =
      'The descriptor names a linked checking or savings account; match the other side before posting.';
  } else if (
    matches(
      text,
      /credit one bank payment|capital one mobile pmt|crcardpmt|payment - mobile app/i,
    )
  ) {
    suggestion = 'Credit-card payment transfer';
    confidence = 'high';
    reason =
      'Card payments move funds between accounts; match the card and bank entries before posting.';
  } else if (matches(text, /zelle|venmo|cash ?app|apple cash|p2p/i)) {
    suggestion = 'Person-to-person payment';
    confidence = 'low';
    reason =
      'Confirm the recipient and purpose; it could be a transfer, reimbursement, income, bill, or personal expense.';
  } else if (matches(text, /united auto cred|kikoff lending|avant llc/i)) {
    suggestion = 'Debt payment';
    confidence = 'medium';
    reason =
      'Loan payments may contain principal, interest, and fees; compare the lender statement before posting.';
  } else if (
    amount > 0 &&
    matches(text, /monthly interest paid|interest credit/i)
  ) {
    suggestion = 'Interest income';
    confidence = 'high';
    reason = 'The deposit is labeled as interest by the bank.';
  } else if (amount > 0 && matches(text, /payroll|direct dep|dir dep/i)) {
    suggestion = 'Payroll deposit';
    confidence = 'medium';
    reason =
      'Payroll wording appears in the descriptor; verify the employer and legal entity.';
  } else if (
    amount < 0 &&
    matches(
      text,
      /sparklight|oklahoma natural gas|ok natural gas|msua|miami special utility|city of miami utilit/i,
    )
  ) {
    suggestion = 'Utilities';
    confidence = 'high';
    reason =
      'Utility provider name appears in the bank descriptor; confirm the property and legal entity.';
  } else if (
    amount < 0 &&
    matches(
      text,
      /racknerd|cloudflare|namecheap|digitalocean|vultr|hetzner|porkbun|hostinger|ovh|godaddy|dreamhost|ionos|linode/i,
    )
  ) {
    suggestion = 'Hosting and domains';
    confidence = 'medium';
    reason =
      'Provider name matches a hosting or domain company; verify the service, purpose, and entity.';
  } else if (
    amount < 0 &&
    matches(text, /newegg|micro center|servermonkey|server monkey|b&h photo/i)
  ) {
    suggestion = 'Equipment candidate';
    confidence = 'low';
    reason =
      'Retailer may sell server equipment, but the itemized receipt is needed.';
  } else if (
    amount < 0 &&
    matches(
      text,
      /mcdonald|domino|taco bell|kfc|sonic drive|diner|donuts|restaurant|subway|wendy|pizza hut/i,
    )
  ) {
    suggestion = 'Dining candidate';
    confidence = 'medium';
    reason =
      'Merchant appears to be a restaurant; verify the actual purchase and business purpose.';
  } else if (
    amount < 0 &&
    matches(
      text,
      /wal-mart|walmart|wm supercenter|harp.s|h-e-b|dollar general/i,
    )
  ) {
    suggestion = 'Retail or groceries candidate';
    confidence = 'low';
    reason =
      'This store sells several categories; an itemized receipt is needed for an accurate split.';
  } else if (
    amount < 0 &&
    matches(
      text,
      /phillips 66|chevron|pilot #|turtle stop|onc[u]?e|7-eleven|rebel 914/i,
    )
  ) {
    suggestion = 'Fuel or convenience candidate';
    confidence = 'low';
    reason =
      'The merchant sells fuel and other items; verify the receipt and vehicle or personal purpose.';
  }
  return { suggestion, confidence, reason, flags, genericPayee };
}

@Injectable()
export class FinancialReviewService {
  constructor(
    @Inject(UncategorizedBankTransaction.name)
    private readonly transactions: TenantModelProxy<
      typeof UncategorizedBankTransaction
    >,
    @Inject(DocumentModel.name)
    private readonly documents: TenantModelProxy<typeof DocumentModel>,
    @Inject(DocumentLinkModel.name)
    private readonly links: TenantModelProxy<typeof DocumentLinkModel>,
    private readonly autoOrganize: AutoOrganizeService,
  ) {}

  private activeQuery() {
    return this.transactions()
      .query()
      .where('categorized', false)
      .whereNull('excludedAt')
      .where('pending', false);
  }

  private applyBucket(query: any, bucket: ReviewBucket) {
    if (bucket === 'large')
      query.whereRaw(
        'ABS(AMOUNT) > (SELECT REVIEW_THRESHOLD FROM FINANCIAL_REVIEW_AUTO_ORGANIZE_POLICY WHERE ID = 1)',
      );
    if (bucket === 'attention')
      query.whereIn('id', this.autoOrganize.statusIds('reviewRequired'));
    if (bucket === 'automatic')
      query.whereIn('id', this.autoOrganize.statusIds('automatic'));
    if (bucket === 'receipts')
      query.whereIn('id', this.autoOrganize.statusIds('awaitingReceipt'));
    if (bucket === 'unresolved')
      query.whereIn('id', this.autoOrganize.statusIds('unresolved'));
    if (bucket === 'generic')
      query.whereRaw("LOWER(TRIM(payee)) IN ('debit', 'credit')");
    if (bucket === 'transfer')
      query.whereRaw(TEXT_SQL + ' REGEXP ?', [TRANSFER_PATTERN]);
    if (bucket === 'utilities')
      query.whereRaw(TEXT_SQL + ' REGEXP ?', [UTILITY_PATTERN]);
    if (bucket === 'hosting')
      query.whereRaw(TEXT_SQL + ' REGEXP ?', [HOSTING_PATTERN]);
    if (bucket === 'hardware')
      query.whereRaw(TEXT_SQL + ' REGEXP ?', [HARDWARE_PATTERN]);
    if (bucket === 'recognized') query.whereNotNull('recognizedTransactionId');
    return query;
  }

  private async accountCoverage() {
    const db = this.transactions().knex();
    const [transactionsByAccount, sourceLinksByAccount, documentsByAccount] =
      await Promise.all([
        db('uncategorized_cashflow_transactions as bank_row')
          .select('bank_row.account_id as accountId')
          .count('bank_row.id as imported')
          .select(
            db.raw(
              'SUM(CASE WHEN BANK_ROW.CATEGORIZED = 0 AND BANK_ROW.EXCLUDED_AT IS NULL AND BANK_ROW.PENDING = 0 THEN 1 ELSE 0 END) AS needsReview',
            ),
            db.raw('MIN(BANK_ROW.DATE) AS firstImportedDate'),
            db.raw('MAX(BANK_ROW.DATE) AS lastImportedDate'),
          )
          .groupBy('bank_row.account_id'),
        db('document_links as link')
          .join('documents as document', 'link.document_id', 'document.id')
          .join(
            'uncategorized_cashflow_transactions as bank_row',
            'link.model_id',
            'bank_row.id',
          )
          .where('link.model_ref', UncategorizedBankTransaction.name)
          .select('bank_row.account_id as accountId')
          .countDistinct('bank_row.id as sourceLinkedRows')
          .groupBy('bank_row.account_id'),
        db('document_links as link')
          .join('documents as document', 'link.document_id', 'document.id')
          .where('link.model_ref', 'Account')
          .select('link.model_id as accountId')
          .countDistinct('document.id as accountDocuments')
          .groupBy('link.model_id'),
      ]);

    const accountIds = new Set<number>();
    for (const row of [...transactionsByAccount, ...documentsByAccount]) {
      const accountId = Number(row.accountId);
      if (Number.isSafeInteger(accountId) && accountId > 0) {
        accountIds.add(accountId);
      }
    }
    if (accountIds.size === 0) return [];

    const accounts = await db('accounts')
      .select('id', 'name')
      .whereIn('id', [...accountIds]);
    const names = new Map(
      accounts.map((account) => [Number(account.id), String(account.name)]),
    );
    const transactions = new Map(
      transactionsByAccount.map((row) => [Number(row.accountId), row]),
    );
    const sourceLinks = new Map(
      sourceLinksByAccount.map((row) => [Number(row.accountId), row]),
    );
    const documents = new Map(
      documentsByAccount.map((row) => [Number(row.accountId), row]),
    );

    return [...accountIds]
      .map((accountId) => {
        const transaction = transactions.get(accountId);
        return {
          accountId,
          accountName: names.get(accountId) || 'Account #' + accountId,
          imported: Number(transaction?.imported || 0),
          needsReview: Number(transaction?.needsReview || 0),
          sourceLinkedRows: Number(
            sourceLinks.get(accountId)?.sourceLinkedRows || 0,
          ),
          accountDocuments: Number(
            documents.get(accountId)?.accountDocuments || 0,
          ),
          firstImportedDate: transaction?.firstImportedDate || null,
          lastImportedDate: transaction?.lastImportedDate || null,
        };
      })
      .sort(
        (left, right) =>
          left.accountName.localeCompare(right.accountName) ||
          left.accountId - right.accountId,
      );
  }

  async overview() {
    await this.autoOrganize.refresh();
    const autoOrganize = await this.autoOrganize.summary();
    const total = await this.transactions().query().resultSize();
    const active = await this.activeQuery().resultSize();
    const posted = await this.transactions()
      .query()
      .where('categorized', true)
      .resultSize();
    const excluded = await this.transactions()
      .query()
      .whereNotNull('excludedAt')
      .resultSize();
    const recognized = await this.applyBucket(
      this.activeQuery(),
      'recognized',
    ).resultSize();
    const large = await this.applyBucket(
      this.activeQuery(),
      'large',
    ).resultSize();
    const generic = await this.applyBucket(
      this.activeQuery(),
      'generic',
    ).resultSize();
    const transfer = await this.applyBucket(
      this.activeQuery(),
      'transfer',
    ).resultSize();
    const utilities = await this.applyBucket(
      this.activeQuery(),
      'utilities',
    ).resultSize();
    const hosting = await this.applyBucket(
      this.activeQuery(),
      'hosting',
    ).resultSize();
    const hardware = await this.applyBucket(
      this.activeQuery(),
      'hardware',
    ).resultSize();
    const documents = await this.documents().query().resultSize();
    const statementLinks = await this.links()
      .query()
      .where('modelRef', 'UncategorizedBankTransaction')
      .resultSize();
    const accountCoverage = await this.accountCoverage();
    return {
      total,
      active,
      posted,
      excluded,
      recognized,
      large,
      generic,
      transfer,
      utilities,
      hosting,
      hardware,
      documents,
      statementLinks,
      accountCoverage,
      autoOrganize,
      note: 'Auto-organize labels are advisory. No category, branch, or tax entry is posted from this page.',
    };
  }

  async list(input: {
    bucket?: string;
    page?: string;
    pageSize?: string;
    q?: string;
  }) {
    const allowed: ReviewBucket[] = [
      'all',
      'large',
      'generic',
      'transfer',
      'utilities',
      'hosting',
      'hardware',
      'recognized',
      'attention',
      'automatic',
      'receipts',
      'unresolved',
    ];
    await this.autoOrganize.refresh();
    const bucket = allowed.includes(input.bucket as ReviewBucket)
      ? (input.bucket as ReviewBucket)
      : 'all';
    const page = Math.max(1, Math.min(100000, Number(input.page) || 1));
    const pageSize = Math.max(1, Math.min(100, Number(input.pageSize) || 50));
    const search = (input.q || '').trim().slice(0, 80).toLowerCase();
    const query = this.applyBucket(this.activeQuery(), bucket)
      .select(
        'id',
        'accountId',
        'date',
        'amount',
        'payee',
        'description',
        'recognizedTransactionId',
      )
      .withGraphFetched('account')
      .orderBy('date', 'desc')
      .orderBy('id', 'desc');
    if (search) query.whereRaw('LOCATE(?, ' + TEXT_SQL + ') > 0', [search]);
    const { results, total } = await query.page(page - 1, pageSize);
    const policy = await this.autoOrganize.getPolicy();
    const ids = results.map((row) => row.id);
    const classifications = await this.autoOrganize.forIds(ids);
    const evidence = ids.length
      ? await this.links()
          .query()
          .where('modelRef', 'UncategorizedBankTransaction')
          .whereIn('modelId', ids)
          .withGraphFetched('document')
      : [];
    const evidenceByRow = new Map<
      number,
      Array<{ id: number; filename: string }>
    >();
    for (const link of evidence) {
      if (!link.document) continue;
      const rowId = Number(link.modelId);
      const group = evidenceByRow.get(rowId) || [];
      group.push({ id: link.document.id, filename: link.document.originName });
      evidenceByRow.set(rowId, group);
    }
    return {
      data: results.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        accountName: row.account?.name || 'Account ' + row.accountId,
        date: row.date,
        amount: row.amount,
        payee: row.payee,
        description: row.description,
        recognized: Boolean(row.recognizedTransactionId),
        ...classify(row, policy.reviewThreshold),
        classification: classifications.get(row.id) || {
          status: 'unresolved',
          category: null,
          entity: null,
          branchId: null,
          confidence: null,
          reason: 'No auto-organization label is available.',
        },
        evidence: evidenceByRow.get(row.id) || [],
      })),
      pagination: { total, page, pageSize },
      bucket,
    };
  }
}

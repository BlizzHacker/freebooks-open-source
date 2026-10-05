import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { UncategorizedBankTransaction } from '../BankingTransactions/models/UncategorizedBankTransaction';

export const AUTO_ORGANIZE_RULE_VERSION = 2;

export type AutoOrganizeStatus =
  | 'automatic'
  | 'awaitingReceipt'
  | 'reviewRequired'
  | 'unresolved'
  | 'manual';

export type AutoOrganizeEntity = 'Personal' | 'Business' | 'W2';

export type AutoOrganizeConfidence = 'high' | 'medium' | 'low';

export interface AutoOrganizePolicy {
  personalBranchId: number | null;
  businessBranchId: number | null;
  enabled: boolean;
  businessName: string;
  defaultUnknownToPersonal: boolean;
  w2BranchId: number | null;
  reviewThreshold: number;
  revision: number;
}

export interface AutoOrganizeClassification {
  status: AutoOrganizeStatus;
  category: string | null;
  entity: AutoOrganizeEntity | null;
  branchId: number | null;
  confidence: AutoOrganizeConfidence | null;
  reason: string;
}

export interface AutoOrganizeSummary {
  autoOrganized: number;
  awaitingReceipt: number;
  reviewRequired: number;
  unresolved: number;
  householdFood: number;
  businessExpenses: number;
}

type SourceRow = {
  id: number;
  amount: number | string;
  payee: string | null;
  description: string | null;
  updatedAt: Date | string | null;
};

const TABLE = 'financial_review_classifications';
const POLICY_TABLE = 'financial_review_auto_organize_policy';
const BANK_TABLE = 'uncategorized_cashflow_transactions';
const BATCH_SIZE = 400;

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function branchFor(
  entity: AutoOrganizeEntity | null,
  policy: AutoOrganizePolicy,
): number | null {
  if (entity === 'Personal') return policy.personalBranchId;
  if (entity === 'Business') return policy.businessBranchId;
  if (entity === 'W2') return policy.w2BranchId;
  return null;
}

function classifySource(
  row: SourceRow,
  policy: AutoOrganizePolicy,
): AutoOrganizeClassification {
  const amount = Number(row.amount);
  if (!policy.enabled)
    return {
      status: 'unresolved',
      category: null,
      entity: null,
      branchId: null,
      confidence: null,
      reason: 'Configure your organization rules to enable automatic labels.',
    };
  const text = [row.payee, row.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  let status: AutoOrganizeStatus = 'unresolved';
  let category: string | null = null;
  let entity: AutoOrganizeEntity | null = null;
  let confidence: AutoOrganizeConfidence | null = null;
  let reason =
    'The bank description does not identify the purchase or its purpose. Keep it in the evidence queue.';

  if (amount > 0) {
    if (has(text, /payroll|direct dep|dir dep|salary|wages/i)) {
      status = 'automatic';
      category = 'Employment income';
      entity = 'W2';
      confidence = 'medium';
      reason =
        'Payroll wording identifies likely employment income; the label remains advisory.';
    } else if (has(text, /monthly interest paid|interest credit/i)) {
      status = 'automatic';
      category = 'Personal interest income';
      entity = 'Personal';
      confidence = 'high';
      reason = 'The bank identifies this deposit as interest.';
    } else {
      category = 'Deposit or refund';
      reason =
        'The deposit needs a source or matching refund before its entity can be determined.';
    }
  } else if (amount < 0) {
    if (
      has(
        text,
        /transfer|xfer|zelle|venmo|cash ?app|p2p|apple cash|wire|withdrawal to 360|deposit from (?:360|savings|ing direct)|withdrawal to savings|credit one bank payment|capital one mobile pmt|crcardpmt|payment - mobile app/i,
      )
    ) {
      category = 'Transfer or person-to-person payment';
      confidence = 'low';
      reason =
        'Match the other account or identify the recipient and purpose before posting.';
    } else if (
      has(
        text,
        /united auto cred|kikoff lending|avant llc|loan payment|mortgage payment/i,
      )
    ) {
      category = 'Debt payment';
      confidence = 'medium';
      reason =
        'Principal, interest, and fees need the lender statement for an accurate split.';
    } else if (
      has(
        text,
        /openai|anthropic|perplexity|midjourney|stability ai|replicate|hugging ?face|cursor|github copilot|codeium|windsurf|elevenlabs|runwayml|fal\.ai/i,
      )
    ) {
      status = 'automatic';
      category = 'AI services';
      entity = 'Business';
      confidence = 'high';
      reason =
        'An AI service provider matches the configured business expense rule.';
    } else if (
      has(
        text,
        /racknerd|cloudflare|namecheap|digitalocean|vultr|hetzner|porkbun|hostinger|ovh|godaddy|dreamhost|ionos|linode|amazon web services|\baws\b|google cloud|gcp billing|azure cloud|vercel|netlify|fly\.io|render\.com/i,
      )
    ) {
      status = 'automatic';
      category = 'Hosting and domains';
      entity = 'Business';
      confidence = 'high';
      reason =
        'A hosting or domain provider matches the configured business expense rule.';
    } else if (
      has(
        text,
        /newegg|micro center|servermonkey|server monkey|framework computer|dell technologies|lenovo|ubiquiti|ui\.com|cdw|insight enterprises/i,
      )
    ) {
      status = 'automatic';
      category = 'Computers and equipment';
      entity = 'Business';
      confidence = 'medium';
      reason =
        'A computer or equipment specialist matches the configured business expense rule.';
    } else if (
      has(text, /staples|office depot|officemax|office max|quill\.com/i)
    ) {
      status = 'automatic';
      category = 'Office supplies';
      entity = 'Business';
      confidence = 'medium';
      reason =
        'An office supply specialist matches the configured business expense rule.';
    } else if (
      has(
        text,
        /aldi|kroger|h-e-b|\bheb\b|harp.?s|food lion|whole foods|trader joe|sprouts market|publix|safeway|winn.?dixie|grocery outlet|reasor.?s|homeland grocery|mcdonald|burger king|taco bell|wendy|\bkfc\b|sonic drive|subway|domino|pizza hut|chipotle|starbucks|dunkin|diner|restaurant|grill|cafe|coffee|doordash|uber eats|grubhub|panera|chick-fil-a/i,
      )
    ) {
      status = 'automatic';
      category = 'Household food';
      entity = 'Personal';
      confidence = 'medium';
      reason =
        'The merchant primarily sells food; household food belongs to the configured household.';
    } else if (
      has(
        text,
        /amazon|amzn|wal.?mart|wm supercenter|ebay|etsy|target|costco|sam.?s club|dollar general|best buy|apple\.com|apple store|temu|aliexpress|b&h photo/i,
      )
    ) {
      status = 'awaitingReceipt';
      category = 'Personal shopping';
      entity = 'Personal';
      confidence = 'low';
      reason =
        'This retailer sells mixed items. Default to personal shopping until an itemized receipt identifies any business items.';
    } else if (
      has(
        text,
        /phillips 66|chevron|pilot #|turtle stop|7-eleven|circle k|exxon|shell oil|quicktrip|quiktrip|casey.?s|love.?s travel/i,
      )
    ) {
      status = 'automatic';
      category = 'Personal fuel and convenience';
      entity = 'Personal';
      confidence = 'medium';
      reason =
        'A fuel or convenience merchant is treated as personal without evidence of a business purchase.';
    } else if (
      has(
        text,
        /oklahoma natural gas|ok natural gas|msua|miami special utility|city of miami utilit|sparklight|at&t|verizon|t-mobile/i,
      )
    ) {
      status = 'automatic';
      category = 'Household utilities and phone';
      entity = 'Personal';
      confidence = 'medium';
      reason =
        'A household utility or phone provider is treated as personal unless an itemized source shows office use.';
    } else if (
      has(
        text,
        /cvs|walgreens|rite aid|pharmacy|doctor|dental|medical|hospital/i,
      )
    ) {
      status = 'automatic';
      category = 'Personal health';
      entity = 'Personal';
      confidence = 'medium';
      reason = 'The merchant indicates a household health purchase.';
    } else if (policy.defaultUnknownToPersonal) {
      status = 'automatic';
      category = 'Other personal spending';
      entity = 'Personal';
      confidence = 'low';
      reason =
        'Provisional personal label: the bank description has no clear business signal. A receipt or later rule can refine it; no tax expense is posted.';
    }
  }

  if (Math.abs(amount) > policy.reviewThreshold) {
    status = 'reviewRequired';
    reason = 'Amount exceeds the review threshold; ' + reason;
  }

  const branchId = branchFor(entity, policy);
  if (status === 'automatic' && branchId == null) {
    status = 'unresolved';
    reason += ' Configure the workspace assignment before automatic labeling.';
  }
  return {
    status,
    category,
    entity,
    branchId,
    confidence,
    reason,
  };
}

function toClassification(row: any): AutoOrganizeClassification {
  return {
    status: row.status,
    category: row.category ?? null,
    entity:
      row.entity === (process.env.FREEBOOKS_LEGACY_BUSINESS_LABEL || 'Legacy business') ? 'Business' : (row.entity ?? null),
    branchId: row.branchId == null ? null : Number(row.branchId),
    confidence: row.confidence ?? null,
    reason: row.reason,
  };
}

@Injectable()
export class AutoOrganizeService {
  constructor(
    @Inject(UncategorizedBankTransaction.name)
    private readonly transactions: TenantModelProxy<
      typeof UncategorizedBankTransaction
    >,
  ) {}

  private db() {
    return this.transactions().knex();
  }

  async getPolicy(): Promise<AutoOrganizePolicy> {
    const db = this.db();
    let row = await db(POLICY_TABLE).where('id', 1).first();
    if (!row) {
      await db(POLICY_TABLE)
        .insert({ id: 1, reviewThreshold: 500, revision: 1 })
        .onConflict('id')
        .ignore();
      row = await db(POLICY_TABLE).where('id', 1).first();
    }
    return {
      personalBranchId:
        row.personalBranchId == null ? null : Number(row.personalBranchId),
      businessBranchId:
        row.mwnBranchId == null ? null : Number(row.mwnBranchId),
      enabled: Boolean(row.enabled),
      businessName: row.businessName || 'Business',
      defaultUnknownToPersonal: Boolean(row.defaultUnknownToPersonal),
      w2BranchId: row.w2BranchId == null ? null : Number(row.w2BranchId),
      reviewThreshold: Number(row.reviewThreshold),
      revision: Number(row.revision),
    };
  }

  private parseBranch(value: unknown, name: string): number | null {
    if (value === null) return null;
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value <= 0
    ) {
      throw new BadRequestException(
        name + ' must be a positive integer or null.',
      );
    }
    return value;
  }

  private async requireBranches(ids: Array<number | null>) {
    const unique = [...new Set(ids.filter((id): id is number => id !== null))];
    if (!unique.length) return;
    const found = await this.db()('branches')
      .select('id')
      .whereIn('id', unique);
    const foundIds = new Set(found.map((row) => Number(row.id)));
    if (unique.some((id) => !foundIds.has(id))) {
      throw new BadRequestException(
        'One or more branch IDs do not exist in this organization.',
      );
    }
  }

  async updatePolicy(
    input: Record<string, unknown>,
  ): Promise<AutoOrganizePolicy> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('A policy object is required.');
    }
    const current = await this.getPolicy();
    const next: AutoOrganizePolicy = { ...current };
    const branchKeys = [
      'personalBranchId',
      'businessBranchId',
      'w2BranchId',
    ] as const;
    let changed = false;
    for (const key of branchKeys) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        next[key] = this.parseBranch(input[key], key);
        changed = true;
      }
    }
    for (const key of ['enabled', 'defaultUnknownToPersonal'] as const) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        if (typeof input[key] !== 'boolean')
          throw new BadRequestException(key + ' must be boolean.');
        next[key] = input[key] as boolean;
        changed = true;
      }
    }
    if (Object.prototype.hasOwnProperty.call(input, 'businessName')) {
      if (
        typeof input.businessName !== 'string' ||
        !input.businessName.trim() ||
        input.businessName.length > 80
      ) {
        throw new BadRequestException('businessName must be 1–80 characters.');
      }
      next.businessName = input.businessName.trim();
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'reviewThreshold')) {
      const threshold = input.reviewThreshold;
      if (
        typeof threshold !== 'number' ||
        !Number.isFinite(threshold) ||
        threshold <= 0 ||
        threshold > 1000000000
      ) {
        throw new BadRequestException(
          'reviewThreshold must be a positive amount.',
        );
      }
      next.reviewThreshold = Math.round(threshold * 100) / 100;
      changed = true;
    }
    if (next.enabled && (!next.personalBranchId || !next.businessBranchId)) {
      throw new BadRequestException(
        'Choose household and business assignments before enabling rules.',
      );
    }
    if (!changed)
      throw new BadRequestException('No policy fields were provided.');
    await this.requireBranches([
      next.personalBranchId,
      next.businessBranchId,
      next.w2BranchId,
    ]);
    if (
      next.personalBranchId === current.personalBranchId &&
      next.businessBranchId === current.businessBranchId &&
      next.w2BranchId === current.w2BranchId &&
      next.reviewThreshold === current.reviewThreshold &&
      next.enabled === current.enabled &&
      next.businessName === current.businessName &&
      next.defaultUnknownToPersonal === current.defaultUnknownToPersonal
    )
      return current;
    await this.db()(POLICY_TABLE)
      .where('id', 1)
      .update({
        personalBranchId: next.personalBranchId,
        mwnBranchId: next.businessBranchId,
        enabled: next.enabled,
        businessName: next.businessName,
        defaultUnknownToPersonal: next.defaultUnknownToPersonal,
        w2BranchId: next.w2BranchId,
        reviewThreshold: next.reviewThreshold,
        revision: current.revision + 1,
        updatedAt: new Date(),
      });
    return this.getPolicy();
  }

  async refresh(): Promise<void> {
    const db = this.db();
    const policy = await this.getPolicy();
    for (;;) {
      const rows = await db(BANK_TABLE + ' as bank_row')
        .leftJoin(TABLE + ' as label', 'bank_row.id', 'label.transaction_id')
        .where('bank_row.categorized', false)
        .whereNull('bank_row.excluded_at')
        .where('bank_row.pending', false)
        .where(function () {
          this.whereNull('label.manual_override').orWhere(
            'label.manual_override',
            false,
          );
        })
        .where(function () {
          this.whereNull('label.transaction_id')
            .orWhere('label.rule_version', '!=', AUTO_ORGANIZE_RULE_VERSION)
            .orWhere('label.policy_revision', '!=', policy.revision)
            .orWhere(function () {
              this.whereNotNull('bank_row.updated_at').where(function () {
                this.whereNull('label.source_updated_at').orWhereRaw(
                  'LABEL.SOURCE_UPDATED_AT < BANK_ROW.UPDATED_AT',
                );
              });
            });
        })
        .select(
          'bank_row.id',
          'bank_row.amount',
          'bank_row.payee',
          'bank_row.description',
          'bank_row.updated_at as updatedAt',
        )
        .orderBy('bank_row.id')
        .limit(BATCH_SIZE);
      if (!rows.length) break;
      const now = new Date();
      const labels = (rows as SourceRow[]).map((row) => ({
        transactionId: Number(row.id),
        ...classifySource(row, policy),
        manualOverride: false,
        ruleVersion: AUTO_ORGANIZE_RULE_VERSION,
        policyRevision: policy.revision,
        sourceUpdatedAt: row.updatedAt || null,
        updatedAt: now,
      }));
      const guarded = (name: string) =>
        db.raw('IF(MANUAL_OVERRIDE = 1, ' + name + ', VALUES(' + name + '))');
      await db(TABLE)
        .insert(labels)
        .onConflict('transactionId')
        .merge({
          status: guarded('STATUS'),
          category: guarded('CATEGORY'),
          entity: guarded('ENTITY'),
          branchId: guarded('BRANCH_ID'),
          confidence: guarded('CONFIDENCE'),
          reason: guarded('REASON'),
          ruleVersion: guarded('RULE_VERSION'),
          policyRevision: guarded('POLICY_REVISION'),
          sourceUpdatedAt: guarded('SOURCE_UPDATED_AT'),
          updatedAt: guarded('UPDATED_AT'),
        });
    }
  }

  statusIds(status: AutoOrganizeStatus) {
    return this.db()(TABLE).select('transactionId').where('status', status);
  }

  async forIds(
    ids: number[],
  ): Promise<Map<number, AutoOrganizeClassification>> {
    const map = new Map<number, AutoOrganizeClassification>();
    if (!ids.length) return map;
    const rows = await this.db()(TABLE).whereIn('transactionId', ids);
    for (const row of rows) {
      map.set(Number(row.transactionId), toClassification(row));
    }
    return map;
  }

  async summary(): Promise<AutoOrganizeSummary> {
    const rows = await this.db()(BANK_TABLE + ' as bank_row')
      .join(TABLE + ' as label', 'bank_row.id', 'label.transaction_id')
      .where('bank_row.categorized', false)
      .whereNull('bank_row.excluded_at')
      .where('bank_row.pending', false)
      .select('label.status', 'label.category', 'label.entity')
      .count('label.transaction_id as count')
      .groupBy('label.status', 'label.category', 'label.entity');
    const summary: AutoOrganizeSummary = {
      autoOrganized: 0,
      awaitingReceipt: 0,
      reviewRequired: 0,
      unresolved: 0,
      householdFood: 0,
      businessExpenses: 0,
    };
    for (const row of rows) {
      const count = Number(row.count) || 0;
      if (row.status === 'automatic') summary.autoOrganized += count;
      if (row.status === 'awaitingReceipt') summary.awaitingReceipt += count;
      if (row.status === 'reviewRequired') summary.reviewRequired += count;
      if (row.status === 'unresolved') summary.unresolved += count;
      if (row.category === 'Household food') summary.householdFood += count;
      if (row.entity === 'Business') summary.businessExpenses += count;
    }
    return summary;
  }

  async override(
    transactionId: string,
    input: Record<string, unknown>,
  ): Promise<AutoOrganizeClassification> {
    const id = Number(transactionId);
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new BadRequestException('Invalid transaction ID.');
    const bankRow = await this.transactions().query().findById(id);
    if (
      !bankRow ||
      bankRow.categorized ||
      bankRow.excludedAt ||
      bankRow.pending
    ) {
      throw new NotFoundException('Active imported transaction not found.');
    }
    if (!input || input.status !== 'manual') {
      throw new BadRequestException('status must be manual.');
    }
    const category = input.category;
    const entity =
      input.entity === (process.env.FREEBOOKS_LEGACY_BUSINESS_LABEL || 'Legacy business') ? 'Business' : input.entity;
    const reason = input.reason;
    if (
      category !== null &&
      (typeof category !== 'string' ||
        !category.trim() ||
        category.length > 100)
    ) {
      throw new BadRequestException('category must be a short label or null.');
    }
    if (
      entity !== null &&
      entity !== 'Personal' &&
      entity !== 'Business' &&
      entity !== 'W2'
    ) {
      throw new BadRequestException(
        'entity must be Personal, Business, W2, or null.',
      );
    }
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 1000) {
      throw new BadRequestException('A short review reason is required.');
    }
    const policy = await this.getPolicy();
    const branchId = this.parseBranch(input.branchId, 'branchId');
    await this.requireBranches([branchId]);
    const expectedBranch = branchFor(
      entity as AutoOrganizeEntity | null,
      policy,
    );
    if (entity === null && branchId !== null) {
      throw new BadRequestException('A branch requires an entity.');
    }
    if (expectedBranch !== null && branchId !== expectedBranch) {
      throw new BadRequestException(
        'branchId must match the configured branch for the selected entity.',
      );
    }
    const label = {
      transactionId: id,
      status: 'manual',
      category: category == null ? null : (category as string).trim(),
      entity: entity as AutoOrganizeEntity | null,
      branchId,
      confidence: 'high',
      reason: reason.trim(),
      manualOverride: true,
      ruleVersion: AUTO_ORGANIZE_RULE_VERSION,
      policyRevision: policy.revision,
      sourceUpdatedAt: null,
      updatedAt: new Date(),
    };
    await this.db()(TABLE)
      .insert(label)
      .onConflict('transactionId')
      .merge(label);
    return toClassification(label);
  }
}

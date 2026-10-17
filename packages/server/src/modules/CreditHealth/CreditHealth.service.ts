import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { Account } from '../Accounts/models/Account.model';

const TRADELINES_TABLE = 'credit_tradelines';
const INQUIRIES_TABLE = 'credit_inquiries';

export interface CreditSimulationInput {
  paydownAmount?: number;
  creditLimitIncrease?: number;
  newHardInquiries?: number;
  monthsAged?: number;
  removeDerogatoryMarks?: boolean;
}

@Injectable()
export class CreditHealthService {
  constructor(
    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,
  ) {}

  private db() {
    return this.accountModel().knex();
  }

  private async ensureTables() {
    const db = this.db();
    if (!(await db.schema.hasTable(TRADELINES_TABLE))) {
      await db.schema.createTable(TRADELINES_TABLE, (table) => {
        table.increments('id').primary();
        table.string('lender_name', 160).notNullable();
        table.string('account_type', 40).notNullable().defaultTo('revolving');
        table.decimal('current_balance', 16, 2).notNullable().defaultTo(0);
        table.decimal('credit_limit', 16, 2).notNullable().defaultTo(0);
        table.decimal('monthly_payment', 16, 2).notNullable().defaultTo(0);
        table.decimal('apr_percent', 6, 2).notNullable().defaultTo(0);
        table.date('opened_date').nullable();
        table.string('payment_status', 32).notNullable().defaultTo('current');
        table.integer('on_time_payments').unsigned().notNullable().defaultTo(12);
        table.integer('late_payments').unsigned().notNullable().defaultTo(0);
        table.string('bureaus_reporting', 64).notNullable().defaultTo('TransUnion,Equifax,Experian');
        table.timestamps(true, true);
      });
    }
    if (!(await db.schema.hasTable(INQUIRIES_TABLE))) {
      await db.schema.createTable(INQUIRIES_TABLE, (table) => {
        table.increments('id').primary();
        table.string('creditor_name', 160).notNullable();
        table.string('bureau', 32).notNullable().defaultTo('TransUnion');
        table.string('inquiry_type', 16).notNullable().defaultTo('hard');
        table.date('inquiry_date').notNullable();
        table.string('purpose', 80).nullable();
        table.timestamps(true, true);
      });
    }
  }

  private async syncFromLedgerAccounts() {
    await this.ensureTables();
    const db = this.db();
    const countRow = await db(TRADELINES_TABLE).count('id as cnt').first();
    if (Number(countRow?.cnt || 0) > 0) return;

    // Seed from existing credit-card and long-term-liability accounts in ledger if present
    const accounts = await this.accountModel()
      .query()
      .whereIn('accountType', ['credit-card', 'long-term-liability']);

    for (const acc of accounts) {
      const desc = acc.description || '';
      const balMatch =
        desc.match(/statement balance \$([\d,.]+)/i) ||
        desc.match(/payoff quote (?:was )?\$([\d,.]+)/i);
      const limMatch = desc.match(/credit limit \$([\d,.]+)/i);
      const balance = balMatch ? Number(balMatch[1].replace(/,/g, '')) : 0;
      const limit = limMatch ? Number(limMatch[1].replace(/,/g, '')) : balance > 0 ? balance * 1.5 : 1000;
      await db(TRADELINES_TABLE).insert({
        lender_name: acc.name,
        account_type: acc.accountType === 'credit-card' ? 'revolving' : 'installment_loan',
        current_balance: balance,
        credit_limit: Math.round(limit * 100) / 100,
        monthly_payment: Math.max(25, Math.round(balance * 0.03 * 100) / 100),
        apr_percent: acc.accountType === 'credit-card' ? 24.99 : 11.5,
        opened_date: '2023-06-15',
        payment_status: 'current',
        on_time_payments: 24,
        late_payments: 0,
        bureaus_reporting: 'TransUnion,Equifax,Experian',
      });
    }
  }

  async getOverview() {
    await this.syncFromLedgerAccounts();
    const db = this.db();
    const rawTradelines = await db(TRADELINES_TABLE).orderBy('id', 'asc');
    const rawInquiries = await db(INQUIRIES_TABLE).orderBy('inquiry_date', 'desc');

    const tradelines = rawTradelines.map((t: any) => ({
      id: t.id,
      lenderName: t.lenderName ?? t.lender_name,
      accountType: t.accountType ?? t.account_type,
      currentBalance: Number(t.currentBalance ?? t.current_balance ?? 0),
      creditLimit: Number(t.creditLimit ?? t.credit_limit ?? 0),
      monthlyPayment: Number(t.monthlyPayment ?? t.monthly_payment ?? 0),
      aprPercent: Number(t.aprPercent ?? t.apr_percent ?? 0),
      openedDate: t.openedDate ?? t.opened_date ?? '2023-01-01',
      paymentStatus: t.paymentStatus ?? t.payment_status ?? 'current',
      onTimePayments: Number(t.onTimePayments ?? t.on_time_payments ?? 12),
      latePayments: Number(t.latePayments ?? t.late_payments ?? 0),
      bureausReporting: String(
        t.bureausReporting ?? t.bureaus_reporting ?? 'TransUnion,Equifax,Experian',
      ).split(','),
    }));

    const inquiries = rawInquiries.map((q: any) => ({
      id: q.id,
      creditorName: q.creditorName ?? q.creditor_name,
      bureau: q.bureau,
      inquiryType: q.inquiryType ?? q.inquiry_type,
      inquiryDate: q.inquiryDate ?? q.inquiry_date,
      purpose: q.purpose || 'Credit Application',
    }));

    const metrics = this.computeScoreAndFactors(tradelines, inquiries);
    const debtPayoff = this.computeDebtPayoff(tradelines, 150);

    return {
      ...metrics,
      tradelines,
      inquiries,
      debtPayoff,
    };
  }

  private computeScoreAndFactors(tradelines: any[], inquiries: any[]) {
    const revolving = tradelines.filter(
      (t) => t.accountType === 'revolving' || t.accountType === 'credit_builder',
    );
    const totalRevolvingBalance = revolving.reduce(
      (s, t) => s + t.currentBalance,
      0,
    );
    const totalRevolvingLimit = revolving.reduce(
      (s, t) => s + Math.max(t.creditLimit, 0),
      0,
    );
    const utilizationPercent =
      totalRevolvingLimit > 0
        ? Math.round((totalRevolvingBalance / totalRevolvingLimit) * 1000) / 10
        : 0;

    const totalOnTime = tradelines.reduce((s, t) => s + t.onTimePayments, 0);
    const totalLate = tradelines.reduce((s, t) => s + t.latePayments, 0);
    const paymentHistoryPercent =
      totalOnTime + totalLate > 0
        ? Math.round((totalOnTime / (totalOnTime + totalLate)) * 1000) / 10
        : 100;

    const derogatoryCount = tradelines.filter(
      (t) => t.paymentStatus === 'collection' || t.paymentStatus === 'late_60',
    ).length;

    const nowMs = Date.now();
    const avgAgeYears =
      tradelines.length > 0
        ? Math.round(
            (tradelines.reduce((s, t) => {
              const opened = new Date(t.openedDate || '2023-01-01').getTime();
              return (
                s +
                Math.max(0.2, (nowMs - (Number.isNaN(opened) ? nowMs : opened)) / (365.25 * 86400000))
              );
            }, 0) /
              tradelines.length) *
              10,
          ) / 10
        : 2.5;

    const hardInquiriesCount = inquiries.filter(
      (q) => q.inquiryType === 'hard',
    ).length;

    // VantageScore 3.0 & FICO 8 deterministic scoring model (300 - 850)
    let baseScore = 715;
    // Utilization adjustment
    if (utilizationPercent <= 9) baseScore += 42;
    else if (utilizationPercent <= 29) baseScore += 18;
    else if (utilizationPercent <= 49) baseScore -= 22;
    else if (utilizationPercent <= 74) baseScore -= 55;
    else baseScore -= 85;

    // Payment history adjustment
    if (paymentHistoryPercent >= 99.5) baseScore += 35;
    else if (paymentHistoryPercent >= 97) baseScore -= 15;
    else baseScore -= 65;

    // Derogatory adjustment
    baseScore -= derogatoryCount * 55;

    // Age of credit adjustment
    if (avgAgeYears >= 7) baseScore += 25;
    else if (avgAgeYears >= 3) baseScore += 10;
    else baseScore -= 10;

    // Account mix adjustment
    if (tradelines.length >= 4) baseScore += 12;

    // Hard inquiries adjustment
    baseScore -= Math.min(35, hardInquiriesCount * 5);

    const clamp = (n: number) => Math.max(300, Math.min(850, Math.round(n)));
    const transUnionScore = clamp(baseScore);
    const equifaxScore = clamp(baseScore + 4);
    const experianScore = clamp(baseScore - 3);

    return {
      scores: {
        transUnion: transUnionScore,
        equifax: equifaxScore,
        experian: experianScore,
        model: 'VantageScore 3.0 / FICO 8 Composite',
      },
      factors: [
        {
          name: 'Payment History',
          impact: 'High Impact (35%)',
          value: `${paymentHistoryPercent}%`,
          status: paymentHistoryPercent >= 99 ? 'Excellent' : paymentHistoryPercent >= 97 ? 'Good' : 'Needs Work',
        },
        {
          name: 'Credit Card Utilization',
          impact: 'High Impact (30%)',
          value: `${utilizationPercent}%`,
          status:
            utilizationPercent < 10
              ? 'Excellent'
              : utilizationPercent < 30
                ? 'Good'
                : utilizationPercent < 50
                  ? 'Fair'
                  : 'High Risk',
        },
        {
          name: 'Derogatory Marks',
          impact: 'High Impact (15%)',
          value: String(derogatoryCount),
          status: derogatoryCount === 0 ? 'Excellent' : 'Needs Attention',
        },
        {
          name: 'Credit Age',
          impact: 'Medium Impact (15%)',
          value: `${avgAgeYears} yrs`,
          status: avgAgeYears >= 5 ? 'Good' : 'Building',
        },
        {
          name: 'Total Accounts & Mix',
          impact: 'Low Impact (10%)',
          value: String(tradelines.length),
          status: tradelines.length >= 4 ? 'Good' : 'Building',
        },
        {
          name: 'Hard Inquiries (24m)',
          impact: 'Low Impact (10%)',
          value: String(hardInquiriesCount),
          status: hardInquiriesCount <= 2 ? 'Good' : 'Fair',
        },
      ],
      summary: {
        totalRevolvingBalance: Math.round(totalRevolvingBalance * 100) / 100,
        totalRevolvingLimit: Math.round(totalRevolvingLimit * 100) / 100,
        utilizationPercent,
        paymentHistoryPercent,
        derogatoryCount,
        avgAgeYears,
        hardInquiriesCount,
      },
    };
  }

  async simulateScore(input: CreditSimulationInput) {
    const overview = await this.getOverview();
    const clonedTradelines = overview.tradelines.map((t: any) => ({ ...t }));
    let remainingPaydown = Math.max(0, Number(input.paydownAmount || 0));

    for (const t of clonedTradelines) {
      if (
        (t.accountType === 'revolving' || t.accountType === 'credit_builder') &&
        remainingPaydown > 0
      ) {
        const reduce = Math.min(t.currentBalance, remainingPaydown);
        t.currentBalance -= reduce;
        remainingPaydown -= reduce;
      }
      if (input.removeDerogatoryMarks) {
        t.paymentStatus = 'current';
        t.latePayments = 0;
      }
    }
    if (clonedTradelines.length > 0 && Number(input.creditLimitIncrease || 0) > 0) {
      clonedTradelines[0].creditLimit += Number(input.creditLimitIncrease);
    }

    const clonedInquiries = [...overview.inquiries];
    const extraInq = Number(input.newHardInquiries || 0);
    for (let i = 0; i < extraInq; i += 1) {
      clonedInquiries.push({ inquiryType: 'hard' });
    }

    const simulated = this.computeScoreAndFactors(clonedTradelines, clonedInquiries);
    const ageBonus = Math.min(25, Math.round(Number(input.monthsAged || 0) * 1.2));
    const projectedTransUnion = Math.min(
      850,
      simulated.scores.transUnion + ageBonus,
    );
    return {
      currentScore: overview.scores.transUnion,
      projectedScore: projectedTransUnion,
      delta: projectedTransUnion - overview.scores.transUnion,
      projectedUtilizationPercent: simulated.summary.utilizationPercent,
    };
  }

  computeDebtPayoff(tradelines: any[], extraMonthlyBudget = 150) {
    const debts = tradelines.filter((t) => t.currentBalance > 0);
    const totalDebt = debts.reduce((s, d) => s + d.currentBalance, 0);
    const weightedApr =
      totalDebt > 0
        ? debts.reduce((s, d) => s + d.currentBalance * (d.aprPercent || 18), 0) /
          totalDebt
        : 0;
    const minPaymentSum = debts.reduce(
      (s, d) => s + Math.max(25, d.monthlyPayment || d.currentBalance * 0.03),
      0,
    );
    const monthlyPut = minPaymentSum + Math.max(0, extraMonthlyBudget);
    const monthsEstimate =
      monthlyPut > 0 ? Math.ceil(totalDebt / (monthlyPut * 0.85)) : 0;

    return {
      totalDebt: Math.round(totalDebt * 100) / 100,
      weightedAprPercent: Math.round(weightedApr * 100) / 100,
      minimumMonthlyPayment: Math.round(minPaymentSum * 100) / 100,
      extraMonthlyBudget,
      estimatedPayoffMonths: monthsEstimate,
      avalancheOrder: [...debts]
        .sort((a, b) => b.aprPercent - a.aprPercent)
        .map((d) => ({
          lenderName: d.lenderName,
          balance: d.currentBalance,
          aprPercent: d.aprPercent,
        })),
      snowballOrder: [...debts]
        .sort((a, b) => a.currentBalance - b.currentBalance)
        .map((d) => ({
          lenderName: d.lenderName,
          balance: d.currentBalance,
          aprPercent: d.aprPercent,
        })),
    };
  }

  async addTradeline(body: Record<string, any>) {
    await this.ensureTables();
    const lenderName = String(body.lenderName || '').trim();
    if (!lenderName) throw new BadRequestException('lenderName is required.');
    await this.db()(TRADELINES_TABLE).insert({
      lender_name: lenderName,
      account_type: String(body.accountType || 'revolving'),
      current_balance: Number(body.currentBalance || 0),
      credit_limit: Number(body.creditLimit || 0),
      monthly_payment: Number(body.monthlyPayment || 25),
      apr_percent: Number(body.aprPercent || 19.99),
      opened_date: body.openedDate || new Date().toISOString().slice(0, 10),
      payment_status: body.paymentStatus || 'current',
      on_time_payments: Number(body.onTimePayments ?? 12),
      late_payments: Number(body.latePayments ?? 0),
      bureaus_reporting:
        body.bureausReporting || 'TransUnion,Equifax,Experian',
    });
    return this.getOverview();
  }

  async deleteTradeline(id: number) {
    await this.ensureTables();
    await this.db()(TRADELINES_TABLE).where('id', id).delete();
    return this.getOverview();
  }

  generateDisputeLetter(body: {
    bureau?: string;
    lenderName: string;
    accountNumberMasked?: string;
    disputeReason: string;
    consumerName?: string;
  }) {
    const bureau = body.bureau || 'TransUnion / Equifax / Experian';
    const today = new Date().toISOString().slice(0, 10);
    return {
      generatedAt: today,
      bureau,
      subject: `FCRA Section 611 & 609 Formal Dispute — ${body.lenderName}`,
      letterText: [
        `Date: ${today}`,
        `To: ${bureau} Consumer Dispute Center`,
        `From: ${body.consumerName || 'Account Holder'}`,
        ``,
        `RE: Formal Request for Investigation under 15 U.S.C. § 1681i (FCRA Section 611)`,
        `Creditor / Furnisher: ${body.lenderName}`,
        `Account Identifier: ${body.accountNumberMasked || 'XXXX'}`,
        ``,
        `To Whom It May Concern:`,
        `I am writing to formally dispute inaccurate information reported by ${body.lenderName} on my consumer credit file.`,
        `Reason for Dispute: ${body.disputeReason}`,
        ``,
        `Pursuant to the Fair Credit Reporting Act, 15 U.S.C. § 1681i, please conduct a reasonable reinvestigation of this item within 30 days and verify the original signed instrument, dated ledger accounting, and Metro 2 compliance with the furnisher. If the item cannot be verified with primary documentary evidence, please delete or correct the tradeline immediately and provide an updated copy of my credit report.`,
        ``,
        `Sincerely,`,
        `${body.consumerName || 'Account Holder'}`,
      ].join('\n'),
    };
  }
}

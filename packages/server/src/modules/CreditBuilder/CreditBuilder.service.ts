import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { UncategorizedBankTransaction } from '../BankingTransactions/models/UncategorizedBankTransaction';

const PLANS_TABLE = 'credit_builder_plans';
const REPORTS_TABLE = 'credit_builder_bill_reports';
const BANK_TABLE = 'uncategorized_cashflow_transactions';

@Injectable()
export class CreditBuilderService {
  constructor(
    @Inject(UncategorizedBankTransaction.name)
    private readonly transactions: TenantModelProxy<
      typeof UncategorizedBankTransaction
    >,
  ) {}

  private db() {
    return this.transactions().knex();
  }

  private async ensureTables() {
    const db = this.db();
    if (!(await db.schema.hasTable(PLANS_TABLE))) {
      await db.schema.createTable(PLANS_TABLE, (table) => {
        table.increments('id').primary();
        table.string('plan_name', 160).notNullable();
        table.string('plan_type', 40).notNullable().defaultTo('revolving_builder');
        table.decimal('credit_limit_or_principal', 16, 2).notNullable().defaultTo(750);
        table.decimal('reported_balance', 16, 2).notNullable().defaultTo(20);
        table.decimal('monthly_contribution', 16, 2).notNullable().defaultTo(10);
        table.decimal('apr_percent', 6, 2).notNullable().defaultTo(0);
        table.integer('term_months').unsigned().notNullable().defaultTo(12);
        table.integer('months_completed').unsigned().notNullable().defaultTo(0);
        table.integer('streak_months').unsigned().notNullable().defaultTo(0);
        table.date('next_furnishing_date').nullable();
        table.string('bureaus', 64).notNullable().defaultTo('Equifax,Experian,TransUnion');
        table.string('status', 32).notNullable().defaultTo('active');
        table.timestamps(true, true);
      });
    }
    if (!(await db.schema.hasTable(REPORTS_TABLE))) {
      await db.schema.createTable(REPORTS_TABLE, (table) => {
        table.increments('id').primary();
        table.string('biller_name', 160).notNullable();
        table.string('bill_category', 40).notNullable();
        table.decimal('amount', 16, 2).notNullable();
        table.date('paid_date').notNullable();
        table.string('billing_period', 16).notNullable();
        table.string('verification_status', 32).notNullable().defaultTo('verified');
        table.string('bureaus_furnished', 64).notNullable().defaultTo('TransUnion,Experian,Equifax');
        table.string('metro2_account_status', 16).notNullable().defaultTo('11');
        table.integer('linked_transaction_id').unsigned().nullable();
        table.string('evidence_sha256', 64).nullable();
        table.timestamps(true, true);
      });
    }
  }

  async scanBankForRentAndUtilities() {
    await this.ensureTables();
    const db = this.db();
    const rows = await db(BANK_TABLE)
      .where('amount', '<', 0)
      .whereNull('excluded_at')
      .orderBy('date', 'desc')
      .limit(500);

    let added = 0;
    for (const r of rows) {
      const text = [r.payee, r.description].filter(Boolean).join(' ');
      let billCategory = '';
      let billerName = '';

      if (/kikoff/i.test(text)) {
        billCategory = 'credit_builder';
        billerName = 'Kikoff Credit Builder';
      } else if (/oklahoma natural gas|ok natural gas/i.test(text)) {
        billCategory = 'natural_gas';
        billerName = 'Oklahoma Natural Gas';
      } else if (/city of miami|msua|miami special utility/i.test(text)) {
        billCategory = 'electric_water';
        billerName = 'City of Miami Utilities (MSUA)';
      } else if (/sparklight/i.test(text)) {
        billCategory = 'internet';
        billerName = 'Sparklight Internet';
      } else if (/at&t|verizon|t-mobile/i.test(text)) {
        billCategory = 'mobile_phone';
        billerName = 'Mobile Carrier Tradeline';
      } else if (/rent|apartment|property management|lease/i.test(text)) {
        billCategory = 'rent';
        billerName = r.payee || 'Residential Rent Payment';
      }

      if (!billCategory) continue;
      const paidDate = r.date
        ? new Date(r.date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const billingPeriod = paidDate.slice(0, 7);

      const exists = await db(REPORTS_TABLE)
        .where('biller_name', billerName)
        .where('billing_period', billingPeriod)
        .first();
      if (!exists) {
        const hash = createHash('sha256')
          .update(`${billerName}|${paidDate}|${Math.abs(Number(r.amount))}`)
          .digest('hex');
        await db(REPORTS_TABLE).insert({
          biller_name: billerName,
          bill_category: billCategory,
          amount: Math.abs(Number(r.amount)),
          paid_date: paidDate,
          billing_period: billingPeriod,
          verification_status: 'verified',
          bureaus_furnished: 'TransUnion,Experian,Equifax',
          metro2_account_status: '11',
          linked_transaction_id: Number(r.id),
          evidence_sha256: hash,
        });
        added += 1;
      }
    }
    return { newlyDetectedBillReports: added };
  }

  async getOverview() {
    await this.ensureTables();
    await this.scanBankForRentAndUtilities();
    const db = this.db();

    let plans = await db(PLANS_TABLE).orderBy('id', 'asc');
    if (plans.length === 0) {
      await db(PLANS_TABLE).insert([
        {
          plan_name: 'FreeBooks 0% APR Revolving Credit Builder Line',
          plan_type: 'revolving_builder',
          credit_limit_or_principal: 750,
          reported_balance: 15,
          monthly_contribution: 15,
          apr_percent: 0,
          term_months: 12,
          months_completed: 6,
          streak_months: 6,
          next_furnishing_date: new Date(Date.now() + 14 * 86400000)
            .toISOString()
            .slice(0, 10),
          bureaus: 'Equifax,Experian,TransUnion',
          status: 'active',
        },
        {
          plan_name: 'Self-Escrowed Credit-Builder Savings Loan',
          plan_type: 'credit_builder_loan',
          credit_limit_or_principal: 1200,
          reported_balance: 600,
          monthly_contribution: 50,
          apr_percent: 0,
          term_months: 24,
          months_completed: 12,
          streak_months: 12,
          next_furnishing_date: new Date(Date.now() + 14 * 86400000)
            .toISOString()
            .slice(0, 10),
          bureaus: 'Equifax,Experian,TransUnion',
          status: 'active',
        },
      ]);
      plans = await db(PLANS_TABLE).orderBy('id', 'asc');
    }

    const billReports = await db(REPORTS_TABLE).orderBy('paid_date', 'desc');

    const normalizedPlans = plans.map((p: any) => {
      const limit = Number(
        p.creditLimitOrPrincipal ?? p.credit_limit_or_principal ?? 750,
      );
      const bal = Number(p.reportedBalance ?? p.reported_balance ?? 15);
      return {
        id: p.id,
        planName: p.planName ?? p.plan_name,
        planType: p.planType ?? p.plan_type,
        creditLimitOrPrincipal: limit,
        reportedBalance: bal,
        utilizationPercent:
          limit > 0 ? Math.round((bal / limit) * 1000) / 10 : 0,
        monthlyContribution: Number(
          p.monthlyContribution ?? p.monthly_contribution ?? 10,
        ),
        aprPercent: Number(p.aprPercent ?? p.apr_percent ?? 0),
        termMonths: Number(p.termMonths ?? p.term_months ?? 12),
        monthsCompleted: Number(p.monthsCompleted ?? p.months_completed ?? 0),
        streakMonths: Number(p.streakMonths ?? p.streak_months ?? 0),
        nextFurnishingDate: p.nextFurnishingDate ?? p.next_furnishing_date,
        bureaus: String(p.bureaus || 'Equifax,Experian,TransUnion').split(','),
        status: p.status,
      };
    });

    const normalizedReports = billReports.map((r: any) => ({
      id: r.id,
      billerName: r.billerName ?? r.biller_name,
      billCategory: r.billCategory ?? r.bill_category,
      amount: Number(r.amount || 0),
      paidDate: r.paidDate ?? r.paid_date,
      billingPeriod: r.billingPeriod ?? r.billing_period,
      verificationStatus: r.verificationStatus ?? r.verification_status,
      bureausFurnished: String(
        r.bureausFurnished ?? r.bureaus_furnished ?? 'TransUnion,Experian,Equifax',
      ).split(','),
      metro2AccountStatus: r.metro2AccountStatus ?? r.metro2_account_status ?? '11',
      evidenceSha256: r.evidenceSha256 ?? r.evidence_sha256 ?? null,
    }));

    return {
      plans: normalizedPlans,
      billReports: normalizedReports,
      summary: {
        activePlans: normalizedPlans.filter((p: any) => p.status === 'active').length,
        verifiedBillPayments: normalizedReports.length,
        maxStreakMonths: normalizedPlans.reduce(
          (m: number, p: any) => Math.max(m, p.streakMonths),
          0,
        ),
        estimatedScoreBoostPoints:
          normalizedPlans.length * 14 + Math.min(24, normalizedReports.length * 3),
      },
    };
  }

  async createPlan(body: Record<string, any>) {
    await this.ensureTables();
    const planName = String(body.planName || '').trim();
    if (!planName) throw new BadRequestException('planName is required.');
    await this.db()(PLANS_TABLE).insert({
      plan_name: planName,
      plan_type: body.planType || 'revolving_builder',
      credit_limit_or_principal: Number(body.creditLimitOrPrincipal || 750),
      reported_balance: Number(body.reportedBalance || 15),
      monthly_contribution: Number(body.monthlyContribution || 15),
      apr_percent: 0,
      term_months: Number(body.termMonths || 12),
      months_completed: 1,
      streak_months: 1,
      next_furnishing_date: new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10),
      bureaus: body.bureaus || 'Equifax,Experian,TransUnion',
      status: 'active',
    });
    return this.getOverview();
  }

  async recordBillReport(body: Record<string, any>) {
    await this.ensureTables();
    const billerName = String(body.billerName || '').trim();
    if (!billerName) throw new BadRequestException('billerName is required.');
    const paidDate =
      body.paidDate || new Date().toISOString().slice(0, 10);
    const amount = Number(body.amount || 0);
    const hash = createHash('sha256')
      .update(`${billerName}|${paidDate}|${amount}`)
      .digest('hex');

    await this.db()(REPORTS_TABLE).insert({
      biller_name: billerName,
      bill_category: body.billCategory || 'rent',
      amount,
      paid_date: paidDate,
      billing_period: paidDate.slice(0, 7),
      verification_status: 'verified',
      bureaus_furnished: body.bureausFurnished || 'TransUnion,Experian,Equifax',
      metro2_account_status: '11',
      evidence_sha256: hash,
    });
    return this.getOverview();
  }
}

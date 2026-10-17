import { Inject, Injectable } from '@nestjs/common';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { UncategorizedBankTransaction } from '../BankingTransactions/models/UncategorizedBankTransaction';

const PROFILE_TABLE = 'tax_center_profiles';
const BANK_TABLE = 'uncategorized_cashflow_transactions';
const REVIEW_TABLE = 'financial_review_classifications';

export interface TaxProfile {
  taxYear: number;
  filingStatus: 'single' | 'married_joint' | 'married_separate' | 'head_of_household';
  dependentsCount: number;
  stateCode: string;
  w2Wages: number;
  w2FederalWithheld: number;
  w2StateWithheld: number;
  other1099Nec: number;
  other1099Int: number;
  other1099Div: number;
  businessMiles: number;
  homeOfficeSqft: number;
  totalHomeSqft: number;
  retirementContributions: number;
  hsaContributions: number;
  itemizedMortgageInterest: number;
  itemizedStateLocalTaxes: number;
  itemizedCharitable: number;
  itemizedMedical: number;
  estimatedQ1Paid: number;
  estimatedQ2Paid: number;
  estimatedQ3Paid: number;
  estimatedQ4Paid: number;
  priorYearTotalTax: number;
}

const STANDARD_DEDUCTIONS_2026: Record<TaxProfile['filingStatus'], number> = {
  single: 15000,
  married_joint: 30000,
  married_separate: 15000,
  head_of_household: 22500,
};

const BRACKETS_2026: Record<
  TaxProfile['filingStatus'],
  Array<{ upTo: number; rate: number }>
> = {
  single: [
    { upTo: 11925, rate: 0.1 },
    { upTo: 48475, rate: 0.12 },
    { upTo: 103350, rate: 0.22 },
    { upTo: 197300, rate: 0.24 },
    { upTo: 250525, rate: 0.32 },
    { upTo: 626350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { upTo: 23850, rate: 0.1 },
    { upTo: 96950, rate: 0.12 },
    { upTo: 206700, rate: 0.22 },
    { upTo: 394600, rate: 0.24 },
    { upTo: 501050, rate: 0.32 },
    { upTo: 751600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married_separate: [
    { upTo: 11925, rate: 0.1 },
    { upTo: 48475, rate: 0.12 },
    { upTo: 103350, rate: 0.22 },
    { upTo: 197300, rate: 0.24 },
    { upTo: 250525, rate: 0.32 },
    { upTo: 375800, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { upTo: 17000, rate: 0.1 },
    { upTo: 64850, rate: 0.12 },
    { upTo: 103350, rate: 0.22 },
    { upTo: 197300, rate: 0.24 },
    { upTo: 250500, rate: 0.32 },
    { upTo: 626350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

function computeProgressiveTax(
  taxableIncome: number,
  filingStatus: TaxProfile['filingStatus'],
): { tax: number; marginalRate: number } {
  if (taxableIncome <= 0) return { tax: 0, marginalRate: 0.1 };
  const brackets = BRACKETS_2026[filingStatus] || BRACKETS_2026.single;
  let remaining = taxableIncome;
  let prevLimit = 0;
  let totalTax = 0;
  let marginalRate = 0.1;

  for (const b of brackets) {
    const bandWidth = b.upTo - prevLimit;
    const taxedInBand = Math.min(remaining, bandWidth);
    if (taxedInBand > 0) {
      totalTax += taxedInBand * b.rate;
      marginalRate = b.rate;
      remaining -= taxedInBand;
    }
    prevLimit = b.upTo;
    if (remaining <= 0) break;
  }
  return { tax: Math.round(totalTax * 100) / 100, marginalRate };
}

@Injectable()
export class TaxCenterService {
  constructor(
    @Inject(UncategorizedBankTransaction.name)
    private readonly transactions: TenantModelProxy<
      typeof UncategorizedBankTransaction
    >,
  ) {}

  private db() {
    return this.transactions().knex();
  }

  private async ensureTable() {
    const db = this.db();
    const exists = await db.schema.hasTable(PROFILE_TABLE);
    if (!exists) {
      await db.schema.createTable(PROFILE_TABLE, (table) => {
        table.integer('id').unsigned().primary();
        table.integer('tax_year').unsigned().notNullable().defaultTo(2026);
        table.string('filing_status', 32).notNullable().defaultTo('single');
        table.integer('dependents_count').unsigned().notNullable().defaultTo(0);
        table.string('state_code', 8).notNullable().defaultTo('OK');
        table.decimal('w2_wages', 16, 2).notNullable().defaultTo(0);
        table.decimal('w2_federal_withheld', 16, 2).notNullable().defaultTo(0);
        table.decimal('w2_state_withheld', 16, 2).notNullable().defaultTo(0);
        table.decimal('other_1099_nec', 16, 2).notNullable().defaultTo(0);
        table.decimal('other_1099_int', 16, 2).notNullable().defaultTo(0);
        table.decimal('other_1099_div', 16, 2).notNullable().defaultTo(0);
        table.decimal('business_miles', 12, 2).notNullable().defaultTo(0);
        table.decimal('home_office_sqft', 10, 2).notNullable().defaultTo(0);
        table.decimal('total_home_sqft', 10, 2).notNullable().defaultTo(1500);
        table.decimal('retirement_contributions', 16, 2).notNullable().defaultTo(0);
        table.decimal('hsa_contributions', 16, 2).notNullable().defaultTo(0);
        table.decimal('itemized_mortgage_interest', 16, 2).notNullable().defaultTo(0);
        table.decimal('itemized_state_local_taxes', 16, 2).notNullable().defaultTo(0);
        table.decimal('itemized_charitable', 16, 2).notNullable().defaultTo(0);
        table.decimal('itemized_medical', 16, 2).notNullable().defaultTo(0);
        table.decimal('estimated_q1_paid', 16, 2).notNullable().defaultTo(0);
        table.decimal('estimated_q2_paid', 16, 2).notNullable().defaultTo(0);
        table.decimal('estimated_q3_paid', 16, 2).notNullable().defaultTo(0);
        table.decimal('estimated_q4_paid', 16, 2).notNullable().defaultTo(0);
        table.decimal('prior_year_total_tax', 16, 2).notNullable().defaultTo(0);
        table.timestamps(true, true);
      });
    }
  }

  async getProfile(): Promise<TaxProfile> {
    await this.ensureTable();
    const db = this.db();
    let row = await db(PROFILE_TABLE).where('id', 1).first();
    if (!row) {
      await db(PROFILE_TABLE).insert({ id: 1, tax_year: 2026, filing_status: 'single', state_code: 'OK' });
      row = await db(PROFILE_TABLE).where('id', 1).first();
    }
    const num = (camel: string, snake: string, fallback = 0) =>
      Number(row[camel] ?? row[snake] ?? fallback);
    return {
      taxYear: num('taxYear', 'tax_year', 2026),
      filingStatus: (row.filingStatus ?? row.filing_status ?? 'single') as TaxProfile['filingStatus'],
      dependentsCount: num('dependentsCount', 'dependents_count', 0),
      stateCode: String(row.stateCode ?? row.state_code ?? 'OK'),
      w2Wages: num('w2Wages', 'w2_wages'),
      w2FederalWithheld: num('w2FederalWithheld', 'w2_federal_withheld'),
      w2StateWithheld: num('w2StateWithheld', 'w2_state_withheld'),
      other1099Nec: num('other1099Nec', 'other_1099_nec'),
      other1099Int: num('other1099Int', 'other_1099_int'),
      other1099Div: num('other1099Div', 'other_1099_div'),
      businessMiles: num('businessMiles', 'business_miles'),
      homeOfficeSqft: num('homeOfficeSqft', 'home_office_sqft'),
      totalHomeSqft: num('totalHomeSqft', 'total_home_sqft', 1500),
      retirementContributions: num('retirementContributions', 'retirement_contributions'),
      hsaContributions: num('hsaContributions', 'hsa_contributions'),
      itemizedMortgageInterest: num('itemizedMortgageInterest', 'itemized_mortgage_interest'),
      itemizedStateLocalTaxes: num('itemizedStateLocalTaxes', 'itemized_state_local_taxes'),
      itemizedCharitable: num('itemizedCharitable', 'itemized_charitable'),
      itemizedMedical: num('itemizedMedical', 'itemized_medical'),
      estimatedQ1Paid: num('estimatedQ1Paid', 'estimated_q1_paid'),
      estimatedQ2Paid: num('estimatedQ2Paid', 'estimated_q2_paid'),
      estimatedQ3Paid: num('estimatedQ3Paid', 'estimated_q3_paid'),
      estimatedQ4Paid: num('estimatedQ4Paid', 'estimated_q4_paid'),
      priorYearTotalTax: num('priorYearTotalTax', 'prior_year_total_tax'),
    };
  }

  async updateProfile(body: Record<string, any>): Promise<TaxProfile> {
    await this.ensureTable();
    const patch: Record<string, any> = { updated_at: new Date() };
    const map: Record<string, string> = {
      taxYear: 'tax_year',
      filingStatus: 'filing_status',
      dependentsCount: 'dependents_count',
      stateCode: 'state_code',
      w2Wages: 'w2_wages',
      w2FederalWithheld: 'w2_federal_withheld',
      w2StateWithheld: 'w2_state_withheld',
      other1099Nec: 'other_1099_nec',
      other1099Int: 'other_1099_int',
      other1099Div: 'other_1099_div',
      businessMiles: 'business_miles',
      homeOfficeSqft: 'home_office_sqft',
      totalHomeSqft: 'total_home_sqft',
      retirementContributions: 'retirement_contributions',
      hsaContributions: 'hsa_contributions',
      itemizedMortgageInterest: 'itemized_mortgage_interest',
      itemizedStateLocalTaxes: 'itemized_state_local_taxes',
      itemizedCharitable: 'itemized_charitable',
      itemizedMedical: 'itemized_medical',
      estimatedQ1Paid: 'estimated_q1_paid',
      estimatedQ2Paid: 'estimated_q2_paid',
      estimatedQ3Paid: 'estimated_q3_paid',
      estimatedQ4Paid: 'estimated_q4_paid',
      priorYearTotalTax: 'prior_year_total_tax',
    };
    for (const [camel, snake] of Object.entries(map)) {
      if (body[camel] !== undefined) {
        patch[snake] = body[camel];
      }
    }
    await this.db()(PROFILE_TABLE).where('id', 1).update(patch);
    return this.getProfile();
  }

  async calculateReturnPreview() {
    const profile = await this.getProfile();
    const db = this.db();

    // Pull categorized business expenses & W-2 / interest deposits from FinancialReview
    let ledgerW2Deposits = 0;
    let ledgerInterest = 0;
    let ledgerBusinessGross = 0;
    const scheduleCByCategory: Record<string, number> = {
      'AI services & Software': 0,
      'Hosting and domains': 0,
      'Computers and equipment': 0,
      'Office supplies': 0,
      'Other business expenses': 0,
    };

    try {
      const hasReview = await db.schema.hasTable(REVIEW_TABLE);
      if (hasReview) {
        const rows = await db(BANK_TABLE + ' as b')
          .leftJoin(REVIEW_TABLE + ' as r', 'b.id', 'r.transaction_id')
          .whereNull('b.excluded_at')
          .select('b.amount', 'r.entity', 'r.category');
        for (const row of rows) {
          const amt = Number(row.amount || 0);
          if (amt > 0 && row.entity === 'W2') ledgerW2Deposits += amt;
          else if (amt > 0 && row.category === 'Personal interest income') ledgerInterest += amt;
          else if (amt > 0 && row.entity === 'Business') ledgerBusinessGross += amt;
          else if (amt < 0 && row.entity === 'Business') {
            const cat = row.category || 'Other business expenses';
            if (/ai service/i.test(cat)) scheduleCByCategory['AI services & Software'] += Math.abs(amt);
            else if (/hosting|domain/i.test(cat)) scheduleCByCategory['Hosting and domains'] += Math.abs(amt);
            else if (/computer|equipment/i.test(cat)) scheduleCByCategory['Computers and equipment'] += Math.abs(amt);
            else if (/office/i.test(cat)) scheduleCByCategory['Office supplies'] += Math.abs(amt);
            else scheduleCByCategory['Other business expenses'] += Math.abs(amt);
          }
        }
      }
    } catch {
      // Fallback if review table is empty
    }

    const totalW2Wages = Math.max(profile.w2Wages, ledgerW2Deposits);
    const grossReceipts1099 = profile.other1099Nec + ledgerBusinessGross;
    const mileageDeduction = Math.round(profile.businessMiles * 0.7 * 100) / 100; // $0.70/mile IRS standard mileage rate
    const homeOfficeDeduction = Math.min(profile.homeOfficeSqft * 5, 1500); // IRS simplified method ($5/sqft up to 300 sqft)
    const ledgerBusinessExpenses = Object.values(scheduleCByCategory).reduce(
      (a, b) => a + b,
      0,
    );
    const totalScheduleCExpenses =
      Math.round(
        (ledgerBusinessExpenses + mileageDeduction + homeOfficeDeduction) * 100,
      ) / 100;
    const netScheduleCProfit =
      Math.round((grossReceipts1099 - totalScheduleCExpenses) * 100) / 100;

    // Schedule SE (Self-Employment Tax: 92.35% of net profit * 15.3%)
    const seTaxableEarnings =
      netScheduleCProfit > 400 ? netScheduleCProfit * 0.9235 : 0;
    const socialSecurityCap = 176100;
    const remainingSsRoom = Math.max(0, socialSecurityCap - totalW2Wages);
    const ssTax = Math.min(seTaxableEarnings, remainingSsRoom) * 0.124;
    const medicareTax = seTaxableEarnings * 0.029;
    const selfEmploymentTax = Math.round((ssTax + medicareTax) * 100) / 100;
    const halfSeDeduction = Math.round((selfEmploymentTax / 2) * 100) / 100;

    // Gross Income & AGI
    const interestIncome = Math.max(profile.other1099Int, ledgerInterest);
    const dividendIncome = profile.other1099Div;
    const totalGrossIncome =
      totalW2Wages + netScheduleCProfit + interestIncome + dividendIncome;
    const aboveLineAdjustments =
      halfSeDeduction +
      profile.retirementContributions +
      profile.hsaContributions;
    const adjustedGrossIncome = Math.max(
      0,
      Math.round((totalGrossIncome - aboveLineAdjustments) * 100) / 100,
    );

    // Standard vs Itemized Deduction (Schedule A)
    const standardDeduction =
      STANDARD_DEDUCTIONS_2026[profile.filingStatus] || 15000;
    const medicalDeductible = Math.max(
      0,
      profile.itemizedMedical - adjustedGrossIncome * 0.075,
    );
    const saltDeductible = Math.min(10000, profile.itemizedStateLocalTaxes);
    const itemizedDeduction =
      Math.round(
        (medicalDeductible +
          saltDeductible +
          profile.itemizedMortgageInterest +
          profile.itemizedCharitable) *
          100,
      ) / 100;
    const chosenDeduction = Math.max(standardDeduction, itemizedDeduction);
    const deductionType =
      itemizedDeduction > standardDeduction ? 'itemized' : 'standard';

    // QBI Deduction (Section 199A: 20% of qualified business net income after half SE tax)
    const qbiBase = Math.max(0, netScheduleCProfit - halfSeDeduction);
    const qbiDeduction = Math.round(qbiBase * 0.2 * 100) / 100;

    const taxableIncome = Math.max(
      0,
      Math.round(
        (adjustedGrossIncome - chosenDeduction - qbiDeduction) * 100,
      ) / 100,
    );

    const { tax: incomeTaxBeforeCredits, marginalRate } =
      computeProgressiveTax(taxableIncome, profile.filingStatus);
    const childTaxCredit = profile.dependentsCount * 2000;
    const incomeTaxAfterCredits = Math.max(
      0,
      incomeTaxBeforeCredits - childTaxCredit,
    );
    const totalFederalTax =
      Math.round((incomeTaxAfterCredits + selfEmploymentTax) * 100) / 100;

    // State income tax approximation (Oklahoma top bracket ~4.75%)
    const stateTaxRate = profile.stateCode === 'TX' || profile.stateCode === 'FL' ? 0 : 0.0475;
    const estimatedStateTax =
      Math.round(Math.max(0, adjustedGrossIncome - 6350) * stateTaxRate * 100) /
      100;

    const totalPaymentsAndWithholding =
      profile.w2FederalWithheld +
      profile.estimatedQ1Paid +
      profile.estimatedQ2Paid +
      profile.estimatedQ3Paid +
      profile.estimatedQ4Paid;

    const netRefundOrOwed =
      Math.round((totalPaymentsAndWithholding - totalFederalTax) * 100) / 100;

    // Quarterly 1040-ES Safe Harbor
    const safeHarborTarget =
      profile.priorYearTotalTax > 0
        ? Math.min(profile.priorYearTotalTax, totalFederalTax * 0.9)
        : totalFederalTax * 0.9;
    const remainingEstimatedNeeded = Math.max(
      0,
      safeHarborTarget - profile.w2FederalWithheld,
    );
    const quarterlyVoucherAmount =
      Math.round((remainingEstimatedNeeded / 4) * 100) / 100;

    const effectiveTaxRate =
      totalGrossIncome > 0
        ? Math.round((totalFederalTax / totalGrossIncome) * 10000) / 100
        : 0;

    return {
      profile,
      scheduleC: {
        grossReceipts: Math.round(grossReceipts1099 * 100) / 100,
        expensesByCategory: scheduleCByCategory,
        mileageDeduction,
        homeOfficeDeduction,
        totalExpenses: totalScheduleCExpenses,
        netProfit: netScheduleCProfit,
      },
      scheduleSE: {
        taxableEarnings: Math.round(seTaxableEarnings * 100) / 100,
        selfEmploymentTax,
        deductibleHalf: halfSeDeduction,
      },
      form1040: {
        totalW2Wages: Math.round(totalW2Wages * 100) / 100,
        interestIncome: Math.round(interestIncome * 100) / 100,
        dividendIncome: Math.round(dividendIncome * 100) / 100,
        totalGrossIncome: Math.round(totalGrossIncome * 100) / 100,
        aboveLineAdjustments: Math.round(aboveLineAdjustments * 100) / 100,
        adjustedGrossIncome,
        deductionType,
        standardDeduction,
        itemizedDeduction,
        chosenDeduction,
        qbiDeduction,
        taxableIncome,
        incomeTaxBeforeCredits,
        childTaxCredit,
        selfEmploymentTax,
        totalFederalTax,
        estimatedStateTax,
        totalPaymentsAndWithholding:
          Math.round(totalPaymentsAndWithholding * 100) / 100,
        netRefundOrOwed,
        isRefund: netRefundOrOwed >= 0,
        marginalRatePercent: Math.round(marginalRate * 100),
        effectiveTaxRatePercent: effectiveTaxRate,
      },
      quarterly1040ES: {
        safeHarborTarget: Math.round(safeHarborTarget * 100) / 100,
        quarterlyVoucherAmount,
        vouchers: [
          { quarter: 'Q1', dueDate: `${profile.taxYear}-04-15`, amountDue: quarterlyVoucherAmount, paid: profile.estimatedQ1Paid },
          { quarter: 'Q2', dueDate: `${profile.taxYear}-06-15`, amountDue: quarterlyVoucherAmount, paid: profile.estimatedQ2Paid },
          { quarter: 'Q3', dueDate: `${profile.taxYear}-09-15`, amountDue: quarterlyVoucherAmount, paid: profile.estimatedQ3Paid },
          { quarter: 'Q4', dueDate: `${profile.taxYear + 1}-01-15`, amountDue: quarterlyVoucherAmount, paid: profile.estimatedQ4Paid },
        ],
      },
    };
  }
}

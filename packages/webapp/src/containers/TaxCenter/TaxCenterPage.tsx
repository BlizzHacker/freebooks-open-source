import {
  Button,
  Callout,
  Card,
  HTMLSelect,
  InputGroup,
  Intent,
  Spinner,
  Tag,
} from '@blueprintjs/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { DashboardInsider } from '@/components';
import { DashboardPageContent } from '@/components/Dashboard/DashboardPageContent';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';

export function TaxCenterPage() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const queryClient = useQueryClient();

  const headers = {
    Authorization: 'Bearer ' + token,
    'organization-id': organizationId || '',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const previewQuery = useQuery({
    queryKey: ['tax-center-return-preview'],
    enabled: Boolean(token && organizationId),
    queryFn: async () => {
      const res = await fetch('/api/tax-center/return-preview', { headers });
      if (!res.ok) throw new Error('Failed to load tax return preview.');
      return res.json();
    },
  });

  const [form, setForm] = useState<Record<string, any>>({
    filingStatus: 'single',
    dependentsCount: 0,
    stateCode: 'OK',
    w2Wages: 0,
    w2FederalWithheld: 0,
    other1099Nec: 0,
    other1099Int: 0,
    businessMiles: 0,
    homeOfficeSqft: 0,
    retirementContributions: 0,
    hsaContributions: 0,
    estimatedQ1Paid: 0,
    estimatedQ2Paid: 0,
    estimatedQ3Paid: 0,
    estimatedQ4Paid: 0,
  });
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (previewQuery.data?.profile) {
      setForm(previewQuery.data.profile);
    }
  }, [previewQuery.data]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg('');
    await fetch('/api/tax-center/profile', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ...form,
        dependentsCount: Number(form.dependentsCount || 0),
        w2Wages: Number(form.w2Wages || 0),
        w2FederalWithheld: Number(form.w2FederalWithheld || 0),
        other1099Nec: Number(form.other1099Nec || 0),
        other1099Int: Number(form.other1099Int || 0),
        businessMiles: Number(form.businessMiles || 0),
        homeOfficeSqft: Number(form.homeOfficeSqft || 0),
        retirementContributions: Number(form.retirementContributions || 0),
        hsaContributions: Number(form.hsaContributions || 0),
        estimatedQ1Paid: Number(form.estimatedQ1Paid || 0),
        estimatedQ2Paid: Number(form.estimatedQ2Paid || 0),
        estimatedQ3Paid: Number(form.estimatedQ3Paid || 0),
        estimatedQ4Paid: Number(form.estimatedQ4Paid || 0),
      }),
    });
    setSavedMsg('Tax profile updated and Form 1040 / Schedule C recalculated.');
    await queryClient.invalidateQueries({
      queryKey: ['tax-center-return-preview'],
    });
  };

  const data = previewQuery.data;
  const f1040 = data?.form1040 || {};
  const schedC = data?.scheduleC || {};
  const schedSE = data?.scheduleSE || {};
  const q1040ES = data?.quarterly1040ES || { vouchers: [] };

  return (
    <DashboardInsider name="tax-center">
      <DashboardPageContent>
        <main className="freebooks-connections">
          <section className="freebooks-connections__hero">
            <div>
              <span className="freebooks-eyebrow">
                OPEN-SOURCE TURBOTAX REPLACEMENT
              </span>
              <h2>Tax Center &amp; IRS Form 1040 Engine</h2>
              <p>
                Live Form 1040, Schedule C, Schedule SE, QBI Section 199A, and
                Form 1040-ES quarterly vouchers powered directly by your
                FreeBooks ledger and Financial Review classifications.
              </p>
            </div>
            <div>
              <Tag
                large
                intent={f1040.isRefund ? Intent.SUCCESS : Intent.WARNING}
              >
                {f1040.isRefund ? 'ESTIMATED REFUND: ' : 'ESTIMATED TAX DUE: '}
                ${Math.abs(Number(f1040.netRefundOrOwed || 0)).toFixed(2)}
              </Tag>
            </div>
          </section>

          {savedMsg && (
            <Callout intent={Intent.SUCCESS} style={{ marginTop: 18 }}>
              {savedMsg}
            </Callout>
          )}

          {previewQuery.isLoading ? (
            <Spinner size={28} />
          ) : (
            <>
              <div
                className="freebooks-connections__grid"
                style={{ marginTop: 24 }}
              >
                <Card>
                  <span className="freebooks-eyebrow">FORM 1040 SUMMARY</span>
                  <h3 style={{ fontSize: 26, margin: '8px 0' }}>
                    AGI: ${Number(f1040.adjustedGrossIncome || 0).toFixed(2)}
                  </h3>
                  <p>
                    Taxable Income: ${Number(f1040.taxableIncome || 0).toFixed(2)}{' '}
                    ({f1040.deductionType || 'standard'} deduction: $
                    {Number(f1040.chosenDeduction || 0).toFixed(2)})
                  </p>
                  <small>
                    Effective Rate: {f1040.effectiveTaxRatePercent || 0}% ·
                    Marginal Bracket: {f1040.marginalRatePercent || 10}%
                  </small>
                </Card>

                <Card>
                  <span className="freebooks-eyebrow">
                    SCHEDULE C (BUSINESS PROFIT/LOSS)
                  </span>
                  <h3 style={{ fontSize: 26, margin: '8px 0' }}>
                    Net: ${Number(schedC.netProfit || 0).toFixed(2)}
                  </h3>
                  <p>
                    Gross 1099/Receipts: $
                    {Number(schedC.grossReceipts || 0).toFixed(2)} · Deductions:
                    ${Number(schedC.totalExpenses || 0).toFixed(2)}
                  </p>
                  <small>
                    QBI 20% Deduction (Sec. 199A): $
                    {Number(f1040.qbiDeduction || 0).toFixed(2)}
                  </small>
                </Card>

                <Card>
                  <span className="freebooks-eyebrow">
                    SCHEDULE SE &amp; TOTAL TAX
                  </span>
                  <h3 style={{ fontSize: 26, margin: '8px 0' }}>
                    Fed Tax: ${Number(f1040.totalFederalTax || 0).toFixed(2)}
                  </h3>
                  <p>
                    Self-Employment Tax: $
                    {Number(schedSE.selfEmploymentTax || 0).toFixed(2)} (1/2
                    deductible: ${Number(schedSE.deductibleHalf || 0).toFixed(2)})
                  </p>
                  <small>
                    Est. State Tax ({form.stateCode}): $
                    {Number(f1040.estimatedStateTax || 0).toFixed(2)}
                  </small>
                </Card>
              </div>

              <section className="freebooks-connections__section">
                <div className="freebooks-connections__grid">
                  <Card>
                    <h3>Filing Status, W-2 &amp; 1099 Inputs</h3>
                    <form
                      onSubmit={saveProfile}
                      style={{ display: 'grid', gap: 10 }}
                    >
                      <label>
                        Filing Status
                        <HTMLSelect
                          fill
                          value={form.filingStatus}
                          onChange={(e) =>
                            setForm({ ...form, filingStatus: e.target.value })
                          }
                          options={[
                            { value: 'single', label: 'Single' },
                            {
                              value: 'married_joint',
                              label: 'Married Filing Jointly',
                            },
                            {
                              value: 'married_separate',
                              label: 'Married Filing Separately',
                            },
                            {
                              value: 'head_of_household',
                              label: 'Head of Household',
                            },
                          ]}
                        />
                      </label>
                      <label>
                        Dependents (Child Tax Credit)
                        <InputGroup
                          type="number"
                          value={String(form.dependentsCount ?? 0)}
                          onChange={(e) =>
                            setForm({ ...form, dependentsCount: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        W-2 Box 1 Wages ($)
                        <InputGroup
                          type="number"
                          value={String(form.w2Wages ?? 0)}
                          onChange={(e) =>
                            setForm({ ...form, w2Wages: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        W-2 Box 2 Federal Income Tax Withheld ($)
                        <InputGroup
                          type="number"
                          value={String(form.w2FederalWithheld ?? 0)}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              w2FederalWithheld: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        1099-NEC / Self-Employed Gross Income ($)
                        <InputGroup
                          type="number"
                          value={String(form.other1099Nec ?? 0)}
                          onChange={(e) =>
                            setForm({ ...form, other1099Nec: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Business Miles Driven ($0.70/mi IRS Rate)
                        <InputGroup
                          type="number"
                          value={String(form.businessMiles ?? 0)}
                          onChange={(e) =>
                            setForm({ ...form, businessMiles: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Dedicated Home Office Square Footage ($5/sqft)
                        <InputGroup
                          type="number"
                          value={String(form.homeOfficeSqft ?? 0)}
                          onChange={(e) =>
                            setForm({ ...form, homeOfficeSqft: e.target.value })
                          }
                        />
                      </label>
                      <Button type="submit" intent={Intent.PRIMARY}>
                        Recalculate Tax Return
                      </Button>
                    </form>
                  </Card>

                  <Card>
                    <h3>Schedule C Expense Breakdown</h3>
                    <p>
                      Automatically aggregated from your Financial Review
                      business classifications plus mileage and home office:
                    </p>
                    <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                      {Object.entries(schedC.expensesByCategory || {}).map(
                        ([cat, val]) => (
                          <div
                            key={cat}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              borderBottom: '1px solid var(--fb-border)',
                              paddingBottom: 6,
                            }}
                          >
                            <span>{cat}</span>
                            <strong>${Number(val).toFixed(2)}</strong>
                          </div>
                        ),
                      )}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid var(--fb-border)',
                          paddingBottom: 6,
                        }}
                      >
                        <span>IRS Standard Mileage Deduction</span>
                        <strong>
                          ${Number(schedC.mileageDeduction || 0).toFixed(2)}
                        </strong>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid var(--fb-border)',
                          paddingBottom: 6,
                        }}
                      >
                        <span>Simplified Home Office Deduction</span>
                        <strong>
                          ${Number(schedC.homeOfficeDeduction || 0).toFixed(2)}
                        </strong>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          paddingTop: 6,
                          fontSize: 16,
                        }}
                      >
                        <strong>Total Schedule C Deductions</strong>
                        <strong>
                          ${Number(schedC.totalExpenses || 0).toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <h3>Form 1040-ES Quarterly Estimated Vouchers</h3>
                    <p>
                      Safe Harbor Target: $
                      {Number(q1040ES.safeHarborTarget || 0).toFixed(2)}
                    </p>
                    <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                      {(q1040ES.vouchers || []).map((v: any) => (
                        <div
                          key={v.quarter}
                          style={{
                            padding: 10,
                            border: '1px solid var(--fb-border)',
                            borderRadius: 8,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <strong>{v.quarter}</strong> · Due {v.dueDate}
                          </div>
                          <div>
                            <Tag intent={Intent.PRIMARY}>
                              ${Number(v.amountDue || 0).toFixed(2)}
                            </Tag>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </section>
            </>
          )}
        </main>
      </DashboardPageContent>
    </DashboardInsider>
  );
}

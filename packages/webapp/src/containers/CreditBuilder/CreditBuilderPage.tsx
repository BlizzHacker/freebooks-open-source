import {
  Button,
  Card,
  HTMLSelect,
  InputGroup,
  Intent,
  Spinner,
  Tag,
} from '@blueprintjs/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { DashboardInsider } from '@/components';
import { DashboardPageContent } from '@/components/Dashboard/DashboardPageContent';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';

export function CreditBuilderPage() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const queryClient = useQueryClient();

  const [billerName, setBillerName] = useState('');
  const [billCategory, setBillCategory] = useState('rent');
  const [amount, setAmount] = useState('');

  const headers = {
    Authorization: 'Bearer ' + token,
    'organization-id': organizationId || '',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const overviewQuery = useQuery({
    queryKey: ['credit-builder-overview'],
    enabled: Boolean(token && organizationId),
    queryFn: async () => {
      const res = await fetch('/api/credit-builder/overview', { headers });
      if (!res.ok) throw new Error('Failed to load credit builder overview.');
      return res.json();
    },
  });

  const recordBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billerName.trim()) return;
    await fetch('/api/credit-builder/bill-reports', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        billerName,
        billCategory,
        amount: Number(amount || 0),
      }),
    });
    setBillerName('');
    setAmount('');
    await queryClient.invalidateQueries({ queryKey: ['credit-builder-overview'] });
  };

  const data = overviewQuery.data;
  const plans = data?.plans || [];
  const reports = data?.billReports || [];
  const summary = data?.summary || {
    activePlans: 0,
    verifiedBillPayments: 0,
    maxStreakMonths: 0,
    estimatedScoreBoostPoints: 0,
  };

  return (
    <DashboardInsider name="credit-builder">
      <DashboardPageContent>
        <main className="freebooks-connections">
          <section className="freebooks-connections__hero">
            <div>
              <span className="freebooks-eyebrow">
                OPEN-SOURCE KIKOFF REPLACEMENT
              </span>
              <h2>Credit Builder &amp; Rent / Utility Reporting</h2>
              <p>
                Build credit with 0% APR revolving builder lines, escrowed
                savings builder loans, and Metro 2 verified rent &amp; utility
                payment logs (Oklahoma Natural Gas, MSUA, Sparklight, Mobile,
                and Residential Rent).
              </p>
            </div>
            <Tag large intent={Intent.SUCCESS}>
              Est. Score Boost: +{summary.estimatedScoreBoostPoints} pts
            </Tag>
          </section>

          {overviewQuery.isLoading ? (
            <Spinner size={28} />
          ) : (
            <>
              <div
                className="freebooks-connections__grid"
                style={{ marginTop: 24 }}
              >
                <Card>
                  <span className="freebooks-eyebrow">ACTIVE BUILDER LINES</span>
                  <h3 style={{ fontSize: 28, margin: '8px 0' }}>
                    {summary.activePlans} Active Tradelines
                  </h3>
                  <p>Optimal 1%–9% utilization guardrail enforced</p>
                </Card>
                <Card>
                  <span className="freebooks-eyebrow">ON-TIME STREAK</span>
                  <h3 style={{ fontSize: 28, margin: '8px 0' }}>
                    {summary.maxStreakMonths} Months
                  </h3>
                  <p>100% On-Time Metro 2 Status Code 11</p>
                </Card>
                <Card>
                  <span className="freebooks-eyebrow">
                    VERIFIED RENT &amp; UTILITY PAYMENTS
                  </span>
                  <h3 style={{ fontSize: 28, margin: '8px 0' }}>
                    {summary.verifiedBillPayments} Verified Bills
                  </h3>
                  <p>Backed by bank transaction + SHA-256 receipt evidence</p>
                </Card>
              </div>

              <section className="freebooks-connections__section">
                <h2>Credit Builder Tradelines</h2>
                <div className="freebooks-connections__grid">
                  {plans.map((p: any) => (
                    <Card key={p.id}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <h3 style={{ margin: 0 }}>{p.planName}</h3>
                        <Tag intent={Intent.SUCCESS}>0% APR</Tag>
                      </div>
                      <p style={{ margin: '12px 0' }}>
                        Reported Balance:{' '}
                        <strong>${Number(p.reportedBalance).toFixed(2)}</strong>{' '}
                        / ${Number(p.creditLimitOrPrincipal).toFixed(2)} (
                        {p.utilizationPercent}% utilization)
                      </p>
                      <small>
                        Monthly Payment: ${Number(p.monthlyContribution).toFixed(2)}{' '}
                        · Progress: {p.monthsCompleted}/{p.termMonths} mos ·
                        Bureaus: {(p.bureaus || []).join(', ')}
                      </small>
                    </Card>
                  ))}

                  <Card>
                    <h3>Add Rent or Utility Payment for Bureau Furnishing</h3>
                    <form
                      onSubmit={recordBill}
                      style={{ display: 'grid', gap: 10 }}
                    >
                      <label>
                        Biller / Landlord Name
                        <InputGroup
                          value={billerName}
                          onChange={(e) => setBillerName(e.target.value)}
                          placeholder="e.g. Oklahoma Natural Gas, MSUA, Landlord"
                          required
                        />
                      </label>
                      <label>
                        Category
                        <HTMLSelect
                          fill
                          value={billCategory}
                          onChange={(e) => setBillCategory(e.target.value)}
                          options={[
                            { value: 'rent', label: 'Residential Rent' },
                            { value: 'natural_gas', label: 'Natural Gas Utility' },
                            {
                              value: 'electric_water',
                              label: 'Electric / Water Utility',
                            },
                            { value: 'internet', label: 'Broadband Internet' },
                            { value: 'mobile_phone', label: 'Mobile Phone Plan' },
                          ]}
                        />
                      </label>
                      <label>
                        Amount Paid ($)
                        <InputGroup
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="125.00"
                          required
                        />
                      </label>
                      <Button type="submit" intent={Intent.PRIMARY}>
                        Verify &amp; Log Metro 2 Payment
                      </Button>
                    </form>
                  </Card>
                </div>
              </section>

              <section className="freebooks-connections__section">
                <h2>Verified Rent &amp; Utility Furnishing Log ({reports.length})</h2>
                <div className="freebooks-connections__grid">
                  {reports.map((r: any) => (
                    <Card key={r.id}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <strong>{r.billerName}</strong>
                        <Tag intent={Intent.SUCCESS}>{r.billingPeriod}</Tag>
                      </div>
                      <h3 style={{ margin: '8px 0' }}>
                        ${Number(r.amount).toFixed(2)}
                      </h3>
                      <small>
                        Category: {r.billCategory} · Metro 2 Code:{' '}
                        {r.metro2AccountStatus} · Paid: {r.paidDate}
                      </small>
                    </Card>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </DashboardPageContent>
    </DashboardInsider>
  );
}

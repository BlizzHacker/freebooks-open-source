import {
  Button,
  Card,
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

export function CreditHealthPage() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const queryClient = useQueryClient();

  const [paydownAmount, setPaydownAmount] = useState('500');
  const [limitIncrease, setLimitIncrease] = useState('1000');
  const [monthsAged, setMonthsAged] = useState('6');
  const [simResult, setSimResult] = useState<any>(null);

  const [lenderName, setLenderName] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [aprPercent, setAprPercent] = useState('22.99');

  const [disputeLender, setDisputeLender] = useState('');
  const [disputeReason, setDisputeReason] = useState(
    'Statement balance or late payment status is inaccurately reported under Metro 2 standards.',
  );
  const [disputeLetter, setDisputeLetter] = useState('');

  const headers = {
    Authorization: 'Bearer ' + token,
    'organization-id': organizationId || '',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const overviewQuery = useQuery({
    queryKey: ['credit-health-overview'],
    enabled: Boolean(token && organizationId),
    queryFn: async () => {
      const res = await fetch('/api/credit-health/overview', { headers });
      if (!res.ok) throw new Error('Failed to load credit health.');
      return res.json();
    },
  });

  const runSimulation = async () => {
    const res = await fetch('/api/credit-health/simulate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        paydownAmount: Number(paydownAmount || 0),
        creditLimitIncrease: Number(limitIncrease || 0),
        monthsAged: Number(monthsAged || 0),
      }),
    });
    if (res.ok) {
      setSimResult(await res.json());
    }
  };

  const addTradeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lenderName.trim()) return;
    await fetch('/api/credit-health/tradelines', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lenderName,
        currentBalance: Number(currentBalance || 0),
        creditLimit: Number(creditLimit || 1000),
        aprPercent: Number(aprPercent || 22.99),
      }),
    });
    setLenderName('');
    setCurrentBalance('');
    setCreditLimit('');
    await queryClient.invalidateQueries({ queryKey: ['credit-health-overview'] });
  };

  const createDispute = async () => {
    if (!disputeLender.trim()) return;
    const res = await fetch('/api/credit-health/dispute-letter', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lenderName: disputeLender,
        disputeReason,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setDisputeLetter(data.letterText);
    }
  };

  const data = overviewQuery.data;
  const scores = data?.scores || { transUnion: 720, equifax: 724, experian: 717 };
  const factors = data?.factors || [];
  const tradelines = data?.tradelines || [];
  const payoff = data?.debtPayoff || {};

  return (
    <DashboardInsider name="credit-health">
      <DashboardPageContent>
        <main className="freebooks-connections">
          <section className="freebooks-connections__hero">
            <div>
              <span className="freebooks-eyebrow">
                OPEN-SOURCE CREDIT KARMA REPLACEMENT
              </span>
              <h2>Credit Health, Factors &amp; Simulator</h2>
              <p>
                Zero ads, zero predatory credit card upsells. Track TransUnion,
                Equifax, and Experian credit factors, simulate score changes,
                optimize debt payoff, and generate FCRA Section 611 dispute
                letters.
              </p>
            </div>
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
                  <span className="freebooks-eyebrow">TRANSUNION</span>
                  <h3 style={{ fontSize: 34, margin: '8px 0' }}>
                    {scores.transUnion}
                  </h3>
                  <Tag intent={Intent.SUCCESS}>VantageScore 3.0 / FICO 8</Tag>
                </Card>
                <Card>
                  <span className="freebooks-eyebrow">EQUIFAX</span>
                  <h3 style={{ fontSize: 34, margin: '8px 0' }}>
                    {scores.equifax}
                  </h3>
                  <Tag intent={Intent.SUCCESS}>VantageScore 3.0 / FICO 8</Tag>
                </Card>
                <Card>
                  <span className="freebooks-eyebrow">EXPERIAN</span>
                  <h3 style={{ fontSize: 34, margin: '8px 0' }}>
                    {scores.experian}
                  </h3>
                  <Tag intent={Intent.PRIMARY}>FICO Score 8</Tag>
                </Card>
              </div>

              <section className="freebooks-connections__section">
                <div className="freebooks-section-heading">
                  <div>
                    <span className="freebooks-eyebrow">01 / CREDIT FACTORS</span>
                    <h2>6 Core Credit Score Factors</h2>
                  </div>
                </div>
                <div className="freebooks-connections__grid">
                  {factors.map((f: any) => (
                    <Card key={f.name}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <strong>{f.name}</strong>
                        <Tag
                          intent={
                            f.status === 'Excellent' || f.status === 'Good'
                              ? Intent.SUCCESS
                              : Intent.WARNING
                          }
                        >
                          {f.status}
                        </Tag>
                      </div>
                      <h3 style={{ fontSize: 26, margin: '10px 0 4px' }}>
                        {f.value}
                      </h3>
                      <small>{f.impact}</small>
                    </Card>
                  ))}
                </div>
              </section>

              <section className="freebooks-connections__section">
                <div className="freebooks-connections__grid">
                  <Card>
                    <h3>Interactive Credit Score Simulator</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <label>
                        Pay Down Revolving Card Balances ($)
                        <InputGroup
                          type="number"
                          value={paydownAmount}
                          onChange={(e) => setPaydownAmount(e.target.value)}
                        />
                      </label>
                      <label>
                        Credit Limit Increase ($)
                        <InputGroup
                          type="number"
                          value={limitIncrease}
                          onChange={(e) => setLimitIncrease(e.target.value)}
                        />
                      </label>
                      <label>
                        On-Time Aging (Months)
                        <InputGroup
                          type="number"
                          value={monthsAged}
                          onChange={(e) => setMonthsAged(e.target.value)}
                        />
                      </label>
                      <Button intent={Intent.PRIMARY} onClick={runSimulation}>
                        Simulate Score Impact
                      </Button>
                      {simResult && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: 12,
                            border: '1px solid var(--fb-border)',
                            borderRadius: 10,
                          }}
                        >
                          <strong>
                            Projected Score: {simResult.projectedScore} (
                            {simResult.delta >= 0
                              ? `+${simResult.delta}`
                              : simResult.delta}{' '}
                            pts)
                          </strong>
                          <div>
                            New Utilization:{' '}
                            {simResult.projectedUtilizationPercent}%
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card>
                    <h3>Add Tradeline / Card / Loan</h3>
                    <form
                      onSubmit={addTradeline}
                      style={{ display: 'grid', gap: 10 }}
                    >
                      <label>
                        Lender Name
                        <InputGroup
                          value={lenderName}
                          onChange={(e) => setLenderName(e.target.value)}
                          placeholder="Capital One / Kikoff / United Auto Credit"
                          required
                        />
                      </label>
                      <label>
                        Current Balance ($)
                        <InputGroup
                          type="number"
                          value={currentBalance}
                          onChange={(e) => setCurrentBalance(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Credit Limit / Original Principal ($)
                        <InputGroup
                          type="number"
                          value={creditLimit}
                          onChange={(e) => setCreditLimit(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        APR (%)
                        <InputGroup
                          type="number"
                          value={aprPercent}
                          onChange={(e) => setAprPercent(e.target.value)}
                        />
                      </label>
                      <Button type="submit" intent={Intent.PRIMARY}>
                        Add Tradeline
                      </Button>
                    </form>
                  </Card>

                  <Card>
                    <h3>FCRA Section 611 Bureau Dispute Generator</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <label>
                        Furnisher / Creditor to Dispute
                        <InputGroup
                          value={disputeLender}
                          onChange={(e) => setDisputeLender(e.target.value)}
                          placeholder="e.g. Credit One Bank"
                        />
                      </label>
                      <label>
                        Dispute Reason
                        <InputGroup
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                        />
                      </label>
                      <Button intent={Intent.WARNING} onClick={createDispute}>
                        Generate FCRA Dispute Letter
                      </Button>
                      {disputeLetter && (
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            fontSize: 11,
                            padding: 10,
                            background: 'rgba(0,0,0,0.04)',
                            borderRadius: 8,
                            maxHeight: 180,
                            overflow: 'auto',
                          }}
                        >
                          {disputeLetter}
                        </pre>
                      )}
                    </div>
                  </Card>
                </div>
              </section>

              <section className="freebooks-connections__section">
                <h2>
                  Tracked Tradelines ({tradelines.length}) · Total Debt: $
                  {Number(payoff.totalDebt || 0).toFixed(2)}
                </h2>
                <div className="freebooks-connections__grid">
                  {tradelines.map((t: any) => (
                    <Card key={t.id}>
                      <h3>{t.lenderName}</h3>
                      <p>
                        Balance: <strong>${Number(t.currentBalance).toFixed(2)}</strong>{' '}
                        / Limit: ${Number(t.creditLimit).toFixed(2)}
                      </p>
                      <small>
                        APR: {t.aprPercent}% · Status: {t.paymentStatus}
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

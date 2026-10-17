import {
  Button,
  Callout,
  Card,
  HTMLSelect,
  InputGroup,
  Intent,
  Tag,
  TextArea,
} from '@blueprintjs/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardInsider } from '@/components';
import { DashboardPageContent } from '@/components/Dashboard/DashboardPageContent';
import { PaymentMethodsBoot } from '@/containers/Preferences/PaymentMethods/PreferencesPaymentMethodsBoot';
import { PaymentProviderConnections } from '@/containers/Preferences/PaymentMethods/PaymentProviderConnections';
import { StripePaymentMethod } from '@/containers/Preferences/PaymentMethods/StripePaymentMethod';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';

/**
 * Universal financial source hub: Plaid, SimpleFIN Bridge, Teller.io,
 * GoCardless PSD2, FDX v5.0 / Finicity / MX, Universal OFX/QFX/QIF/CAMT.053/CSV
 * statement parser, Email & Subscription Radar, and Payment Processors.
 */
export function ConnectionsPage() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState('simplefin');
  const [institutionName, setInstitutionName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('checking');
  const [credentialToken, setCredentialToken] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');

  const [importFilename, setImportFilename] = useState('statement.ofx');
  const [importContent, setImportContent] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const headers = {
    Authorization: 'Bearer ' + token,
    'organization-id': organizationId || '',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const connectionsQuery = useQuery({
    queryKey: ['universal-banking-connections'],
    enabled: Boolean(token && organizationId),
    queryFn: async () => {
      const res = await fetch('/api/universal-banking/connections', { headers });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleConnectBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage('');
    const res = await fetch('/api/universal-banking/connections', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider,
        institutionName,
        accountName,
        accountType,
        setupToken: provider === 'simplefin' ? credentialToken : undefined,
        accessToken: provider !== 'simplefin' ? credentialToken : undefined,
        currentBalance: Number(currentBalance || 0),
      }),
    });
    if (res.ok) {
      setInstitutionName('');
      setAccountName('');
      setCredentialToken('');
      setCurrentBalance('');
      setStatusMessage('Connected bank/provider feed and encrypted credentials.');
      await queryClient.invalidateQueries({
        queryKey: ['universal-banking-connections'],
      });
    }
  };

  const handleUniversalImport = async () => {
    if (!importContent.trim()) return;
    const res = await fetch('/api/universal-banking/import-file', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filename: importFilename,
        content: importContent,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setStatusMessage(
        `Parsed ${data.parsedCount || 0} transactions (${data.insertedCount || 0} new imported).`,
      );
      setImportContent('');
    }
  };

  const connectedFeeds = connectionsQuery.data || [];

  return (
    <DashboardInsider name="connections">
      <DashboardPageContent>
        <main className="freebooks-connections">
          <section className="freebooks-connections__hero">
            <div>
              <span className="freebooks-eyebrow">
                UNIVERSAL OPEN-SOURCE FINANCIAL HUB
              </span>
              <h2>Connect Every Bank, Inbox, Tax &amp; Credit Source</h2>
              <p>
                Link 12,000+ banks via SimpleFIN Bridge, Teller.io, Plaid,
                GoCardless PSD2, or FDX v5.0; scan Gmail, Hotmail/Outlook &amp;
                IMAP for recurring subscriptions; and manage taxes, credit
                scores, and credit builder lines in one self-hosted workspace.
              </p>
            </div>
            <Link
              className="freebooks-action freebooks-action--primary"
              to="/email-subscriptions"
            >
              Scan Email Subscriptions <span aria-hidden="true">→</span>
            </Link>
          </section>

          {statusMessage && (
            <Callout intent={Intent.SUCCESS} style={{ marginTop: 18 }}>
              {statusMessage}
            </Callout>
          )}

          <nav
            className="freebooks-connections__jump"
            aria-label="Connection types"
          >
            <a href="#banking-connections">Universal Bank Feeds</a>
            <a href="#email-connections">Gmail / Hotmail / IMAP</a>
            <a href="#payment-connections">Payment Processors</a>
            <a href="#finance-suite">Tax, Credit Karma &amp; Kikoff Suite</a>
          </nav>

          <section
            className="freebooks-connections__section"
            id="banking-connections"
          >
            <div className="freebooks-section-heading">
              <div>
                <span className="freebooks-eyebrow">
                  01 / UNIVERSAL BANKING &amp; AGGREGATORS
                </span>
                <h2>Connect Any Bank, Credit Union, or Card</h2>
                <p>
                  Connect via SimpleFIN Bridge ($1.50/mo open-source friendly,
                  12,000+ banks), Teller.io mTLS API, Plaid Link, GoCardless
                  (EU/UK PSD2), FDX v5.0 (Finicity/MX/Akoya), or Universal
                  OFX/QFX/QIF/CAMT.053/CSV import.
                </p>
              </div>
            </div>
            <div className="freebooks-connections__grid">
              <Card>
                <h3>Add Universal Bank / Aggregator Feed</h3>
                <form
                  onSubmit={handleConnectBank}
                  style={{ display: 'grid', gap: 10 }}
                >
                  <label>
                    Aggregator / Protocol
                    <HTMLSelect
                      fill
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      options={[
                        {
                          value: 'simplefin',
                          label: 'SimpleFIN Bridge (12,000+ US/CA Banks)',
                        },
                        {
                          value: 'teller',
                          label: 'Teller.io Direct Bank API (Chase/BofA/Amex/CapOne)',
                        },
                        {
                          value: 'plaid',
                          label: 'Plaid Link & Investments',
                        },
                        {
                          value: 'gocardless',
                          label: 'GoCardless / Nordigen (EU & UK PSD2)',
                        },
                        {
                          value: 'fdx',
                          label: 'FDX v5.0 / Finicity / MX / Akoya (1033 Open Banking)',
                        },
                      ]}
                    />
                  </label>
                  <label>
                    Institution Name
                    <InputGroup
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                      placeholder="e.g. Capital One, Chase, Arvest, Chime, SoFi"
                      required
                    />
                  </label>
                  <label>
                    Account Nickname &amp; Type
                    <div style={{ display: 'flex', gap: 8 }}>
                      <InputGroup
                        fill
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="Primary Checking"
                        required
                      />
                      <HTMLSelect
                        value={accountType}
                        onChange={(e) => setAccountType(e.target.value)}
                        options={[
                          { value: 'checking', label: 'Checking' },
                          { value: 'savings', label: 'Savings' },
                          { value: 'credit_card', label: 'Credit Card' },
                          { value: 'investment', label: 'Investment' },
                          { value: 'loan', label: 'Loan / Auto' },
                        ]}
                      />
                    </div>
                  </label>
                  <label>
                    Setup Token / Access Token
                    <InputGroup
                      type="password"
                      value={credentialToken}
                      onChange={(e) => setCredentialToken(e.target.value)}
                      placeholder="SimpleFIN Base64 token or API Bearer token"
                    />
                  </label>
                  <label>
                    Opening / Current Balance ($)
                    <InputGroup
                      type="number"
                      value={currentBalance}
                      onChange={(e) => setCurrentBalance(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <Button type="submit" intent={Intent.PRIMARY}>
                    Connect Institution Feed
                  </Button>
                </form>
              </Card>

              <Card>
                <h3>Universal Statement Parser (OFX / QFX / QIF / XML / CSV)</h3>
                <p>
                  Paste or drop raw OFX/QFX Web Connect, Quicken QIF, ISO 20022
                  CAMT.053 XML, or any bank CSV to import transactions with
                  automatic deduplication.
                </p>
                <div style={{ display: 'grid', gap: 8 }}>
                  <InputGroup
                    value={importFilename}
                    onChange={(e) => setImportFilename(e.target.value)}
                    placeholder="statement.ofx or transactions.csv"
                  />
                  <TextArea
                    fill
                    rows={5}
                    value={importContent}
                    onChange={(e) => setImportContent(e.target.value)}
                    placeholder="Date,Description,Amount&#10;2026-10-15,OpenAI ChatGPT,-20.00"
                  />
                  <Button intent={Intent.PRIMARY} onClick={handleUniversalImport}>
                    Parse &amp; Import Statement
                  </Button>
                </div>
              </Card>

              <Card>
                <h3>Connected Universal Feeds ({connectedFeeds.length})</h3>
                {connectedFeeds.length === 0 ? (
                  <p>
                    No universal bank feeds added yet. Connect SimpleFIN,
                    Teller, Plaid, GoCardless, or FDX on the left, or open{' '}
                    <Link to="/cashflow-accounts">Cashflow Accounts</Link>.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {connectedFeeds.map((c: any) => (
                      <div
                        key={c.id}
                        style={{
                          padding: 10,
                          border: '1px solid var(--fb-border)',
                          borderRadius: 8,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <strong>
                            {c.institutionName} — {c.accountName}
                          </strong>
                          <Tag intent={Intent.SUCCESS} minimal>
                            {c.provider.toUpperCase()}
                          </Tag>
                        </div>
                        <div>
                          Balance: <strong>${Number(c.currentBalance).toFixed(2)}</strong>{' '}
                          ({c.accountType})
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </section>

          <section
            className="freebooks-connections__section"
            id="email-connections"
          >
            <div className="freebooks-section-heading">
              <div>
                <span className="freebooks-eyebrow">
                  02 / EMAIL &amp; SUBSCRIPTION SCANNER
                </span>
                <h2>Gmail, Hotmail / Outlook, Yahoo, iCloud &amp; IMAP</h2>
                <p>
                  Automatically detect recurring software, streaming, cloud
                  hosting, utilities, free trials, and price hikes across every
                  inbox and bank feed.
                </p>
              </div>
            </div>
            <div className="freebooks-connections__grid">
              <article className="freebooks-connection-tile">
                <div className="freebooks-connection-tile__icon">✉</div>
                <h3>Gmail &amp; Google Workspace</h3>
                <p>
                  Scan via Gmail REST API OAuth2 or IMAP TLS (`imap.gmail.com`)
                  to find recurring receipts and `List-Unsubscribe` links.
                </p>
                <Link className="freebooks-action" to="/email-subscriptions">
                  Connect Gmail <span aria-hidden="true">→</span>
                </Link>
              </article>
              <article className="freebooks-connection-tile">
                <div className="freebooks-connection-tile__icon">📬</div>
                <h3>Hotmail, Outlook &amp; Office 365</h3>
                <p>
                  Connect via Microsoft Graph API (`Mail.Read`) or
                  `outlook.office365.com:993` IMAPS for Microsoft accounts.
                </p>
                <Link className="freebooks-action" to="/email-subscriptions">
                  Connect Hotmail / Outlook <span aria-hidden="true">→</span>
                </Link>
              </article>
              <article className="freebooks-connection-tile">
                <div className="freebooks-connection-tile__icon">🔐</div>
                <h3>Universal IMAP, Proton Bridge &amp; .EML</h3>
                <p>
                  Connect Yahoo, iCloud, Fastmail, ProtonMail Bridge, or any
                  self-hosted IMAP server, or parse `.eml`/`.mbox` files.
                </p>
                <Link className="freebooks-action" to="/email-subscriptions">
                  Open Subscription Radar <span aria-hidden="true">→</span>
                </Link>
              </article>
            </div>
          </section>

          <section
            className="freebooks-connections__section"
            id="payment-connections"
          >
            <div className="freebooks-section-heading">
              <div>
                <span className="freebooks-eyebrow">03 / GET PAID</span>
                <h2>Payment processors</h2>
                <p>
                  Manage each Stripe, Square, PayPal, and Authorize.Net account.
                  Connection status and checkout readiness are shown below.
                </p>
              </div>
              <Link to="/preferences/payment-methods">
                Invoice payment settings →
              </Link>
            </div>
            <div className="freebooks-connections__processors">
              <PaymentMethodsBoot>
                <StripePaymentMethod />
                <PaymentProviderConnections />
              </PaymentMethodsBoot>
            </div>
          </section>

          <section
            className="freebooks-connections__section"
            id="finance-suite"
          >
            <div className="freebooks-section-heading">
              <div>
                <span className="freebooks-eyebrow">
                  04 / TAX, CREDIT KARMA &amp; KIKOFF REPLACEMENTS
                </span>
                <h2>Complete Personal &amp; Business Finance Suite</h2>
                <p>
                  Self-hosted replacements for TurboTax, Credit Karma, and
                  Kikoff built directly on your ledger and bank evidence.
                </p>
              </div>
            </div>
            <div className="freebooks-connections__grid">
              <article className="freebooks-connection-tile">
                <div className="freebooks-connection-tile__icon">🧾</div>
                <h3>Tax Center (TurboTax Replacement)</h3>
                <p>
                  Live IRS Form 1040, Schedule C business profit &amp; loss,
                  Schedule SE self-employment tax, QBI 20% deduction, and
                  quarterly 1040-ES vouchers.
                </p>
                <Link className="freebooks-action" to="/tax-center">
                  Open Tax Center <span aria-hidden="true">→</span>
                </Link>
              </article>
              <article className="freebooks-connection-tile">
                <div className="freebooks-connection-tile__icon">📈</div>
                <h3>Credit Health (Credit Karma Replacement)</h3>
                <p>
                  Track TransUnion, Equifax, and Experian credit factors,
                  simulate score changes, optimize debt payoff, and generate
                  FCRA Section 611 dispute letters.
                </p>
                <Link className="freebooks-action" to="/credit-health">
                  Open Credit Health <span aria-hidden="true">→</span>
                </Link>
              </article>
              <article className="freebooks-connection-tile">
                <div className="freebooks-connection-tile__icon">🛡️</div>
                <h3>Credit Builder (Kikoff Replacement)</h3>
                <p>
                  Manage 0% APR revolving credit-builder lines, escrowed builder
                  loans, and Metro 2 verified rent &amp; utility bill reporting.
                </p>
                <Link className="freebooks-action" to="/credit-builder">
                  Open Credit Builder <span aria-hidden="true">→</span>
                </Link>
              </article>
            </div>
          </section>
        </main>
      </DashboardPageContent>
    </DashboardInsider>
  );
}

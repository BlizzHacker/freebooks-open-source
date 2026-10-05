import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardInsider } from '@/components';
import { DashboardPageContent } from '@/components/Dashboard/DashboardPageContent';
import { PaymentMethodsBoot } from '@/containers/Preferences/PaymentMethods/PreferencesPaymentMethodsBoot';
import { PaymentProviderConnections } from '@/containers/Preferences/PaymentMethods/PaymentProviderConnections';
import { StripePaymentMethod } from '@/containers/Preferences/PaymentMethods/StripePaymentMethod';

/**
 * One entry point for every kind of account source. The processor forms below
 * are the same live controls used by Payment Methods, so both paths stay in sync.
 */
export function ConnectionsPage() {
  return (
    <DashboardInsider name="connections">
      <DashboardPageContent>
        <main className="freebooks-connections">
          <section className="freebooks-connections__hero">
            <div>
              <span className="freebooks-eyebrow">YOUR FINANCIAL SOURCES</span>
              <h2>Bring your money together</h2>
              <p>
                Link bank feeds, add payment accounts, and keep statements in
                one place. You can add more than one account from each provider.
              </p>
            </div>
            <Link
              className="freebooks-action freebooks-action--primary"
              to="/cashflow-accounts"
            >
              Connect a bank or card <span aria-hidden="true">→</span>
            </Link>
          </section>

          <nav
            className="freebooks-connections__jump"
            aria-label="Connection types"
          >
            <a href="#banking-connections">Banks &amp; cards</a>
            <a href="#payment-connections">Payment processors</a>
            <a href="#other-connections">Other accounts &amp; records</a>
          </nav>

          <section
            className="freebooks-connections__section"
            id="banking-connections"
          >
            <div className="freebooks-section-heading">
              <div>
                <span className="freebooks-eyebrow">01 / BANKING</span>
                <h2>Banks &amp; credit cards</h2>
                <p>
                  Connect supported institutions with Plaid Link, or import a
                  bank or card export.
                </p>
              </div>
            </div>
            <div className="freebooks-connections__grid">
              <article className="freebooks-connection-tile">
                <div
                  className="freebooks-connection-tile__icon"
                  aria-hidden="true"
                >
                  ▦
                </div>
                <h3>Connect with Plaid</h3>
                <p>
                  Choose Connect Bank/Credit Card in Banking to authorize a
                  supported account. FreeBooks never asks for your bank password
                  here.
                </p>
                <Link className="freebooks-action" to="/cashflow-accounts">
                  Open bank connections <span aria-hidden="true">→</span>
                </Link>
              </article>
              <article className="freebooks-connection-tile">
                <div
                  className="freebooks-connection-tile__icon"
                  aria-hidden="true"
                >
                  ⇧
                </div>
                <h3>Import transactions</h3>
                <p>
                  When a feed is unavailable, add the matching cash flow account
                  and import a CSV or XLSX export. Preview and review the rows
                  first.
                </p>
                <Link className="freebooks-action" to="/cashflow-accounts">
                  Import a bank or card file <span aria-hidden="true">→</span>
                </Link>
              </article>
              <article className="freebooks-connection-tile">
                <div
                  className="freebooks-connection-tile__icon"
                  aria-hidden="true"
                >
                  ▤
                </div>
                <h3>Keep the evidence</h3>
                <p>
                  Upload statements, receipts, and bills to your private
                  document vault, then link them to the right account as you
                  review.
                </p>
                <Link className="freebooks-action" to="/source-documents">
                  Open source documents <span aria-hidden="true">→</span>
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
                <span className="freebooks-eyebrow">02 / GET PAID</span>
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
            id="other-connections"
          >
            <div className="freebooks-section-heading">
              <div>
                <span className="freebooks-eyebrow">03 / THE FULL PICTURE</span>
                <h2>Other accounts &amp; records</h2>
                <p>
                  Keep supporting records and values visible while direct
                  integrations are being added.
                </p>
              </div>
            </div>
            <div className="freebooks-connections__grid">
              <article className="freebooks-connection-tile">
                <div
                  className="freebooks-connection-tile__icon"
                  aria-hidden="true"
                >
                  ◇
                </div>
                <h3>Investments, crypto &amp; vehicles</h3>
                <p>
                  Review tracked assets and credit. Plaid investment holdings
                  appear in Banking when the institution supports them and you
                  grant access.
                </p>
                <Link className="freebooks-action" to="/assets-credit">
                  Review assets &amp; credit <span aria-hidden="true">→</span>
                </Link>
                <Link className="freebooks-action" to="/crypto-wallets">
                  Track a Solana wallet <span aria-hidden="true">→</span>
                </Link>
              </article>
              <article className="freebooks-connection-tile">
                <div
                  className="freebooks-connection-tile__icon"
                  aria-hidden="true"
                >
                  ▣
                </div>
                <h3>Payroll, tax &amp; utility records</h3>
                <p>
                  Store PDFs and receipt photos with searchable source names and
                  dates. Uploads alone do not create ledger transactions.
                </p>
                <Link className="freebooks-action" to="/source-documents">
                  Organize documents <span aria-hidden="true">→</span>
                </Link>
              </article>
              <article className="freebooks-connection-tile freebooks-connection-tile--note">
                <div
                  className="freebooks-connection-tile__icon"
                  aria-hidden="true"
                >
                  ＋
                </div>
                <h3>More providers</h3>
                <p>
                  Cash App, Venmo, retirement plans, wallets, and email
                  purchases can be recorded through exports and source documents
                  today. Direct connections vary by provider.
                </p>
                <Link className="freebooks-action" to="/cashflow-accounts">
                  Start with an export <span aria-hidden="true">→</span>
                </Link>
              </article>
            </div>
          </section>
        </main>
      </DashboardPageContent>
    </DashboardInsider>
  );
}

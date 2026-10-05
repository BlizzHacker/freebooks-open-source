import React from 'react';
import { Link } from 'react-router-dom';
import '@/style/pages/HomePage/FreeBooksHome.scss';

const areas = [
  {
    icon: '▦',
    title: 'Banking & cards',
    description:
      'Review balances, import transactions, and connect supported accounts.',
    href: '/cashflow-accounts',
    action: 'Open banking',
  },
  {
    icon: '⇄',
    title: 'Connections',
    description:
      'Add banks, payment processors, and other financial sources from one place.',
    href: '/connections',
    action: 'Manage connections',
  },
  {
    icon: '▤',
    title: 'Source documents',
    description:
      'Search statements, bills, tax forms, and receipts in your private vault.',
    href: '/source-documents',
    action: 'Browse documents',
  },
  {
    icon: '◇',
    title: 'Assets & credit',
    description:
      'See vehicles, credit accounts, loans, and supporting values together.',
    href: '/assets-credit',
    action: 'Review assets',
  },
  {
    icon: '▣',
    title: 'Reports',
    description:
      'Explore income, spending, and accounting reports as your records are organized.',
    href: '/financial-reports',
    action: 'Open reports',
  },
  {
    icon: '▥',
    title: 'Invoices & payments',
    description: 'Create invoices and manage how your customers pay.',
    href: '/invoices',
    action: 'Open invoices',
  },
];

export function HomepageContent() {
  return (
    <main className="freebooks-home">
      <section className="freebooks-home__hero">
        <div className="freebooks-home__hero-copy">
          <span className="freebooks-eyebrow">YOUR MONEY, IN ONE PLACE</span>
          <h2>Good to see you. Let&apos;s get organized.</h2>
          <p>
            Bring your accounts and records together, then review what needs
            attention. Start with a connection or add the documents you already
            have.
          </p>
          <div className="freebooks-home__hero-actions">
            <Link
              className="freebooks-action freebooks-action--primary"
              to="/connections"
            >
              Connect an account <span aria-hidden="true">→</span>
            </Link>
            <Link
              className="freebooks-action freebooks-action--quiet"
              to="/source-documents?capture=1"
            >
              Add a receipt
            </Link>
          </div>
        </div>
        <div className="freebooks-home__hero-mark" aria-hidden="true">
          <img src="/freebooks-mark.png" alt="" />
          <span>FreeBooks</span>
        </div>
      </section>

      <section className="freebooks-home__next">
        <div className="freebooks-section-heading">
          <div>
            <span className="freebooks-eyebrow">START HERE</span>
            <h2>Your next steps</h2>
            <p>
              These three actions make the rest of the workspace more useful.
            </p>
          </div>
        </div>
        <div className="freebooks-home__steps">
          <Link to="/connections">
            <span className="freebooks-home__step-number">01</span>
            <strong>Connect accounts</strong>
            <span>Bank feeds and payment processors</span>
            <span className="freebooks-home__step-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link to="/cashflow-accounts">
            <span className="freebooks-home__step-number">02</span>
            <strong>Review transactions</strong>
            <span>Import missing activity and categorize it</span>
            <span className="freebooks-home__step-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link to="/source-documents">
            <span className="freebooks-home__step-number">03</span>
            <strong>Attach the proof</strong>
            <span>Keep receipts, statements, and bills searchable</span>
            <span className="freebooks-home__step-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </section>

      <section className="freebooks-home__workspace">
        <div className="freebooks-section-heading">
          <div>
            <span className="freebooks-eyebrow">WORKSPACE</span>
            <h2>Everything you need</h2>
            <p>Choose an area to pick up where you left off.</p>
          </div>
        </div>
        <div className="freebooks-home__areas">
          {areas.map((area) => (
            <Link
              key={area.title}
              to={area.href}
              className="freebooks-home__area"
            >
              <span className="freebooks-home__area-icon" aria-hidden="true">
                {area.icon}
              </span>
              <strong>{area.title}</strong>
              <span>{area.description}</span>
              <em>
                {area.action} <span aria-hidden="true">→</span>
              </em>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

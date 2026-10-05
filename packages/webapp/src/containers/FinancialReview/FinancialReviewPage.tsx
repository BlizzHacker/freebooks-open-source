import { Callout, Dialog, Intent, Spinner } from '@blueprintjs/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardInsider } from '@/components';
import { DashboardPageContent } from '@/components/Dashboard/DashboardPageContent';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';
import { downloadFile } from '@/hooks/useDownloadFile';
import { transformToCamelCase } from '@/utils';
import {
  ReviewPolicySettings,
  type ReviewPolicy,
} from './ReviewPolicySettings';
import './FinancialReviewPage.scss';

type ReviewBucket =
  | 'attention'
  | 'automatic'
  | 'receipts'
  | 'unresolved'
  | 'all'
  | 'large'
  | 'generic'
  | 'transfer'
  | 'utilities'
  | 'hosting'
  | 'hardware'
  | 'recognized';

interface ReviewAccountCoverage {
  accountId: number;
  accountName: string;
  imported: number;
  needsReview: number;
  sourceLinkedRows: number;
  accountDocuments: number;
  firstImportedDate: string | null;
  lastImportedDate: string | null;
}

interface ReviewOverview {
  accountCoverage: ReviewAccountCoverage[];
  autoOrganize: {
    autoOrganized: number;
    awaitingReceipt: number;
    reviewRequired: number;
    unresolved: number;
    householdFood: number;
    businessExpenses: number;
  };
  total: number;
  active: number;
  posted: number;
  excluded: number;
  recognized: number;
  large: number;
  generic: number;
  transfer: number;
  utilities: number;
  hosting: number;
  hardware: number;
  documents: number;
  statementLinks: number;
  note: string;
}

interface ReviewEvidence {
  id: number;
  filename: string;
}

interface ReviewItem {
  classification: {
    status:
      | 'automatic'
      | 'awaitingReceipt'
      | 'reviewRequired'
      | 'unresolved'
      | 'manual';
    category: string | null;
    entity: 'Personal' | 'Business' | 'W2' | null;
    branchId: number | null;
    confidence: 'high' | 'medium' | 'low' | null;
    reason: string;
  } | null;
  id: number;
  accountId: number;
  accountName: string;
  date: string;
  amount: number | string;
  payee: string | null;
  description: string | null;
  recognized: boolean;
  suggestion: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  reason: string | null;
  flags: string[];
  genericPayee: boolean;
  evidence: ReviewEvidence[];
}

interface ReviewList {
  data: ReviewItem[];
  pagination: { total: number; page: number; pageSize: number };
  bucket: ReviewBucket;
}

const buckets: Array<{
  key: ReviewBucket;
  label: string;
  count: (overview: ReviewOverview) => number;
}> = [
  {
    key: 'attention',
    label: 'Your review queue',
    count: (overview) => overview.autoOrganize.reviewRequired,
  },
  {
    key: 'automatic',
    label: 'Auto organized',
    count: (overview) => overview.autoOrganize.autoOrganized,
  },
  {
    key: 'receipts',
    label: 'Awaiting receipts',
    count: (overview) => overview.autoOrganize.awaitingReceipt,
  },
  {
    key: 'unresolved',
    label: 'Unresolved evidence',
    count: (overview) => overview.autoOrganize.unresolved,
  },
  { key: 'all', label: 'All unposted', count: (overview) => overview.active },
  {
    key: 'large',
    label: 'Over review threshold',
    count: (overview) => overview.large,
  },
  {
    key: 'generic',
    label: 'Generic payees',
    count: (overview) => overview.generic,
  },
  {
    key: 'transfer',
    label: 'Possible transfers',
    count: (overview) => overview.transfer,
  },
  {
    key: 'utilities',
    label: 'Utilities',
    count: (overview) => overview.utilities,
  },
  {
    key: 'hosting',
    label: 'Hosting & domains',
    count: (overview) => overview.hosting,
  },
  {
    key: 'hardware',
    label: 'Hardware candidates',
    count: (overview) => overview.hardware,
  },
  {
    key: 'recognized',
    label: 'Recognition linked',
    count: (overview) => overview.recognized,
  },
];

const classificationStatusLabels = {
  automatic: 'Auto organized',
  awaitingReceipt: 'Awaiting receipt',
  reviewRequired: 'Review required',
  unresolved: 'Needs source evidence',
  manual: 'Reviewed by you',
} as const;

function formatClassificationLabel(value: string | null) {
  if (!value) return 'Unclassified';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayPayee(value: string | null) {
  return value?.split(' | ')[0]?.trim() || 'Payee not provided';
}

function displayDescription(item: ReviewItem) {
  const description = item.description
    ?.replace(/\s*\|\s*Source statement:.*$/i, '')
    .trim();
  if (
    !description ||
    description === item.payee ||
    description === displayPayee(item.payee)
  ) {
    return null;
  }
  if (/^Credit One card statement transaction;/i.test(description)) {
    return null;
  }
  if (/^.+\s*\|\s*PerPay statement extraction;/i.test(description)) {
    return null;
  }
  return description;
}

function formatDate(value: string) {
  const calendar = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (calendar) {
    return new Date(
      Number(calendar[1]),
      Number(calendar[2]) - 1,
      Number(calendar[3]),
    ).toLocaleDateString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || 'Date unavailable'
    : date.toLocaleDateString();
}

function formatImportedDates(coverage: ReviewAccountCoverage) {
  if (!coverage.firstImportedDate || !coverage.lastImportedDate) {
    return 'No imported rows';
  }
  const first = formatDate(coverage.firstImportedDate);
  const last = formatDate(coverage.lastImportedDate);
  return first === last ? first : first + ' – ' + last;
}

function formatAmount(value: number | string) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount)
    : 'Amount unavailable';
}

async function getReviewData<T>(
  path: string,
  token: string,
  organizationId: string,
): Promise<T> {
  const response = await fetch('/api/financial-review/' + path, {
    headers: {
      Authorization: 'Bearer ' + token,
      'organization-id': organizationId,
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? 'You do not have access to bank transaction review.'
        : 'Financial review could not load. Please retry.',
    );
  }
  return transformToCamelCase(await response.json()) as T;
}

export function FinancialReviewPage() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<ReviewItem | null>(null);
  const [editEntity, setEditEntity] = useState<'Personal' | 'Business' | 'W2'>(
    'Personal',
  );
  const [editCategory, setEditCategory] = useState('');
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [bucket, setBucket] = useState<ReviewBucket>(() => {
    const requested = new URLSearchParams(window.location.search).get('bucket');
    return buckets.some((item) => item.key === requested)
      ? (requested as ReviewBucket)
      : 'attention';
  });
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const [preview, setPreview] = useState<
    (ReviewEvidence & { url: string }) | null
  >(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const params = useMemo(() => {
    const query = new URLSearchParams({
      bucket,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search) query.set('q', search);
    return query.toString();
  }, [bucket, page, pageSize, search]);

  const overviewQuery = useQuery({
    queryKey: ['financial-review-overview', organizationId],
    enabled: Boolean(token && organizationId),
    queryFn: () =>
      getReviewData<ReviewOverview>('overview', token!, organizationId!),
  });
  const policyQuery = useQuery({
    queryKey: ['financial-review-policy', organizationId],
    enabled: Boolean(token && organizationId),
    queryFn: () =>
      getReviewData<ReviewPolicy>(
        'auto-organize/policy',
        token!,
        organizationId!,
      ),
  });
  const itemsQuery = useQuery({
    queryKey: ['financial-review-items', organizationId, params],
    enabled: Boolean(token && organizationId),
    queryFn: () =>
      getReviewData<ReviewList>('items?' + params, token!, organizationId!),
  });

  const overview = overviewQuery.data;
  const list = itemsQuery.data;
  const totalPages = list
    ? Math.max(1, Math.ceil(list.pagination.total / list.pagination.pageSize))
    : 1;
  const selectedBucket = buckets.find((item) => item.key === bucket)!;

  const openClassificationEditor = (item: ReviewItem) => {
    setEditingItem(item);
    setEditEntity(item.classification?.entity || 'Personal');
    setEditCategory(item.classification?.category || '');
    setEditError('');
  };

  const saveClassification = async () => {
    if (!editingItem || !token || !organizationId) return;
    const category = editCategory.trim();
    if (!category) {
      setEditError('Enter a category before saving.');
      return;
    }
    const policy = policyQuery.data;
    if (!policy) {
      setEditError('Account assignments are still loading. Please retry.');
      return;
    }
    const branchId =
      editEntity === 'Business'
        ? policy.businessBranchId
        : editEntity === 'W2'
          ? policy.w2BranchId
          : policy.personalBranchId;
    if (!branchId) {
      setEditError(
        'This entity needs an account assignment before it can be saved.',
      );
      return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      const response = await fetch(
        '/api/financial-review/items/' + editingItem.id + '/classification',
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer ' + token,
            'organization-id': organizationId,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            category,
            entity: editEntity,
            branchId,
            status: 'manual',
            reason: 'Reviewed by the account owner in FreeBooks.',
          }),
        },
      );
      if (!response.ok) throw new Error('The label could not be saved.');
      setEditingItem(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['financial-review-overview', organizationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['financial-review-items', organizationId],
        }),
      ]);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Please retry.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePreview = async (evidence: ReviewEvidence) => {
    if (!token || !organizationId) return;
    if (!/\.pdf$/i.test(evidence.filename)) {
      setDownloadMessage(
        'Preview is available for PDF evidence. Download this file to review it.',
      );
      return;
    }
    setPreviewingId(evidence.id);
    setDownloadMessage('');
    try {
      const response = await fetch(
        '/api/attachments/vault/' + evidence.id + '/download?inline=1',
        {
          headers: {
            Authorization: 'Bearer ' + token,
            'organization-id': organizationId,
          },
          credentials: 'same-origin',
        },
      );
      if (
        !response.ok ||
        !response.headers.get('content-type')?.includes('application/pdf')
      ) {
        throw new Error('Preview unavailable');
      }
      setPreview({
        ...evidence,
        url: URL.createObjectURL(await response.blob()),
      });
    } catch {
      setDownloadMessage(
        'The PDF preview could not load. You can download the document instead.',
      );
    } finally {
      setPreviewingId(null);
    }
  };

  const handleDownload = async (evidence: ReviewEvidence) => {
    if (!token || !organizationId) return;
    setDownloadingId(evidence.id);
    setDownloadMessage('');
    try {
      const response = await fetch(
        '/api/attachments/vault/' + evidence.id + '/download',
        {
          headers: {
            Authorization: 'Bearer ' + token,
            'organization-id': organizationId,
          },
          credentials: 'same-origin',
        },
      );
      if (!response.ok) throw new Error('Download failed');
      downloadFile(
        await response.blob(),
        evidence.filename || 'source-document',
        response.headers.get('content-type') || 'application/octet-stream',
      );
    } catch {
      setDownloadMessage(
        'The linked document could not be downloaded. Please retry.',
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <DashboardInsider name="financial-review">
      <DashboardPageContent>
        <main className="financial-review-page">
          <header className="financial-review-page__header">
            <div>
              <span className="financial-review-page__eyebrow">Your money</span>
              <h1>Financial Review</h1>
              <p>
                Review imported bank activity, suggested categories, and source
                evidence before posting.
              </p>
            </div>
            <Link
              className="financial-review-page__header-link"
              to="/source-documents"
            >
              Browse source documents
            </Link>
          </header>

          <Callout icon="info-sign" intent={Intent.PRIMARY}>
            FreeBooks organizes routine transactions using the rules you choose.
            Large payments come to your review queue. Labels stay separate from
            posted accounting entries; mixed store purchases need itemized
            receipts before any business claim. Linked statements provide
            context, not line-by-line reconciliation.
          </Callout>

          <section
            aria-label="Review totals"
            className="financial-review-page__totals"
          >
            {[
              { label: 'Imported', value: overview?.total },
              {
                label: 'Auto organized',
                value: overview?.autoOrganize?.autoOrganized,
              },
              {
                label: 'Awaiting receipts',
                value: overview?.autoOrganize?.awaitingReceipt,
              },
              {
                label: 'Your review queue',
                value: overview?.autoOrganize?.reviewRequired,
              },
              { label: 'Posted to books', value: overview?.posted },
              { label: 'Documents', value: overview?.documents },
            ].map((total) => (
              <div key={total.label} className="financial-review-page__total">
                <span>{total.label}</span>
                <strong>
                  {total.value === undefined
                    ? '—'
                    : total.value.toLocaleString()}
                </strong>
              </div>
            ))}
          </section>
          {overviewQuery.isError && (
            <Callout
              intent={Intent.DANGER}
              title="Review totals could not load"
            >
              {overviewQuery.error instanceof Error
                ? overviewQuery.error.message
                : 'Please retry.'}{' '}
              <button type="button" onClick={() => overviewQuery.refetch()}>
                Retry totals
              </button>
            </Callout>
          )}

          <ReviewPolicySettings
            policy={policyQuery.data}
            token={token}
            organizationId={organizationId}
            onSaved={async () => {
              await queryClient.invalidateQueries({
                queryKey: ['financial-review-policy', organizationId],
              });
              await queryClient.invalidateQueries({
                queryKey: ['financial-review-overview', organizationId],
              });
              await queryClient.invalidateQueries({
                queryKey: ['financial-review-items', organizationId],
              });
            }}
          />

          <section
            className="financial-review-page__automation"
            aria-label="Automatic organization rules"
          >
            <div>
              <span className="financial-review-page__eyebrow">
                How FreeBooks sorts this
              </span>
              <h2>
                {policyQuery.data?.enabled
                  ? 'Routine spending organizes itself'
                  : 'Choose how your spending gets organized'}
              </h2>
              <p>
                Food and groceries go to your household. Clear computer,
                hosting, AI, domain, and office purchases go to your configured
                business. Walmart, Amazon, and eBay purchases wait for receipt
                details when the bank line cannot identify the items.
              </p>
            </div>
            <div className="financial-review-page__automation-cards">
              <div>
                <strong>Household food</strong>
                <span>
                  {overview?.autoOrganize?.householdFood?.toLocaleString() ??
                    '—'}{' '}
                  labeled
                </span>
              </div>
              <div>
                <strong>{policyQuery.data?.businessName || 'Business'}</strong>
                <span>
                  {overview?.autoOrganize?.businessExpenses?.toLocaleString() ??
                    '—'}{' '}
                  expense candidates
                </span>
              </div>
              <div>
                <strong>Your action</strong>
                <span>
                  Review payments over{' '}
                  {formatAmount(policyQuery.data?.reviewThreshold || 500)} and
                  exceptions
                </span>
              </div>
            </div>
            <p className="financial-review-page__automation-note">
              Source receipts can change a label when item details show a
              different purpose. Automatic labels do not create tax deductions
              or post entries to the ledger.
            </p>
          </section>

          <section
            className="financial-review-page__retailers"
            aria-labelledby="financial-review-retailers-heading"
          >
            <div>
              <span className="financial-review-page__eyebrow">
                Receipt sources
              </span>
              <h2 id="financial-review-retailers-heading">
                Bring in item details
              </h2>
              <p>
                Bank feeds show the total charge. Itemized receipts let
                FreeBooks separate household food from business equipment at
                mixed retailers. Automated retailer account sync is not
                connected yet.
              </p>
              <Link to="/source-documents">Upload receipt photos or PDFs</Link>
            </div>
            <div className="financial-review-page__retailer-links">
              <a
                href="https://www.walmart.com/orders"
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>Walmart</strong>
                <span>Purchase history and printable receipts ↗</span>
              </a>
              <a
                href="https://www.amazon.com/gp/your-account/order-history"
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>Amazon</strong>
                <span>Your Orders and invoices ↗</span>
              </a>
              <a
                href="https://www.ebay.com/mye/myebay/purchase"
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>eBay</strong>
                <span>Purchase history ↗</span>
              </a>
            </div>
          </section>

          {!overviewQuery.isError && (
            <section
              className="financial-review-page__coverage"
              aria-labelledby="financial-review-coverage-heading"
            >
              <div className="financial-review-page__section-heading">
                <div>
                  <h2 id="financial-review-coverage-heading">
                    Source coverage by account
                  </h2>
                  <p>
                    Accounts with imported bank rows or documents linked to the
                    account. Row evidence links identify a source file for
                    review; they do not verify a statement line.
                  </p>
                </div>
              </div>
              {overviewQuery.isLoading ? (
                <div
                  className="financial-review-page__coverage-loading"
                  role="status"
                >
                  <Spinner size={20} />
                  <span>Loading account coverage…</span>
                </div>
              ) : overview?.accountCoverage?.length ? (
                <div className="financial-review-page__coverage-table">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Account</th>
                        <th scope="col">Imported rows</th>
                        <th scope="col">Needs review</th>
                        <th scope="col">Rows with source evidence</th>
                        <th scope="col">Account documents</th>
                        <th scope="col">Imported dates</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.accountCoverage.map((coverage) => (
                        <tr key={coverage.accountId}>
                          <th scope="row">
                            <Link
                              to={
                                coverage.imported > 0
                                  ? '/cashflow-accounts/' +
                                    coverage.accountId +
                                    '/transactions?filter=uncategorized'
                                  : '/source-documents?account_id=' +
                                    coverage.accountId
                              }
                            >
                              {coverage.accountName}
                            </Link>
                            <span className="financial-review-page__coverage-id">
                              Account #{coverage.accountId}
                            </span>
                            {coverage.imported === 0 &&
                              coverage.accountDocuments > 0 && (
                                <span className="financial-review-page__coverage-badge">
                                  Documents only
                                </span>
                              )}
                          </th>
                          <td>{coverage.imported.toLocaleString()}</td>
                          <td>{coverage.needsReview.toLocaleString()}</td>
                          <td>
                            {coverage.imported > 0
                              ? coverage.sourceLinkedRows.toLocaleString() +
                                ' / ' +
                                coverage.imported.toLocaleString()
                              : 'No imported rows'}
                          </td>
                          <td>
                            {coverage.accountDocuments > 0 ? (
                              <Link
                                to={
                                  '/source-documents?account_id=' +
                                  coverage.accountId
                                }
                              >
                                {coverage.accountDocuments.toLocaleString()}
                              </Link>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td>{formatImportedDates(coverage)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="financial-review-page__coverage-empty">
                  No imported bank rows or account documents are available yet.
                </p>
              )}
              <p className="financial-review-page__coverage-note">
                Imported dates show the first and last retained rows. They do
                not establish continuous statement coverage.
              </p>
            </section>
          )}

          <section
            className="financial-review-page__workspace"
            aria-labelledby="financial-review-work-heading"
          >
            <div className="financial-review-page__section-heading">
              <div>
                <h2 id="financial-review-work-heading">Transactions</h2>
                <p>
                  Start with your action queue, then inspect automatic labels or
                  receipts.
                </p>
              </div>
              {overviewQuery.isLoading && (
                <Spinner size={20} aria-label="Loading review totals" />
              )}
            </div>
            <nav
              className="financial-review-page__buckets"
              aria-label="Review categories"
            >
              {buckets.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={item.key === bucket ? 'is-selected' : ''}
                  aria-pressed={item.key === bucket}
                  onClick={() => {
                    setBucket(item.key);
                    setPage(1);
                  }}
                >
                  <span>{item.label}</span>
                  <strong>
                    {overview ? item.count(overview).toLocaleString() : '—'}
                  </strong>
                </button>
              ))}
            </nav>

            <div className="financial-review-page__controls">
              <label htmlFor="financial-review-search">
                Search payee or description
              </label>
              <input
                id="financial-review-search"
                type="search"
                maxLength={80}
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.currentTarget.value)}
                placeholder="Search this review group"
              />
              <label htmlFor="financial-review-page-size">Rows per page</label>
              <select
                id="financial-review-page-size"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.currentTarget.value));
                  setPage(1);
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="financial-review-page__result-heading">
              <h3>{selectedBucket.label}</h3>
              <span aria-live="polite">
                {list
                  ? list.pagination.total.toLocaleString() + ' transactions'
                  : 'Loading transactions'}
              </span>
            </div>
            {itemsQuery.isLoading ? (
              <div className="financial-review-page__loading" role="status">
                <Spinner size={28} />
                <span>Loading transactions…</span>
              </div>
            ) : itemsQuery.isError ? (
              <Callout
                intent={Intent.DANGER}
                title="Transactions could not load"
              >
                {itemsQuery.error instanceof Error
                  ? itemsQuery.error.message
                  : 'Please retry.'}{' '}
                <button type="button" onClick={() => itemsQuery.refetch()}>
                  Retry transactions
                </button>
              </Callout>
            ) : !list?.data.length ? (
              <div className="financial-review-page__empty">
                <strong>No transactions found</strong>
                <p>
                  {search
                    ? 'Try another payee or description.'
                    : 'There are no transactions in this group.'}
                </p>
              </div>
            ) : (
              <div className="financial-review-page__items">
                {list.data.map((item) => (
                  <article
                    key={item.id}
                    className="financial-review-page__item"
                  >
                    <div className="financial-review-page__item-top">
                      <div>
                        <h4>{displayPayee(item.payee)}</h4>
                        <div className="financial-review-page__metadata">
                          <span>{formatDate(item.date)}</span>
                          <Link
                            to={
                              '/cashflow-accounts/' +
                              item.accountId +
                              '/transactions?filter=uncategorized'
                            }
                          >
                            {(item.accountName || 'Account') +
                              ' (#' +
                              item.accountId +
                              ')'}
                          </Link>
                          <span>Bank transaction #{item.id}</span>
                        </div>
                      </div>
                      <strong className="financial-review-page__amount">
                        {formatAmount(item.amount)}
                      </strong>
                    </div>
                    {displayDescription(item) && (
                      <p className="financial-review-page__description">
                        {displayDescription(item)}
                      </p>
                    )}
                    <div className="financial-review-page__status">
                      <span
                        className={
                          'financial-review-page__pill financial-review-page__pill--' +
                          (item.classification?.status || 'unresolved')
                        }
                      >
                        {
                          classificationStatusLabels[
                            item.classification?.status || 'unresolved'
                          ]
                        }{' '}
                        · unposted
                      </span>
                      {item.classification?.category && (
                        <span className="financial-review-page__pill financial-review-page__pill--suggested">
                          {item.classification.entity
                            ? item.classification.entity + ' · '
                            : ''}
                          {formatClassificationLabel(
                            item.classification.category,
                          )}
                        </span>
                      )}
                      {item.recognized && (
                        <span className="financial-review-page__pill financial-review-page__pill--linked">
                          Recognition linked
                        </span>
                      )}
                      {item.suggestion && (
                        <span className="financial-review-page__pill financial-review-page__pill--suggested">
                          Suggested: {item.suggestion}
                          {item.confidence
                            ? ' · ' + item.confidence + ' confidence'
                            : ''}
                        </span>
                      )}
                    </div>
                    {item.classification?.reason && (
                      <p className="financial-review-page__reason">
                        {item.classification.reason}
                      </p>
                    )}
                    {!item.classification?.reason && item.reason && (
                      <p className="financial-review-page__reason">
                        {item.reason}
                      </p>
                    )}
                    <div className="financial-review-page__item-actions">
                      <button
                        type="button"
                        onClick={() => openClassificationEditor(item)}
                      >
                        {item.classification?.status === 'manual'
                          ? 'Edit your label'
                          : 'Review and label'}
                      </button>
                    </div>
                    {item.flags?.length > 0 && (
                      <ul
                        className="financial-review-page__flags"
                        aria-label="Review flags"
                      >
                        {item.flags.map((flag) => (
                          <li key={flag}>{flag}</li>
                        ))}
                      </ul>
                    )}
                    <div className="financial-review-page__evidence">
                      <strong>Statement context</strong>
                      {item.evidence?.length ? (
                        <div>
                          {item.evidence.map((evidence) => (
                            <div
                              key={evidence.id}
                              className="financial-review-page__evidence-file"
                            >
                              <span>{evidence.filename}</span>
                              {/\.pdf$/i.test(evidence.filename) && (
                                <button
                                  type="button"
                                  disabled={
                                    previewingId !== null ||
                                    downloadingId !== null
                                  }
                                  onClick={() => handlePreview(evidence)}
                                  aria-label={'Preview ' + evidence.filename}
                                >
                                  {previewingId === evidence.id
                                    ? 'Opening…'
                                    : 'Preview'}
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={
                                  downloadingId !== null ||
                                  previewingId !== null
                                }
                                onClick={() => handleDownload(evidence)}
                                aria-label={'Download ' + evidence.filename}
                              >
                                {downloadingId === evidence.id
                                  ? 'Downloading…'
                                  : 'Download'}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span>
                          No source document linked to this transaction.
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <p className="financial-review-page__download-message" role="alert">
              {downloadMessage}
            </p>
            {!itemsQuery.isError && list && list.pagination.total > 0 && (
              <footer className="financial-review-page__pagination">
                <span>
                  Page {list.pagination.page} of {totalPages}
                </span>
                <div>
                  <button
                    type="button"
                    disabled={page <= 1 || itemsQuery.isFetching}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages || itemsQuery.isFetching}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </button>
                </div>
              </footer>
            )}
          </section>
          <Dialog
            isOpen={Boolean(editingItem)}
            onClose={() => !savingEdit && setEditingItem(null)}
            title={
              editingItem
                ? 'Review ' + displayPayee(editingItem.payee)
                : 'Review transaction'
            }
            className="financial-review-page__edit-dialog"
          >
            <div className="financial-review-page__edit-body">
              <p>
                {editingItem
                  ? formatDate(editingItem.date) +
                    ' · ' +
                    formatAmount(editingItem.amount)
                  : ''}{' '}
                This label is advisory. It does not post an entry to the books.
              </p>
              <label htmlFor="financial-review-entity">Belongs to</label>
              <select
                id="financial-review-entity"
                value={editEntity}
                onChange={(event) =>
                  setEditEntity(event.currentTarget.value as typeof editEntity)
                }
              >
                <option value="Personal">Personal / household</option>
                <option value="Business">
                  {policyQuery.data?.businessName || 'Business'}
                </option>
                <option value="W2">W2 employment</option>
              </select>
              <label htmlFor="financial-review-category">Category</label>
              <input
                id="financial-review-category"
                list="financial-review-category-options"
                value={editCategory}
                maxLength={80}
                onChange={(event) => setEditCategory(event.currentTarget.value)}
                placeholder="e.g. household_food or hosting"
              />
              <datalist id="financial-review-category-options">
                <option value="household_food" />
                <option value="household_general" />
                <option value="hosting" />
                <option value="domains" />
                <option value="ai_software" />
                <option value="computer_hardware" />
                <option value="office_expense" />
                <option value="utilities" />
                <option value="transfer" />
                <option value="income" />
              </datalist>
              <p className="financial-review-page__edit-error" role="alert">
                {editError}
              </p>
              <div className="financial-review-page__edit-actions">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={saveClassification}
                >
                  {savingEdit ? 'Saving…' : 'Save reviewed label'}
                </button>
              </div>
            </div>
          </Dialog>
          <Dialog
            isOpen={Boolean(preview)}
            onClose={() => setPreview(null)}
            title={preview?.filename || 'Statement preview'}
            className="financial-review-page__preview-dialog"
          >
            <div className="financial-review-page__preview-body">
              <p>
                Statement-level source context. Confirm the matching line and
                amount before posting.
              </p>
              {preview && (
                <iframe
                  src={preview.url}
                  title={'Preview of ' + preview.filename}
                />
              )}
            </div>
          </Dialog>
        </main>
      </DashboardPageContent>
    </DashboardInsider>
  );
}

import {
  Button,
  Callout,
  Card,
  InputGroup,
  Intent,
  Spinner,
} from '@blueprintjs/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';

interface Activity {
  id: number;
  sourceId: string;
  occurredAtUtc: string;
  transactionType: string;
  asset: string;
  quantity: string;
  priceCurrency: string;
  priceAtTransaction: string | null;
  subtotal: string | null;
  totalInclusive: string | null;
  feesOrSpread: string | null;
  notes: string | null;
  senderAddress: string | null;
  recipientAddress: string | null;
}

interface ActivityPage {
  activities: Activity[];
  total: number;
  page: number;
  pageSize: number;
}

function read(row: Record<string, any>, camel: string, snake: string) {
  return row[camel] ?? row[snake] ?? null;
}

function normalizeActivity(row: Record<string, any>): Activity {
  return {
    id: row.id,
    sourceId: read(row, 'sourceId', 'source_id'),
    occurredAtUtc: read(row, 'occurredAtUtc', 'occurred_at_utc'),
    transactionType: read(row, 'transactionType', 'transaction_type'),
    asset: row.asset,
    quantity: row.quantity,
    priceCurrency: read(row, 'priceCurrency', 'price_currency'),
    priceAtTransaction: read(row, 'priceAtTransaction', 'price_at_transaction'),
    subtotal: row.subtotal,
    totalInclusive: read(row, 'totalInclusive', 'total_inclusive'),
    feesOrSpread: read(row, 'feesOrSpread', 'fees_or_spread'),
    notes: row.notes,
    senderAddress: read(row, 'senderAddress', 'sender_address'),
    recipientAddress: read(row, 'recipientAddress', 'recipient_address'),
  };
}

function displayAmount(value: string | null, kind: 'price' | 'money') {
  if (value === null) return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const maxDigits =
    kind === 'price' || (numeric !== 0 && Math.abs(numeric) < 0.01) ? 8 : 2;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: kind === 'money' && maxDigits === 2 ? 2 : 0,
    maximumFractionDigits: maxDigits,
  }).format(numeric);
}

function errorMessage(payload: any, fallback: string) {
  if (typeof payload?.message === 'string') return payload.message;
  if (Array.isArray(payload?.message)) return payload.message.join(' ');
  return fallback;
}

export function CoinbaseActivityPanel() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const headers = {
    Authorization: 'Bearer ' + token,
    'organization-id': organizationId || '',
    Accept: 'application/json',
  };
  const activityQuery = useQuery({
    queryKey: ['coinbase-activity', organizationId, page],
    enabled: Boolean(token && organizationId),
    queryFn: async (): Promise<ActivityPage> => {
      const response = await fetch('/api/coinbase-activity?page=' + page, {
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          errorMessage(json, 'Coinbase activity could not be loaded.'),
        );
      }
      const payload = json?.data ?? json;
      return {
        activities: (payload?.activities ?? []).map(normalizeActivity),
        total: Number(payload?.total ?? 0),
        page: Number(payload?.page ?? page),
        pageSize: Number(payload?.pageSize ?? payload?.page_size ?? 250),
      };
    },
  });

  async function importFile() {
    if (!file) return;
    setImporting(true);
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/coinbase-activity/import', {
        method: 'POST',
        headers,
        body: form,
        credentials: 'same-origin',
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          errorMessage(json, 'Coinbase CSV could not be imported.'),
        );
      }
      const result = json?.data ?? json;
      setMessage(
        'Coinbase history: ' +
          result.imported +
          ' imported, ' +
          result.skipped +
          ' already present, ' +
          result.total +
          ' rows in the file.',
      );
      setFile(null);
      setPage(1);
      await queryClient.invalidateQueries({
        queryKey: ['coinbase-activity', organizationId],
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Coinbase CSV could not be imported.',
      );
    } finally {
      setImporting(false);
    }
  }

  const data = activityQuery.data;
  const term = search.trim().toLowerCase();
  const shown = (data?.activities ?? []).filter(
    (activity) =>
      !term ||
      [
        activity.transactionType,
        activity.asset,
        activity.sourceId,
        activity.notes,
      ].some((value) => value?.toLowerCase().includes(term)),
  );
  const pageCount = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <Card className="freebooks-crypto__exchange">
      <span className="freebooks-eyebrow">EXCHANGE ACTIVITY</span>
      <h2>Coinbase history</h2>
      <p>
        Import the transaction history CSV downloaded from Coinbase. Each entry
        keeps its Coinbase ID, exact asset quantity, USD values, and fees or
        spread. This is a read-only record for review; it does not create ledger
        entries.
      </p>
      <div className="freebooks-crypto__import">
        <label htmlFor="coinbase-csv">Coinbase transactions CSV</label>
        <input
          id="coinbase-csv"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <Button
          intent={Intent.PRIMARY}
          disabled={!file || importing}
          loading={importing}
          onClick={() => void importFile()}
        >
          Import history
        </Button>
      </div>
      {error && (
        <Callout intent={Intent.DANGER} className="freebooks-crypto__notice">
          {error}
        </Callout>
      )}
      {message && (
        <Callout intent={Intent.SUCCESS} className="freebooks-crypto__notice">
          {message}
        </Callout>
      )}
      <div className="freebooks-crypto__activity-header">
        <div>
          <h3>Transactions {data ? '(' + data.total + ')' : ''}</h3>
          <p className="freebooks-crypto__small">
            Sorted newest first. Reimporting the same export skips existing
            Coinbase IDs.
          </p>
        </div>
        <InputGroup
          aria-label="Search Coinbase activity on this page"
          placeholder="Search type, asset, ID, or notes"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {activityQuery.isLoading && <Spinner size={24} />}
      {activityQuery.isError && (
        <Callout intent={Intent.DANGER}>
          Coinbase activity could not be loaded.
        </Callout>
      )}
      {!activityQuery.isLoading && !activityQuery.isError && !data?.total && (
        <p>No Coinbase history has been imported yet.</p>
      )}
      {Boolean(data?.total) && (
        <>
          <div className="freebooks-crypto__activity-scroll">
            <table className="freebooks-crypto__activity-table">
              <thead>
                <tr>
                  <th>Date (UTC)</th>
                  <th>Activity</th>
                  <th>Asset</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th>Fees / spread</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((activity) => (
                  <tr key={activity.sourceId}>
                    <td>
                      {activity.occurredAtUtc
                        .replace('T', ' ')
                        .replace('Z', '')}
                    </td>
                    <td>{activity.transactionType}</td>
                    <td>{activity.asset}</td>
                    <td className="freebooks-crypto__amount">
                      {activity.quantity}
                    </td>
                    <td className="freebooks-crypto__amount">
                      {displayAmount(activity.priceAtTransaction, 'price')}{' '}
                      {activity.priceCurrency}
                    </td>
                    <td className="freebooks-crypto__amount">
                      {displayAmount(activity.totalInclusive, 'money')}{' '}
                      {activity.priceCurrency}
                    </td>
                    <td className="freebooks-crypto__amount">
                      {displayAmount(activity.feesOrSpread, 'money')}{' '}
                      {activity.priceCurrency}
                    </td>
                    <td className="freebooks-crypto__details">
                      <span title={activity.sourceId}>
                        ID {activity.sourceId}
                      </span>
                      {activity.notes && <span>{activity.notes}</span>}
                      {activity.senderAddress && (
                        <span>From {activity.senderAddress}</span>
                      )}
                      {activity.recipientAddress && (
                        <span>To {activity.recipientAddress}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {term && !shown.length && (
            <p>No transactions on this page match your search.</p>
          )}
          {pageCount > 1 && (
            <div className="freebooks-crypto__actions">
              <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span>
                Page {page} of {pageCount}
              </span>
              <Button
                disabled={page >= pageCount}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      <p className="freebooks-crypto__small">
        Need a new export?{' '}
        <a
          href="https://help.coinbase.com/en/coinbase/taxes/tools/statements"
          target="_blank"
          rel="noopener noreferrer"
        >
          Coinbase export instructions
        </a>
        {' · '}
        <Link to="/source-documents">Store a statement PDF</Link>
      </p>
    </Card>
  );
}

import { Button, Callout, Card, Intent, Tag } from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';
import { downloadFile } from '@/hooks/useDownloadFile';
import './PlaidDataExportPanel.scss';

interface PlaidExportManifest {
  schemaVersion: number;
  generatedAt: string;
  environment: string;
  note: string;
  counts: {
    items: number;
    accounts: number;
    transactions: number;
  };
  accounts: Array<{
    id: number;
    name: string;
    accountMask: string | null;
    balanceAtLastSync: number | null;
    currencyCode: string | null;
    lastSyncedAt: string | null;
  }>;
}

function readableDate(value: string | null) {
  if (!value) return 'No completed sync recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Sync date unavailable'
    : 'Last stored sync ' + date.toLocaleString();
}

export function PlaidDataExportPanel() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const [busyFormat, setBusyFormat] = useState<'json' | 'csv' | null>(null);
  const [refreshingAccountId, setRefreshingAccountId] = useState<number | null>(
    null,
  );
  const [message, setMessage] = useState('');

  const authHeaders = {
    Authorization: 'Bearer ' + token,
    'organization-id': organizationId || '',
  };

  const manifestQuery = useQuery({
    queryKey: ['plaid-stored-export-manifest', organizationId],
    enabled: Boolean(token && organizationId),
    queryFn: async (): Promise<PlaidExportManifest> => {
      const response = await fetch('/api/banking/plaid/export/manifest', {
        headers: { ...authHeaders, Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Plaid snapshot could not be loaded.');
      const result = await response.json();
      return (result.data || result) as PlaidExportManifest;
    },
  });

  const download = async (format: 'json' | 'csv') => {
    setBusyFormat(format);
    setMessage('');
    try {
      const response = await fetch(
        '/api/banking/plaid/export?format=' + format,
        {
          headers: {
            ...authHeaders,
            Accept: format === 'json' ? 'application/json' : 'text/csv',
          },
          credentials: 'same-origin',
          cache: 'no-store',
        },
      );
      if (!response.ok) throw new Error('Export download failed.');
      const blob = await response.blob();
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(
        blob,
        'freebooks-plaid-stored-' + date + '.' + format,
        format === 'json' ? 'application/json' : 'text/csv',
      );
      setMessage('Stored Plaid snapshot downloaded. Keep this file private.');
    } catch {
      setMessage(
        'Export could not be downloaded. Retry after the service is available.',
      );
    } finally {
      setBusyFormat(null);
    }
  };

  const requestRefresh = async (accountId: number) => {
    setRefreshingAccountId(accountId);
    setMessage('');
    try {
      const response = await fetch(
        '/api/banking/accounts/' + accountId + '/refresh',
        {
          method: 'POST',
          headers: { ...authHeaders, Accept: 'application/json' },
          credentials: 'same-origin',
        },
      );
      if (!response.ok) throw new Error('Refresh request failed.');
      setMessage(
        'Plaid refresh requested. It runs asynchronously; return later and check the last stored sync time before exporting.',
      );
    } catch {
      setMessage(
        'Plaid could not accept the refresh request. No stored data was changed.',
      );
    } finally {
      setRefreshingAccountId(null);
    }
  };

  const manifest = manifestQuery.data;

  return (
    <Card className="freebooks-plaid-export">
      <div className="freebooks-plaid-export__header">
        <div>
          <span className="freebooks-plaid-export__eyebrow">Your data</span>
          <h2>Plaid connections &amp; export</h2>
          <p>
            See what FreeBooks has actually stored, request a feed refresh, and
            take your records with you.
          </p>
        </div>
        {manifest && (
          <Tag
            intent={
              manifest.environment === 'production'
                ? Intent.SUCCESS
                : Intent.WARNING
            }
          >
            {manifest.environment.toUpperCase()}
          </Tag>
        )}
      </div>

      {manifestQuery.isLoading && <p>Checking stored Plaid data...</p>}
      {manifestQuery.isError && (
        <Callout intent={Intent.WARNING} title="Plaid status unavailable">
          The snapshot could not be loaded.
          <Button minimal small onClick={() => manifestQuery.refetch()}>
            Retry
          </Button>
        </Callout>
      )}

      {manifest && (
        <>
          {manifest.environment !== 'production' && (
            <Callout intent={Intent.WARNING} title="Test environment">
              This server is configured for {manifest.environment}. Real bank
              connections require an approved Plaid Production configuration.
            </Callout>
          )}
          <div className="freebooks-plaid-export__counts">
            <div>
              <strong>{manifest.counts.items.toLocaleString()}</strong>
              <span>Connected items stored</span>
            </div>
            <div>
              <strong>{manifest.counts.accounts.toLocaleString()}</strong>
              <span>Bank or card accounts stored</span>
            </div>
            <div>
              <strong>{manifest.counts.transactions.toLocaleString()}</strong>
              <span>Plaid-origin review rows stored</span>
            </div>
          </div>
          <p className="freebooks-plaid-export__note">
            Snapshot generated{' '}
            {readableDate(manifest.generatedAt).replace(
              'Last stored sync ',
              '',
            )}
            . These are stored records, not live balances. Export excludes
            access tokens, credentials, and sync cursors.
          </p>
          {manifest.accounts.length > 0 ? (
            <div className="freebooks-plaid-export__accounts">
              <h3>Stored account feeds</h3>
              {manifest.accounts.map((account) => (
                <div
                  key={account.id}
                  className="freebooks-plaid-export__account"
                >
                  <div>
                    <strong>{account.name}</strong>
                    <small>
                      {account.accountMask
                        ? 'Ending ' + account.accountMask + ' · '
                        : ''}
                      {readableDate(account.lastSyncedAt)}
                      {account.balanceAtLastSync !== null &&
                        ' · Stored balance ' +
                          new Intl.NumberFormat(undefined, {
                            style: 'currency',
                            currency: account.currencyCode || 'USD',
                          }).format(account.balanceAtLastSync)}
                    </small>
                  </div>
                  <Button
                    small
                    loading={refreshingAccountId === account.id}
                    disabled={refreshingAccountId !== null}
                    onClick={() => requestRefresh(account.id)}
                  >
                    Refresh from Plaid
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="freebooks-plaid-export__empty">
              No Plaid accounts are stored in this workspace yet. You can still
              import a bank CSV and keep statement PDFs as source evidence.
            </p>
          )}
          <div className="freebooks-plaid-export__actions">
            <Button
              icon="download"
              intent={Intent.PRIMARY}
              loading={busyFormat === 'json'}
              disabled={busyFormat !== null}
              onClick={() => download('json')}
            >
              Export JSON snapshot
            </Button>
            <Button
              icon="download"
              loading={busyFormat === 'csv'}
              disabled={busyFormat !== null}
              onClick={() => download('csv')}
            >
              Export transactions CSV
            </Button>
            <Link to="/source-documents">Review statement evidence</Link>
          </div>
          <p className="freebooks-plaid-export__note">
            {manifest.note} The CSV contains stored Plaid-origin review rows; it
            is not a tax report or a full ledger export.
          </p>
        </>
      )}
      {message && (
        <p className="freebooks-plaid-export__message" role="status">
          {message}
        </p>
      )}
    </Card>
  );
}

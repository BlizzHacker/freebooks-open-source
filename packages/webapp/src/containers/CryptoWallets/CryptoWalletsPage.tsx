import {
  Button,
  Callout,
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
import { CoinbaseActivityPanel } from './CoinbaseActivityPanel';
import './CryptoWalletsPage.scss';

interface TokenBalance {
  mint: string;
  rawAmount: string;
  decimals: number;
}

interface CryptoWallet {
  id: number;
  label: string;
  network: string;
  provider: 'phantom' | 'manual';
  address: string;
  lastBalanceLamports: string | null;
  tokenBalances: TokenBalance[];
  tokenSnapshotTruncated: boolean;
  lastSyncedAt: string | null;
}
function normalizeWallet(value: Record<string, any>): CryptoWallet {
  return {
    id: value.id,
    label: value.label,
    network: value.network,
    provider: value.provider,
    address: value.address,
    lastBalanceLamports:
      value.lastBalanceLamports ?? value.last_balance_lamports ?? null,
    tokenBalances: (value.tokenBalances ?? value.token_balances ?? []).map(
      (token: Record<string, any>) => ({
        mint: token.mint,
        rawAmount: token.rawAmount ?? token.raw_amount,
        decimals: token.decimals,
      }),
    ),
    tokenSnapshotTruncated: Boolean(
      value.tokenSnapshotTruncated ?? value.token_snapshot_truncated,
    ),
    lastSyncedAt: value.lastSyncedAt ?? value.last_synced_at ?? null,
  };
}

interface SolanaProvider {
  isPhantom?: boolean;
  connect(): Promise<{ publicKey: { toString(): string } }>;
}
declare global {
  interface Window {
    phantom?: { solana?: SolanaProvider };
  }
}

function formatSol(lamports: string | null) {
  if (lamports === null) return 'Not refreshed';
  try {
    const amount = BigInt(lamports);
    const whole = (amount / BigInt(1000000000))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const fraction = (amount % BigInt(1000000000))
      .toString()
      .padStart(9, '0')
      .replace(/0+$/, '');
    return whole + (fraction ? '.' + fraction : '') + ' SOL';
  } catch {
    return 'Balance unavailable';
  }
}

function formatToken(rawAmount: string, decimals: number) {
  try {
    const raw = BigInt(rawAmount);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30)
      return rawAmount;
    const factor = BigInt(10) ** BigInt(decimals);
    const whole = (raw / factor)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const fraction = decimals
      ? (raw % factor).toString().padStart(decimals, '0').replace(/0+$/, '')
      : '';
    return whole + (fraction ? '.' + fraction : '');
  } catch {
    return rawAmount;
  }
}

function messageFromResponse(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return fallback;
}

export function CryptoWalletsPage() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const headers = {
    Authorization: 'Bearer ' + token,
    'organization-id': organizationId || '',
    Accept: 'application/json',
  };

  async function api<T>(
    path: string,
    method = 'GET',
    body?: object,
  ): Promise<T> {
    const response = await fetch('/api/crypto-wallets' + path, {
      method,
      headers: {
        ...headers,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(messageFromResponse(payload, 'Wallet request failed.'));
    }
    return (payload?.data ?? payload) as T;
  }

  const walletsQuery = useQuery({
    queryKey: ['crypto-wallets', organizationId],
    enabled: Boolean(token && organizationId),
    queryFn: async () =>
      (await api<Record<string, any>[]>('')).map(normalizeWallet),
  });

  async function addWallet(
    walletAddress: string,
    provider: 'phantom' | 'manual',
  ) {
    setBusy('add');
    setError('');
    setMessage('');
    try {
      const saved = await api<Record<string, any>>('', 'POST', {
        label:
          label.trim() ||
          (provider === 'phantom' ? 'Phantom wallet' : 'Solana wallet'),
        address: walletAddress.trim(),
        provider,
      });
      setAddress('');
      setLabel('');
      setMessage(
        provider === 'phantom'
          ? 'Phantom public address saved. Refresh to read its Solana holdings.'
          : 'Public address saved as watch-only. Refresh to read its Solana holdings.',
      );
      await queryClient.invalidateQueries({
        queryKey: ['crypto-wallets', organizationId],
      });
      return normalizeWallet(saved);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Wallet could not be added.',
      );
      return null;
    } finally {
      setBusy('');
    }
  }

  async function connectPhantom() {
    const provider = window.phantom?.solana;
    if (!provider?.isPhantom) {
      setError(
        'Open FreeBooks in a browser with Phantom installed, or use Phantom’s in-app browser. You can also paste a public address below.',
      );
      return;
    }
    setBusy('phantom');
    setError('');
    setMessage('');
    try {
      // Phantom itself displays and handles the user’s connection approval.
      // FreeBooks only receives the public address; no signing or transaction API is used.
      const { publicKey } = await provider.connect();
      const walletAddress = publicKey?.toString();
      if (!walletAddress)
        throw new Error('Phantom did not return a public address.');
      await addWallet(walletAddress, 'phantom');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Phantom connection was cancelled or unavailable.',
      );
    } finally {
      setBusy('');
    }
  }

  async function refresh(wallet: CryptoWallet) {
    setBusy('refresh-' + wallet.id);
    setError('');
    setMessage('');
    try {
      await api<CryptoWallet>('/' + wallet.id + '/refresh', 'POST');
      await queryClient.invalidateQueries({
        queryKey: ['crypto-wallets', organizationId],
      });
      setMessage(wallet.label + ' holdings refreshed from Solana mainnet.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Balance refresh failed.',
      );
    } finally {
      setBusy('');
    }
  }

  async function remove(wallet: CryptoWallet) {
    if (
      !window.confirm(
        'Stop tracking ' +
          wallet.label +
          '? This removes its saved public address and holdings snapshot from FreeBooks.',
      )
    )
      return;
    setBusy('remove-' + wallet.id);
    setError('');
    setMessage('');
    try {
      await api('/' + wallet.id, 'DELETE');
      await queryClient.invalidateQueries({
        queryKey: ['crypto-wallets', organizationId],
      });
      setMessage(wallet.label + ' removed from tracking.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Wallet could not be removed.',
      );
    } finally {
      setBusy('');
    }
  }

  return (
    <DashboardInsider name="crypto-wallets">
      <DashboardPageContent>
        <main className="freebooks-crypto">
          <header className="freebooks-crypto__hero">
            <span className="freebooks-eyebrow">CRYPTO / READ ONLY</span>
            <h1>Wallets</h1>
            <p>
              Track your Solana public addresses and dated SOL and token
              balances in FreeBooks. Phantom approval shares only a public
              address. FreeBooks never asks for a recovery phrase or private key
              and cannot move funds.
            </p>
          </header>

          {error && (
            <Callout
              intent={Intent.DANGER}
              className="freebooks-crypto__notice"
            >
              {error}
            </Callout>
          )}
          {message && (
            <Callout
              intent={Intent.SUCCESS}
              className="freebooks-crypto__notice"
            >
              {message}
            </Callout>
          )}

          <div className="freebooks-crypto__layout">
            <Card className="freebooks-crypto__connect">
              <h2>Connect Phantom</h2>
              <p>
                Use the Phantom extension or open this page in Phantom’s mobile
                browser, then approve the connection in Phantom.
              </p>
              <Button
                intent={Intent.PRIMARY}
                loading={busy === 'phantom' || busy === 'add'}
                onClick={connectPhantom}
              >
                Connect Phantom public address
              </Button>
              <div className="freebooks-crypto__divider">
                Or track an address manually
              </div>
              <label htmlFor="crypto-wallet-label">Wallet name</label>
              <InputGroup
                id="crypto-wallet-label"
                value={label}
                maxLength={80}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. My Phantom wallet"
              />
              <label htmlFor="crypto-wallet-address">
                Solana public address
              </label>
              <InputGroup
                id="crypto-wallet-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Base58 public address only"
                autoComplete="off"
              />
              <Button
                disabled={!address.trim() || Boolean(busy)}
                onClick={() => void addWallet(address, 'manual')}
              >
                Track public address
              </Button>
              <p className="freebooks-crypto__small">
                Every address is tracked read-only. A Phantom-selected address
                does not cryptographically prove ownership. Never paste a seed
                phrase here.
              </p>
            </Card>

            <section
              className="freebooks-crypto__wallets"
              aria-label="Tracked wallets"
            >
              <h2>Tracked wallets</h2>
              {walletsQuery.isLoading && <Spinner size={24} />}
              {walletsQuery.isError && (
                <Callout intent={Intent.DANGER}>
                  Wallets could not be loaded.
                </Callout>
              )}
              {!walletsQuery.isLoading &&
                !walletsQuery.isError &&
                !(walletsQuery.data || []).length && (
                  <Card>
                    <p>No wallet addresses are connected yet.</p>
                  </Card>
                )}
              {(walletsQuery.data || []).map((wallet) => (
                <Card key={wallet.id} className="freebooks-crypto__wallet">
                  <div className="freebooks-crypto__wallet-head">
                    <div>
                      <h3>{wallet.label}</h3>
                      <Tag minimal>
                        {wallet.provider === 'phantom'
                          ? 'Selected in Phantom'
                          : 'Watch-only'}
                      </Tag>
                    </div>
                    <strong>{formatSol(wallet.lastBalanceLamports)}</strong>
                  </div>
                  <code className="freebooks-crypto__address">
                    {wallet.address}
                  </code>
                  <p className="freebooks-crypto__small">
                    {wallet.lastSyncedAt
                      ? 'Holdings checked ' +
                        new Date(wallet.lastSyncedAt).toLocaleString()
                      : 'No balance check yet'}
                    . Values are token quantities only. No prices, cost basis,
                    transfers, or compressed NFTs.
                  </p>
                  {wallet.tokenBalances?.length > 0 && (
                    <div className="freebooks-crypto__tokens">
                      <h4>Token mints ({wallet.tokenBalances.length})</h4>
                      {wallet.tokenBalances.map((token) => (
                        <div
                          className="freebooks-crypto__token"
                          key={token.mint}
                        >
                          <code title={token.mint}>{token.mint}</code>
                          <strong>
                            {formatToken(token.rawAmount, token.decimals)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                  {wallet.tokenSnapshotTruncated && (
                    <Callout intent={Intent.WARNING}>
                      This wallet has more token accounts than the current
                      snapshot limit. Balances shown here are incomplete.
                    </Callout>
                  )}
                  <div className="freebooks-crypto__actions">
                    <Button
                      small
                      loading={busy === 'refresh-' + wallet.id}
                      onClick={() => void refresh(wallet)}
                    >
                      Refresh holdings
                    </Button>
                    <Button
                      small
                      minimal
                      intent={Intent.DANGER}
                      loading={busy === 'remove-' + wallet.id}
                      onClick={() => void remove(wallet)}
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </section>
          </div>
          <CoinbaseActivityPanel />
        </main>
      </DashboardPageContent>
    </DashboardInsider>
  );
}

import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { CryptoWallet } from './CryptoWallet.model';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const TOKEN_PROGRAMS = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
];
const MAX_RPC_BYTES = 2 * 1024 * 1024;
const MAX_TOKEN_ACCOUNTS = 1000;
const MAX_MINTS = 250;

interface TokenBalance {
  mint: string;
  rawAmount: string;
  decimals: number;
}

async function solanaRpc(method: string, params: unknown[]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body)
      throw new Error('Solana RPC unavailable.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RPC_BYTES) {
        await reader.cancel();
        throw new Error('Solana RPC response exceeded limit.');
      }
      chunks.push(value);
    }
    const json = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      result?: unknown;
      error?: unknown;
    };
    if (json.error || !json.result)
      throw new Error('Solana RPC returned an error.');
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

function tokenBalances(results: unknown[]): {
  balances: TokenBalance[];
  truncated: boolean;
} {
  const byMint = new Map<string, { amount: bigint; decimals: number }>();
  let seen = 0;
  let truncated = false;
  for (const result of results) {
    const records = (result as { value?: unknown })?.value;
    if (!Array.isArray(records))
      throw new Error('Invalid token account response.');
    for (const record of records) {
      seen += 1;
      if (seen > MAX_TOKEN_ACCOUNTS) {
        truncated = true;
        break;
      }
      const info = record?.account?.data?.parsed?.info;
      const mint = info?.mint;
      const rawAmount = info?.tokenAmount?.amount;
      const decimals = info?.tokenAmount?.decimals;
      if (
        typeof mint !== 'string' ||
        !isSolanaAddress(mint) ||
        typeof rawAmount !== 'string' ||
        !/^\d{1,80}$/.test(rawAmount) ||
        !Number.isInteger(decimals) ||
        decimals < 0 ||
        decimals > 30
      ) {
        continue;
      }
      const amount = BigInt(rawAmount);
      if (amount === 0n) continue;
      const current = byMint.get(mint);
      if (current) {
        if (current.decimals !== decimals) continue;
        current.amount += amount;
      } else if (byMint.size < MAX_MINTS) {
        byMint.set(mint, { amount, decimals });
      } else {
        truncated = true;
      }
    }
  }
  return {
    balances: Array.from(byMint, ([mint, value]) => ({
      mint,
      rawAmount: String(value.amount),
      decimals: value.decimals,
    })).sort((left, right) => left.mint.localeCompare(right.mint)),
    truncated,
  };
}

function isSolanaAddress(address: string): boolean {
  if (address.length < 32 || address.length > 44) return false;
  let value = 0n;
  for (const character of address) {
    const digit = ALPHABET.indexOf(character);
    if (digit < 0) return false;
    value = value * 58n + BigInt(digit);
  }
  let bytes = 0;
  while (value > 0n) {
    value >>= 8n;
    bytes += 1;
  }
  for (const character of address) {
    if (character !== '1') break;
    bytes += 1;
  }
  return bytes === 32;
}

function present(wallet: CryptoWallet) {
  return {
    id: wallet.id,
    label: wallet.label,
    network: wallet.network,
    provider: wallet.provider,
    address: wallet.address,
    lastBalanceLamports: wallet.lastBalanceLamports ?? null,
    tokenBalances: wallet.tokenBalancesJson
      ? (JSON.parse(wallet.tokenBalancesJson) as TokenBalance[])
      : [],
    tokenSnapshotTruncated: Boolean(wallet.tokenSnapshotTruncated),
    lastSyncedAt: wallet.lastSyncedAt ?? null,
  };
}

@Injectable()
export class CryptoWalletsService {
  constructor(
    @Inject(CryptoWallet.name)
    private readonly walletModel: TenantModelProxy<typeof CryptoWallet>,
  ) {}

  async list() {
    const wallets = await this.walletModel()
      .query()
      .orderBy('id', 'desc')
      .limit(100);
    return wallets.map(present);
  }

  async add(rawLabel: unknown, rawAddress: unknown, rawProvider: unknown) {
    const label = typeof rawLabel === 'string' ? rawLabel.trim() : '';
    const address = typeof rawAddress === 'string' ? rawAddress.trim() : '';
    const provider = rawProvider === 'phantom' ? 'phantom' : 'manual';
    if (!label || label.length > 80) {
      throw new BadRequestException('Wallet name must be 1–80 characters.');
    }
    if (!isSolanaAddress(address)) {
      throw new BadRequestException('Enter a valid Solana public address.');
    }
    const addressHash = createHash('sha256').update(address).digest('hex');
    const existing = await this.walletModel()
      .query()
      .findOne('addressHash', addressHash);
    if (existing) {
      throw new ConflictException('This address is already tracked.');
    }
    try {
      const wallet = await this.walletModel().query().insertAndFetch({
        label,
        address,
        addressHash,
        provider,
        network: 'solana-mainnet',
      });
      return present(wallet);
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ConflictException('This address is already tracked.');
      }
      throw error;
    }
  }

  async remove(id: number) {
    const removed = await this.walletModel().query().deleteById(id);
    if (!removed) throw new NotFoundException('Wallet not found.');
    return { removed: true };
  }

  async refresh(id: number) {
    const wallet = await this.walletModel().query().findById(id);
    if (!wallet) throw new NotFoundException('Wallet not found.');
    let lamports: number;
    let tokens: ReturnType<typeof tokenBalances>;
    try {
      const [balanceResult, ...tokenResults] = await Promise.all([
        solanaRpc('getBalance', [wallet.address, { commitment: 'finalized' }]),
        ...TOKEN_PROGRAMS.map((programId) =>
          solanaRpc('getTokenAccountsByOwner', [
            wallet.address,
            { programId },
            { commitment: 'finalized', encoding: 'jsonParsed' },
          ]),
        ),
      ]);
      const value = (balanceResult as { value?: unknown }).value;
      if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 0
      ) {
        throw new Error('Invalid Solana balance response.');
      }
      lamports = value;
      tokens = tokenBalances(tokenResults);
    } catch {
      throw new BadGatewayException(
        'Solana holdings could not be refreshed. The previous snapshot was kept.',
      );
    }
    const refreshed = await this.walletModel()
      .query()
      .patchAndFetchById(id, {
        lastBalanceLamports: String(lamports),
        tokenBalancesJson: JSON.stringify(tokens.balances),
        tokenSnapshotTruncated: tokens.truncated,
        lastSyncedAt: new Date(),
      });
    return present(refreshed);
  }
}

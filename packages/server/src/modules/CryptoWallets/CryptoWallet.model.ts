import { BaseModel } from '@/models/Model';

export class CryptoWallet extends BaseModel {
  label!: string;
  network!: string;
  provider!: string;
  address!: string;
  addressHash!: string;
  lastBalanceLamports?: string | null;
  tokenBalancesJson?: string | null;
  tokenSnapshotTruncated?: boolean;
  lastSyncedAt?: Date | null;

  static get tableName() {
    return 'crypto_wallets';
  }
}

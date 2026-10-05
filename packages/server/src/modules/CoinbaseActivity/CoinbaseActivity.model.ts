import { BaseModel } from '@/models/Model';

export class CoinbaseActivity extends BaseModel {
  sourceId!: string;
  occurredAtUtc!: string;
  transactionType!: string;
  asset!: string;
  quantity!: string;
  priceCurrency!: string;
  priceAtTransaction?: string | null;
  subtotal?: string | null;
  totalInclusive?: string | null;
  feesOrSpread?: string | null;
  notes?: string | null;
  senderAddress?: string | null;
  recipientAddress?: string | null;

  static get tableName() {
    return 'coinbase_activities';
  }
}

import { BaseModel } from '@/models/Model';

export class CryptoCheckoutAttempt extends BaseModel {
  id!: number;
  requestKey!: string;
  paymentLinkId!: string;
  saleInvoiceId!: number;
  checkoutId!: string;
  checkoutUrl!: string;
  amountMinor!: number;
  currency!: string;
  providerStatus!: string;
  status!: 'pending' | 'recorded' | 'review';
  transactionHash?: string;
  settlementTotal?: string;
  settlementFee?: string;
  settlementNet?: string;
  settlementCurrency?: string;
  paymentReceivedId?: number;

  static get tableName() {
    return 'crypto_checkout_attempts';
  }

  static get idColumn() {
    return 'id';
  }
}

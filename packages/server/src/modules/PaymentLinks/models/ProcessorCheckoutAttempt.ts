import { BaseModel } from '@/models/Model';

export class ProcessorCheckoutAttempt extends BaseModel {
  id!: number;
  requestKey!: string;
  paymentLinkId!: string;
  saleInvoiceId!: number;
  paymentIntegrationId!: number;
  provider!: 'Square' | 'PayPal';
  providerOrderId!: string;
  providerPaymentId?: string;
  checkoutUrl!: string;
  amountMinor!: number;
  currency!: string;
  status!: 'pending' | 'recorded';
  paymentReceivedId?: number;

  static get tableName() {
    return 'processor_checkout_attempts';
  }

  static get idColumn() {
    return 'id';
  }
}

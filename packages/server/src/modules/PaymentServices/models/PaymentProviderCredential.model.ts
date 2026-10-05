import { BaseModel } from '@/models/Model';

export class PaymentProviderCredential extends BaseModel {
  paymentIntegrationId!: number;
  encryptedCredentials!: string;

  static get tableName() {
    return 'payment_provider_credentials';
  }

  static get idColumn() {
    return 'id';
  }
}

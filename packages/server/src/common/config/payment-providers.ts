import { registerAs } from '@nestjs/config';

export default registerAs('paymentProviders', () => ({
  encryptionKey: process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY,
}));

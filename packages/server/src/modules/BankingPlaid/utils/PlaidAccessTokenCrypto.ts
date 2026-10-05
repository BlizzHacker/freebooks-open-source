import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const PREFIX = 'enc:v1:';

const getKey = (): Buffer => {
  const secret = process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('Financial provider encryption is not configured.');
  }
  return createHash('sha256').update(secret, 'utf8').digest();
};

export const encryptPlaidAccessToken = (token: string): string => {
  if (token.startsWith(PREFIX)) return token;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  return `${PREFIX}${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
};

export const decryptPlaidAccessToken = (value: string): string => {
  // Preserve compatibility with items created before token encryption was enabled.
  if (!value.startsWith(PREFIX)) return value;
  const [ivValue, tagValue, encryptedValue] = value
    .slice(PREFIX.length)
    .split('.');
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error(
      'Stored Plaid access token has an invalid encrypted format.',
    );
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

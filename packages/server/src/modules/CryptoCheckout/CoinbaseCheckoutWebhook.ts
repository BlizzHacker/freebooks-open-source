import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Coinbase Business Checkout webhooks use the X-Hook0-Signature header.
 * Keep the exact raw request bytes: JSON serialization changes the signature.
 */
export function verifyCoinbaseCheckoutWebhook(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  secret: string | undefined,
  headers: Record<string, string | string[] | undefined>,
  now = Date.now(),
): boolean {
  if (!rawBody || !Buffer.isBuffer(rawBody) || !signatureHeader || !secret) {
    return false;
  }
  const parts = Object.fromEntries(
    signatureHeader
      .split(',')
      .map((part) => part.trim().split(/=(.*)/s).slice(0, 2)),
  );
  const timestamp = parts.t;
  const signedHeaderNames = parts.h;
  const providedHex = parts.v1;
  if (
    !/^\d{10}$/.test(timestamp || '') ||
    !/^[a-z0-9-]+(?: [a-z0-9-]+)*$/i.test(signedHeaderNames || '') ||
    !/^[a-f0-9]{64}$/i.test(providedHex || '')
  ) {
    return false;
  }
  if (Math.abs(now - Number(timestamp) * 1000) > 5 * 60 * 1000) {
    return false;
  }
  const names = signedHeaderNames.split(' ');
  const values: string[] = [];
  for (const name of names) {
    const value = headers[name.toLowerCase()];
    if (typeof value !== 'string') return false;
    values.push(value);
  }
  const prefix =
    timestamp + '.' + signedHeaderNames + '.' + values.join('.') + '.';
  const expected = createHmac('sha256', secret)
    .update(prefix, 'utf8')
    .update(rawBody)
    .digest();
  const actual = Buffer.from(providedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

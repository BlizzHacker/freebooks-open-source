import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createPrivateKey } from 'node:crypto';
import { SignJWT } from 'jose';

const HOST = 'business.coinbase.com';
const BASE = 'https://' + HOST;
const PATH = '/api/v1/checkouts';

export interface CoinbaseCheckout {
  id: string;
  url: string;
  amount: string;
  currency: string;
  status: string;
  metadata?: Record<string, string>;
  transactionHash?: string;
  fiatAmount?: string;
  fiatCurrency?: string;
  settlement?: {
    totalAmount?: string;
    feeAmount?: string;
    netAmount?: string;
    currency?: string;
  };
}

@Injectable()
export class CoinbaseCheckoutClient {
  constructor(private readonly config: ConfigService) {}

  private async jwt(method: 'GET' | 'POST', path: string): Promise<string> {
    const keyName = this.config.get<string>('COINBASE_BUSINESS_KEY_NAME');
    const rawKey = this.config.get<string>('COINBASE_BUSINESS_PRIVATE_KEY');
    if (!keyName || !rawKey) {
      throw new ServiceUnavailableException(
        'Coinbase Business checkout is not configured.',
      );
    }
    const key = createPrivateKey(rawKey.replace(/\\n/g, '\n'));
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      sub: keyName,
      iss: 'cdp',
      nbf: now,
      exp: now + 120,
      uri: method + ' ' + HOST + path,
    })
      .setProtectedHeader({
        alg: 'ES256',
        kid: keyName,
        nonce: randomBytes(16).toString('hex'),
      })
      .sign(key);
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: object,
    idempotencyKey?: string,
  ): Promise<CoinbaseCheckout> {
    const authorization = await this.jwt(method, path);
    const response = await fetch(BASE + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + authorization,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new BadGatewayException(
        'Coinbase Business checkout request failed.',
      );
    }
    const checkout = (await response.json()) as CoinbaseCheckout;
    if (!checkout || !/^[a-f0-9]{24}$/i.test(String(checkout.id || ''))) {
      throw new BadGatewayException(
        'Coinbase Business returned an invalid checkout.',
      );
    }
    return checkout;
  }

  async create(input: {
    amount: string;
    invoiceId: number;
    invoiceNo: string;
    organizationId: string;
    requestKey: string;
    idempotencyKey: string;
    returnUrl: string;
  }): Promise<CoinbaseCheckout> {
    const checkout = await this.request(
      'POST',
      PATH,
      {
        amount: input.amount,
        currency: 'USD',
        description: 'FreeBooks invoice ' + input.invoiceNo,
        metadata: {
          invoiceId: String(input.invoiceId),
          organizationId: input.organizationId,
          requestKey: input.requestKey,
        },
        successRedirectUrl: input.returnUrl,
        failRedirectUrl: input.returnUrl,
      },
      input.idempotencyKey,
    );
    const url = new URL(checkout.url);
    if (url.protocol !== 'https:' || url.hostname !== 'payments.coinbase.com') {
      throw new BadGatewayException(
        'Coinbase Business returned an unexpected checkout URL.',
      );
    }
    if (
      Number(checkout.amount) !== Number(input.amount) ||
      checkout.currency !== 'USD' ||
      checkout.metadata?.requestKey !== input.requestKey
    ) {
      throw new BadGatewayException(
        'Coinbase Business checkout did not match the invoice.',
      );
    }
    return checkout;
  }

  get(checkoutId: string): Promise<CoinbaseCheckout> {
    if (!/^[a-f0-9]{24}$/i.test(checkoutId)) {
      throw new BadGatewayException('Invalid Coinbase checkout identifier.');
    }
    return this.request('GET', PATH + '/' + encodeURIComponent(checkoutId));
  }
}

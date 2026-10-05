import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';

@Injectable()
export class GetStripeAuthorizationLinkService {
  private readonly pendingStates = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  public getStripeAuthLink() {
    const clientId = this.config.get<string>('stripePayment.clientId');
    const redirectUrl = this.config.get<string>('stripePayment.redirectUrl');
    const now = Date.now();

    for (const [state, expiresAt] of this.pendingStates) {
      if (expiresAt <= now) this.pendingStates.delete(state);
    }

    const state = randomBytes(32).toString('hex');
    this.pendingStates.set(state, now + 10 * 60 * 1000);

    const authorizationUrl = new URL(
      'https://connect.stripe.com/oauth/v2/authorize',
    );
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('client_id', clientId || '');
    authorizationUrl.searchParams.set('scope', 'read_write');
    authorizationUrl.searchParams.set('redirect_uri', redirectUrl || '');
    authorizationUrl.searchParams.set('state', state);

    return { url: authorizationUrl.toString() };
  }

  public consumeState(state: string) {
    const expiresAt = this.pendingStates.get(state);
    this.pendingStates.delete(state);

    if (!expiresAt || expiresAt <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired Stripe OAuth state.');
    }
  }
}

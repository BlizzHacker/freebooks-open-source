import { StripePaymentService } from './StripePaymentService';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CreateStripeAccountLinkService {
  constructor(private readonly stripePaymentService: StripePaymentService) {}

  /**
   * Creates a new Stripe account id.
   * @param {string} stripeAccountId - Stripe account id.
   */
  public createAccountLink(stripeAccountId: string) {
    return this.stripePaymentService.createAccountLink(stripeAccountId);
  }

  /**
   * Creates a Stripe account session for the Connect embedded component.
   * @param {string} accountId - Stripe Connect account ID.
   */
  public createAccountSession(accountId: string) {
    return this.stripePaymentService.createAccountSession(accountId);
  }
}

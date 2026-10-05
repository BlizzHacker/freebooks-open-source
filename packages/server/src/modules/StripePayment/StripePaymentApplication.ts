import { CreateStripeAccountService } from './CreateStripeAccountService';
import { CreateStripeAccountLinkService } from './CreateStripeAccountLink';
import { CreateStripeAccountDTO } from './types';
import { ExchangeStripeOAuthTokenService } from './ExchangeStripeOauthToken';
import { GetStripeAuthorizationLinkService } from './GetStripeAuthorizationLink';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StripePaymentApplication {
  constructor(
    private readonly createStripeAccountService: CreateStripeAccountService,
    private readonly createStripeAccountLinkService: CreateStripeAccountLinkService,
    private readonly exchangeStripeOAuthTokenService: ExchangeStripeOAuthTokenService,
    private readonly getStripeConnectLinkService: GetStripeAuthorizationLinkService,
  ) {}

  public connectPlatformAccount() {
    return this.exchangeStripeOAuthTokenService.connectPlatformAccount();
  }

  /**
   * Creates a new Stripe account.
   * @param {number} createStripeAccountDTO
   */
  public createStripeAccount(
    createStripeAccountDTO: CreateStripeAccountDTO = {},
  ) {
    return this.createStripeAccountService.createStripeAccount(
      createStripeAccountDTO,
    );
  }

  /**
   * Creates a new Stripe account link of the given Stripe account.
   * @param {string} stripeAccountId
   * @returns {}
   */
  public createAccountLink(stripeAccountId: string) {
    return this.createStripeAccountLinkService.createAccountLink(
      stripeAccountId,
    );
  }

  /**
   * Creates a Stripe account session for the Connect embedded component.
   * @param {string} accountId - Stripe Connect account ID.
   */
  public createAccountSession(accountId: string) {
    return this.createStripeAccountLinkService.createAccountSession(accountId);
  }

  /**
   * Retrieves Stripe OAuth2 connect link.
   * @returns {string}
   */
  public getStripeConnectLink() {
    return this.getStripeConnectLinkService.getStripeAuthLink();
  }

  /**
   * Exchanges the given Stripe authorization code to Stripe user id and access token.
   * @param {string} authorizationCode
   * @returns
   */
  public exchangeStripeOAuthToken(authorizationCode: string, state: string) {
    return this.exchangeStripeOAuthTokenService.excahngeStripeOAuthToken(
      authorizationCode,
      state,
    );
  }
}

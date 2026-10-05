import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetPaymentMethodsPOJO } from '../types';
import { GetStripeAuthorizationLinkService } from '../../StripePayment/GetStripeAuthorizationLink';
import { PaymentIntegration } from '../models/PaymentIntegration.model';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

@Injectable()
export class GetPaymentMethodsStateService {
  constructor(
    private readonly getStripeAuthorizationLinkService: GetStripeAuthorizationLinkService,
    private readonly configService: ConfigService,

    @Inject(PaymentIntegration.name)
    private readonly paymentIntegrationModel: TenantModelProxy<
      typeof PaymentIntegration
    >,
  ) {}

  /**
   * Retrieves the payment state provising state.
   * @param {number} tenantId
   * @returns {Promise<GetPaymentMethodsPOJO>}
   */
  public async getPaymentMethodsState(): Promise<GetPaymentMethodsPOJO> {
    const stripePayments = await this.paymentIntegrationModel()
      .query()
      .where({ service: 'Stripe' })
      .orderBy('createdAt', 'ASC');
    const stripePayment = stripePayments[0];
    const isStripeAccountCreated = !!stripePayment;
    const isStripePaymentEnabled = stripePayment?.paymentEnabled;
    const isStripePayoutEnabled = stripePayment?.payoutEnabled;
    const isStripeEnabled = stripePayment?.fullEnabled;

    const stripePaymentMethodId = stripePayment?.id || null;
    const stripeAccountId = stripePayment?.accountId || null;
    const stripePublishableKey = this.configService.get(
      'stripePayment.publishableKey',
    );
    const stripeCurrencies = ['USD', 'EUR'];
    const stripeRedirectUrl =
      this.configService.get<string>('stripePayment.redirectUrl') || null;
    const stripeMissingConfiguration = this.getStripeMissingConfiguration();
    const isStripeServerConfigured = stripeMissingConfiguration.length === 0;
    const stripeAuthLink = isStripeServerConfigured
      ? this.getStripeAuthorizationLinkService.getStripeAuthLink().url
      : '';

    const paymentMethodPOJO: GetPaymentMethodsPOJO = {
      stripe: {
        accounts: stripePayments.map((payment) => ({
          id: payment.id,
          name: payment.name,
          stripeAccountId: payment.accountId || null,
          isStripePaymentEnabled: payment.paymentEnabled,
          isStripePayoutEnabled: payment.payoutEnabled,
          isStripeEnabled: payment.fullEnabled,
        })),
        isStripeAccountCreated,
        isStripePaymentEnabled,
        isStripePayoutEnabled,
        isStripeEnabled,
        isStripeServerConfigured,
        stripeMissingConfiguration,
        stripeAccountId,
        stripePaymentMethodId,
        stripePublishableKey,
        stripeCurrencies,
        stripeAuthLink,
        stripeRedirectUrl,
      },
    };
    return paymentMethodPOJO;
  }

  /** Returns missing Stripe platform settings without exposing their values. */
  private getStripeMissingConfiguration(): string[] {
    const required: Array<[string, string]> = [
      ['stripePayment.secretKey', 'Stripe secret API key'],
      ['stripePayment.publishableKey', 'Stripe publishable key'],
      ['stripePayment.clientId', 'Stripe Connect client ID'],
      ['stripePayment.webhooksSecret', 'Stripe webhook signing secret'],
      ['stripePayment.redirectUrl', 'OAuth callback URL'],
    ];
    return required
      .filter(([key]) => !this.configService.get<string>(key)?.trim())
      .map(([, label]) => label);
  }
}

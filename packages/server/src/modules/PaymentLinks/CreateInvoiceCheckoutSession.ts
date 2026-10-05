import { StripePaymentService } from '../StripePayment/StripePaymentService';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { TenantModel } from '../System/models/TenantModel';
import { assertPaymentLinkAccessible } from './payment-link.utils';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { SaleInvoice } from '../SaleInvoices/models/SaleInvoice';
import { PaymentLink } from './models/PaymentLink';
import { StripeInvoiceCheckoutSessionPOJO } from '../StripePayment/StripePayment.types';
import { ModelObject } from 'objection';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CreateInvoiceCheckoutSession {
  constructor(
    private readonly stripePaymentService: StripePaymentService,
    private readonly configService: ConfigService,
    private readonly clsService: ClsService,

    @Inject(TenantModel.name)
    private readonly tenantModel: typeof TenantModel,

    @Inject(SaleInvoice.name)
    private readonly saleInvoiceModel: TenantModelProxy<typeof SaleInvoice>,

    @Inject(PaymentLink.name)
    private readonly paymentLinkModel: typeof PaymentLink,
  ) {}

  /**
   * Creates a new Stripe checkout session from the given sale invoice.
   * @param {number} saleInvoiceId - Sale invoice id.
   * @returns {Promise<StripeInvoiceCheckoutSessionPOJO>}
   */
  async createInvoiceCheckoutSession(
    publicPaymentLinkId: string,
  ): Promise<StripeInvoiceCheckoutSessionPOJO> {
    // Retrieves the payment link from the given id.
    const paymentLink = await this.paymentLinkModel
      .query()
      .findOne('linkId', publicPaymentLinkId)
      .where('resourceType', 'SaleInvoice')
      .throwIfNotFound();

    const tenant = await this.tenantModel
      .query()
      .findById(paymentLink.tenantId)
      .throwIfNotFound();
    assertPaymentLinkAccessible(paymentLink, tenant.organizationId, undefined);
    this.clsService.set('organizationId', tenant.organizationId);

    // Retrieves the invoice from associated payment link.
    const invoice = await this.saleInvoiceModel()
      .query()
      .findById(paymentLink.resourceId)
      .withGraphFetched('paymentMethods.paymentIntegration')
      .throwIfNotFound();

    // It will be only one Stripe payment method associated to the invoice.
    const stripePaymentMethod = invoice.paymentMethods?.find(
      (method) =>
        method.enable &&
        method.paymentIntegration?.service === 'Stripe' &&
        method.paymentIntegration?.paymentEnabled,
    );
    if (!stripePaymentMethod || Number(invoice.dueAmount) <= 0) {
      throw new BadRequestException(
        'Stripe checkout is not available for this invoice.',
      );
    }
    const stripeAccountId = stripePaymentMethod?.paymentIntegration?.options
      ?.isPlatformAccount
      ? undefined
      : stripePaymentMethod?.paymentIntegration?.accountId;
    const _paymentIntegrationId = stripePaymentMethod?.paymentIntegration?.id;

    // Creates checkout session for the given invoice.
    const baseUrl =
      this.configService.get<string>('app.baseUrl')?.replace(/\/$/, '') ||
      'https://freebooks.dev';
    const returnUrl = `${baseUrl}/payment/${paymentLink.linkId}`;
    const session = await this.createCheckoutSession(
      invoice,
      stripeAccountId,
      {
        tenantId: paymentLink.tenantId,
        paymentLinkId: paymentLink.id,
      },
      `${returnUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      `${returnUrl}?payment=cancelled`,
    );
    return {
      sessionId: session.id,
      publishableKey: this.configService.get('stripePayment.publishableKey'),
      redirectTo: session.url,
    };
  }

  /**
   * Creates a new Stripe checkout session for the given sale invoice.
   * @param {ISaleInvoice} invoice - The sale invoice for which the checkout session is created.
   * @param {string} stripeAccountId - The Stripe account ID associated with the payment method.
   * @returns {Promise<any>} - The created Stripe checkout session.
   */
  private createCheckoutSession(
    invoice: ModelObject<SaleInvoice>,
    stripeAccountId: string | undefined,
    metadata: Record<string, any>,
    successUrl: string,
    cancelUrl: string,
  ) {
    return this.stripePaymentService.stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: invoice.currencyCode,
              product_data: {
                name: invoice.invoiceNo,
              },
              unit_amount: Math.round(Number(invoice.dueAmount) * 100), // Remaining USD/EUR amount in cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          saleInvoiceId: invoice.id,
          resource: 'SaleInvoice',
          ...metadata,
        },
      },
      stripeAccountId ? { stripeAccount: stripeAccountId } : {},
    );
  }
}

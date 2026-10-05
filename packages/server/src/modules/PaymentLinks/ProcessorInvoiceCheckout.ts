import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { createHash } from 'node:crypto';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { TenantModel } from '../System/models/TenantModel';
import { SystemUser } from '../System/models/SystemUser';
import { SaleInvoice } from '../SaleInvoices/models/SaleInvoice';
import { PaymentLink } from './models/PaymentLink';
import { ProcessorCheckoutAttempt } from './models/ProcessorCheckoutAttempt';
import { PaymentProviderCredentialsService } from '../PaymentServices/PaymentProviderCredentials.service';
import { AccountRepository } from '../Accounts/repositories/Account.repository';
import { CreatePaymentReceivedService } from '../PaymentReceived/commands/CreatePaymentReceived.serivce';
import { TENANCY_DB_CONNECTION } from '../Tenancy/TenancyDB/TenancyDB.constants';
import { Knex } from 'knex';
import { assertPaymentLinkAccessible } from './payment-link.utils';

type Provider = 'Square' | 'PayPal';

@Injectable()
export class ProcessorInvoiceCheckout {
  constructor(
    private readonly cls: ClsService,
    private readonly config: ConfigService,
    private readonly credentials: PaymentProviderCredentialsService,
    private readonly accountRepository: AccountRepository,
    private readonly createPaymentReceived: CreatePaymentReceivedService,
    @Inject(TENANCY_DB_CONNECTION) private readonly tenantKnex: () => Knex,
    @Inject(PaymentLink.name) private readonly links: typeof PaymentLink,
    @Inject(TenantModel.name) private readonly tenants: typeof TenantModel,
    @Inject(SystemUser.name) private readonly users: typeof SystemUser,
    @Inject(SaleInvoice.name)
    private readonly invoices: TenantModelProxy<typeof SaleInvoice>,
    @Inject(ProcessorCheckoutAttempt.name)
    private readonly attempts: TenantModelProxy<
      typeof ProcessorCheckoutAttempt
    >,
  ) {}

  private async invoiceContext(linkId: string) {
    const link = await this.links
      .query()
      .findOne({ linkId, resourceType: 'SaleInvoice' })
      .throwIfNotFound();
    const tenant = await this.tenants
      .query()
      .findById(link.tenantId)
      .throwIfNotFound();
    assertPaymentLinkAccessible(link, tenant.organizationId, undefined);
    this.cls.set('organizationId', tenant.organizationId);
    const user = await this.users
      .query()
      .findOne({ tenantId: tenant.id })
      .modify('active')
      .throwIfNotFound();
    this.cls.set('userId', user.id);
    const invoice = await this.invoices()
      .query()
      .findById(link.resourceId)
      .withGraphFetched('paymentMethods.paymentIntegration')
      .throwIfNotFound();
    return { link, invoice };
  }

  private selectIntegration(
    invoice: SaleInvoice,
    provider: Provider,
    id: number,
  ) {
    const method = invoice.paymentMethods?.find(
      (row) =>
        row.enable &&
        row.paymentIntegrationId === id &&
        row.paymentIntegration?.service === provider,
    );
    const integration = method?.paymentIntegration;
    if (
      !integration ||
      !integration.paymentEnabled ||
      integration.options?.providerDisconnected
    ) {
      throw new BadRequestException(
        provider + ' is not enabled on this invoice.',
      );
    }
    return integration;
  }

  private amountMinor(invoice: SaleInvoice): number {
    if (invoice.currencyCode !== 'USD') {
      throw new BadRequestException(
        'Square and PayPal invoice checkout currently supports USD invoices.',
      );
    }
    const amount = Number(invoice.dueAmount);
    const minor = Math.round(amount * 100);
    if (
      !Number.isSafeInteger(minor) ||
      minor <= 0 ||
      Math.abs(amount * 100 - minor) > 0.00001
    ) {
      throw new BadRequestException(
        'This invoice has no valid payable balance.',
      );
    }
    return minor;
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('app.baseUrl') || 'https://freebooks.dev'
    ).replace(/\/$/, '');
  }

  private squareBase(environment: string): string {
    return environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
  }

  private paypalBase(environment: string): string {
    return environment === 'sandbox'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
  }

  private async paypalAccessToken(
    credentials: Record<string, string>,
  ): Promise<string> {
    const basic = Buffer.from(
      credentials.clientId + ':' + credentials.clientSecret,
    ).toString('base64');
    const response = await fetch(
      this.paypalBase(credentials.environment) + '/v1/oauth2/token',
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + basic,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(15000),
      },
    );
    const body = await response.json();
    if (!response.ok || !body.access_token) {
      throw new BadRequestException(
        'PayPal could not authorize this merchant app.',
      );
    }
    return body.access_token;
  }

  async create(linkId: string, provider: Provider, integrationId: number) {
    if (provider !== 'Square' && provider !== 'PayPal') {
      throw new BadRequestException('Unsupported checkout provider.');
    }
    if (!Number.isInteger(integrationId) || integrationId < 1) {
      throw new BadRequestException('Select a valid payment account.');
    }
    const { link, invoice } = await this.invoiceContext(linkId);
    const integration = this.selectIntegration(
      invoice,
      provider,
      integrationId,
    );
    const minor = this.amountMinor(invoice);
    const requestKey = createHash('sha256')
      .update(
        [
          link.linkId,
          provider,
          integration.id,
          minor,
          invoice.currencyCode,
        ].join(':'),
      )
      .digest('hex');

    const previous = await this.attempts().query().findOne({ requestKey });
    if (previous) {
      if (previous.status === 'recorded') {
        throw new BadRequestException(
          'This invoice checkout was already recorded.',
        );
      }
      return {
        redirectTo: previous.checkoutUrl,
        provider,
        attempt: requestKey,
      };
    }

    const credentials = await this.credentials.read(integration.id);
    const returnUrl =
      this.baseUrl() +
      '/payment/' +
      encodeURIComponent(link.linkId) +
      '?payment_provider=' +
      provider.toLowerCase() +
      '&attempt=' +
      requestKey;
    let providerOrderId: string;
    let checkoutUrl: string;

    if (provider === 'Square') {
      const locationId = integration.options?.locationId;
      if (!locationId) {
        throw new BadRequestException(
          'Square has no active checkout location. Reconnect the account.',
        );
      }
      const response = await fetch(
        this.squareBase(credentials.environment) +
          '/v2/online-checkout/payment-links',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + credentials.accessToken,
            'Square-Version': '2025-01-23',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            idempotency_key: requestKey,
            description: 'FreeBooks invoice ' + invoice.invoiceNo,
            quick_pay: {
              name: 'Invoice ' + invoice.invoiceNo,
              price_money: { amount: minor, currency: 'USD' },
              location_id: locationId,
            },
            checkout_options: { redirect_url: returnUrl, allow_tipping: false },
            payment_note: 'FreeBooks invoice ' + invoice.invoiceNo,
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      const body = await response.json();
      if (
        !response.ok ||
        !body.payment_link?.order_id ||
        !body.payment_link?.url
      ) {
        throw new BadRequestException(
          'Square could not create an invoice checkout link.',
        );
      }
      providerOrderId = body.payment_link.order_id;
      checkoutUrl = body.payment_link.url;
      if (
        !['square.link', 'checkout.square.site'].includes(
          new URL(checkoutUrl).hostname,
        )
      ) {
        throw new BadRequestException(
          'Square returned an unexpected checkout URL.',
        );
      }
    } else {
      const accessToken = await this.paypalAccessToken(credentials);
      const response = await fetch(
        this.paypalBase(credentials.environment) + '/v2/checkout/orders',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': requestKey,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [
              {
                reference_id: String(invoice.id),
                description: 'FreeBooks invoice ' + invoice.invoiceNo,
                custom_id: 'freebooks:' + invoice.id,
                amount: {
                  currency_code: 'USD',
                  value: (minor / 100).toFixed(2),
                },
              },
            ],
            payment_source: {
              paypal: {
                experience_context: {
                  return_url: returnUrl,
                  cancel_url:
                    this.baseUrl() +
                    '/payment/' +
                    encodeURIComponent(link.linkId) +
                    '?payment=cancelled',
                  user_action: 'PAY_NOW',
                  shipping_preference: 'NO_SHIPPING',
                },
              },
            },
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      const body = await response.json();
      const approval = body.links?.find(
        (row) => row.rel === 'payer-action' || row.rel === 'approve',
      );
      if (!response.ok || !body.id || !approval?.href) {
        throw new BadRequestException(
          'PayPal could not create an invoice order.',
        );
      }
      providerOrderId = body.id;
      checkoutUrl = approval.href;
      const host = new URL(checkoutUrl).hostname;
      if (host !== 'www.paypal.com' && host !== 'www.sandbox.paypal.com') {
        throw new BadRequestException(
          'PayPal returned an unexpected checkout URL.',
        );
      }
    }

    try {
      await this.attempts().query().insert({
        requestKey,
        paymentLinkId: link.linkId,
        saleInvoiceId: invoice.id,
        paymentIntegrationId: integration.id,
        provider,
        providerOrderId,
        checkoutUrl,
        amountMinor: minor,
        currency: 'USD',
        status: 'pending',
      });
    } catch (error) {
      const concurrent = await this.attempts().query().findOne({ requestKey });
      if (!concurrent || concurrent.providerOrderId !== providerOrderId) {
        throw error;
      }
    }
    return { redirectTo: checkoutUrl, provider, attempt: requestKey };
  }

  async verify(
    linkId: string,
    provider: Provider,
    requestKey: string,
    returnedOrderId?: string,
  ) {
    if (provider !== 'Square' && provider !== 'PayPal') {
      throw new BadRequestException('Unsupported checkout provider.');
    }
    if (!/^[a-f0-9]{64}$/.test(requestKey)) {
      throw new BadRequestException('Invalid checkout attempt.');
    }
    const { invoice } = await this.invoiceContext(linkId);
    const attempt = await this.attempts().query().findOne({
      requestKey,
      paymentLinkId: linkId,
      provider,
    });
    if (!attempt || attempt.saleInvoiceId !== invoice.id) {
      throw new NotFoundException('Checkout attempt not found.');
    }
    if (attempt.status === 'recorded') {
      return {
        status: 'recorded',
        paymentReceivedId: attempt.paymentReceivedId,
      };
    }
    if (
      provider === 'PayPal' &&
      returnedOrderId &&
      returnedOrderId !== attempt.providerOrderId
    ) {
      throw new ForbiddenException(
        'PayPal order did not match this invoice checkout.',
      );
    }
    const credentials = await this.credentials.read(
      attempt.paymentIntegrationId,
    );
    const confirmed =
      provider === 'Square'
        ? await this.verifySquare(attempt, credentials)
        : await this.verifyPayPal(attempt, credentials);

    const result = await this.tenantKnex().transaction(async (trx) => {
      const locked = await this.attempts()
        .query(trx)
        .findById(attempt.id)
        .forUpdate();
      if (locked.status === 'recorded') {
        return {
          status: 'recorded',
          paymentReceivedId: locked.paymentReceivedId,
        };
      }
      const currentInvoice = await this.invoices()
        .query(trx)
        .findById(attempt.saleInvoiceId)
        .forUpdate()
        .throwIfNotFound();
      if (
        Math.round(Number(currentInvoice.dueAmount) * 100) <
        Number(attempt.amountMinor)
      ) {
        throw new BadRequestException(
          'The processor payment is confirmed but the invoice balance changed. Review it before posting.',
        );
      }
      const clearingName = provider + ' Clearing';
      const clearingSlug = provider.toLowerCase() + '-clearing';
      let clearing = await this.accountRepository.model
        .query(trx)
        .findOne({ slug: clearingSlug, accountType: 'other-current-asset' });
      if (!clearing) {
        clearing = await this.accountRepository.model
          .query(trx)
          .findOne({ name: clearingName, accountType: 'other-current-asset' });
      }
      if (!clearing) {
        clearing = await this.accountRepository.model
          .query(trx)
          .insertAndFetch({
            name: clearingName,
            slug: clearingSlug,
            accountType: 'other-current-asset',
            currencyCode: 'USD',
            active: true,
          });
      }
      const payment = await this.createPaymentReceived.createPaymentReceived(
        {
          customerId: currentInvoice.customerId,
          paymentDate: new Date(),
          amount: Number(attempt.amountMinor) / 100,
          exchangeRate: 1,
          referenceNo: provider + ':' + confirmed.paymentId,
          statement: provider + ' verified invoice payment',
          depositAccountId: clearing.id,
          branchId: currentInvoice.branchId,
          entries: [
            {
              invoiceId: currentInvoice.id,
              paymentAmount: Number(attempt.amountMinor) / 100,
            },
          ],
        },
        trx,
      );
      await this.attempts().query(trx).findById(attempt.id).patch({
        status: 'recorded',
        providerPaymentId: confirmed.paymentId,
        paymentReceivedId: payment.id,
      });
      return { status: 'recorded', paymentReceivedId: payment.id };
    });
    return result;
  }

  private async verifySquare(
    attempt: ProcessorCheckoutAttempt,
    credentials: Record<string, string>,
  ): Promise<{ paymentId: string }> {
    const base = this.squareBase(credentials.environment);
    const headers = {
      Authorization: 'Bearer ' + credentials.accessToken,
      'Square-Version': '2025-01-23',
    };
    const orderResponse = await fetch(
      base + '/v2/orders/' + encodeURIComponent(attempt.providerOrderId),
      { headers, signal: AbortSignal.timeout(15000) },
    );
    const orderBody = await orderResponse.json();
    const order = orderBody.order;
    if (
      !orderResponse.ok ||
      order?.id !== attempt.providerOrderId ||
      order.state !== 'COMPLETED'
    ) {
      throw new BadRequestException(
        'Square has not confirmed this order as paid.',
      );
    }
    const paymentIds = (order.tenders || [])
      .map((row) => row.payment_id)
      .filter(Boolean);
    if (paymentIds.length !== 1) {
      throw new BadRequestException(
        'Square order payments need review before posting.',
      );
    }
    const paymentResponse = await fetch(
      base + '/v2/payments/' + encodeURIComponent(paymentIds[0]),
      { headers, signal: AbortSignal.timeout(15000) },
    );
    const paymentBody = await paymentResponse.json();
    const payment = paymentBody.payment;
    if (
      !paymentResponse.ok ||
      payment?.id !== paymentIds[0] ||
      payment.order_id !== attempt.providerOrderId ||
      payment.status !== 'COMPLETED' ||
      ['CASH', 'EXTERNAL'].includes(payment.source_type) ||
      Number(payment.amount_money?.amount) !== Number(attempt.amountMinor) ||
      payment.amount_money?.currency !== attempt.currency ||
      Number(payment.refunded_money?.amount || 0) > 0
    ) {
      throw new BadRequestException(
        'Square payment does not match this invoice checkout.',
      );
    }
    return { paymentId: payment.id };
  }

  private async verifyPayPal(
    attempt: ProcessorCheckoutAttempt,
    credentials: Record<string, string>,
  ): Promise<{ paymentId: string }> {
    const base = this.paypalBase(credentials.environment);
    const accessToken = await this.paypalAccessToken(credentials);
    const headers = {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    };
    const orderUrl =
      base +
      '/v2/checkout/orders/' +
      encodeURIComponent(attempt.providerOrderId);
    const orderResponse = await fetch(orderUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    let order = await orderResponse.json();
    if (!orderResponse.ok || order.id !== attempt.providerOrderId) {
      throw new BadRequestException('PayPal could not verify this order.');
    }
    if (order.status === 'APPROVED') {
      const captureResponse = await fetch(orderUrl + '/capture', {
        method: 'POST',
        headers: {
          ...headers,
          'PayPal-Request-Id': 'capture-' + attempt.requestKey,
          Prefer: 'return=representation',
        },
        body: '{}',
        signal: AbortSignal.timeout(20000),
      });
      order = await captureResponse.json();
      if (!captureResponse.ok) {
        throw new BadRequestException(
          'PayPal did not capture the approved order.',
        );
      }
    }
    if (
      order.status !== 'COMPLETED' ||
      order.id !== attempt.providerOrderId ||
      order.purchase_units?.length !== 1
    ) {
      throw new BadRequestException(
        'PayPal has not confirmed a completed payment.',
      );
    }
    const captures = order.purchase_units[0]?.payments?.captures || [];
    if (
      captures.length !== 1 ||
      captures[0].status !== 'COMPLETED' ||
      captures[0].amount?.currency_code !== attempt.currency ||
      Math.round(Number(captures[0].amount?.value) * 100) !==
        Number(attempt.amountMinor) ||
      !captures[0].id
    ) {
      throw new BadRequestException(
        'PayPal capture does not match this invoice checkout.',
      );
    }
    return { paymentId: captures[0].id };
  }
}

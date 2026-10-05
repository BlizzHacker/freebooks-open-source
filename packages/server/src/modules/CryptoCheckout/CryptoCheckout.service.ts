import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { createHash } from 'node:crypto';
import { Knex } from 'knex';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { TenantModel } from '../System/models/TenantModel';
import { SystemUser } from '../System/models/SystemUser';
import { SaleInvoice } from '../SaleInvoices/models/SaleInvoice';
import { PaymentLink } from '../PaymentLinks/models/PaymentLink';
import { assertPaymentLinkAccessible } from '../PaymentLinks/payment-link.utils';
import { AccountRepository } from '../Accounts/repositories/Account.repository';
import { CreatePaymentReceivedService } from '../PaymentReceived/commands/CreatePaymentReceived.serivce';
import { TENANCY_DB_CONNECTION } from '../Tenancy/TenancyDB/TenancyDB.constants';
import { CryptoCheckoutAttempt } from './CryptoCheckoutAttempt.model';
import {
  CoinbaseCheckout,
  CoinbaseCheckoutClient,
} from './CoinbaseCheckoutClient';

function minorAmount(value: string | number): number {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new BadRequestException('Invalid checkout amount.');
  }
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new BadRequestException('Invalid checkout amount.');
  }
  return cents;
}

function requestUuid(hash: string): string {
  const hex = hash.slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = '8';
  return [
    hex.slice(0, 8).join(''),
    hex.slice(8, 12).join(''),
    hex.slice(12, 16).join(''),
    hex.slice(16, 20).join(''),
    hex.slice(20, 32).join(''),
  ].join('-');
}

@Injectable()
export class CryptoCheckoutService {
  constructor(
    private readonly cls: ClsService,
    private readonly config: ConfigService,
    private readonly client: CoinbaseCheckoutClient,
    private readonly accountRepository: AccountRepository,
    private readonly createPaymentReceived: CreatePaymentReceivedService,
    @Inject(TENANCY_DB_CONNECTION) private readonly tenantKnex: () => Knex,
    @Inject(PaymentLink.name) private readonly links: typeof PaymentLink,
    @Inject(TenantModel.name) private readonly tenants: typeof TenantModel,
    @Inject(SystemUser.name) private readonly users: typeof SystemUser,
    @Inject(SaleInvoice.name)
    private readonly invoices: TenantModelProxy<typeof SaleInvoice>,
    @Inject(CryptoCheckoutAttempt.name)
    private readonly attempts: TenantModelProxy<typeof CryptoCheckoutAttempt>,
  ) {}

  private allowedOrganizationId(): string {
    const value = this.config.get<string>(
      'COINBASE_CHECKOUT_ALLOWED_ORGANIZATION_ID',
    );
    if (!value) {
      throw new ServiceUnavailableException(
        'Coinbase Business checkout is not enabled.',
      );
    }
    return value;
  }

  private async setTenantContext(tenant: TenantModel): Promise<void> {
    if (tenant.organizationId !== this.allowedOrganizationId()) {
      throw new ForbiddenException(
        'Coinbase Business checkout is unavailable for this organization.',
      );
    }
    this.cls.set('organizationId', tenant.organizationId);
    const user = await this.users
      .query()
      .findOne({ tenantId: tenant.id })
      .modify('active')
      .throwIfNotFound();
    this.cls.set('userId', user.id);
  }

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
    await this.setTenantContext(tenant);
    const invoice = await this.invoices()
      .query()
      .findById(link.resourceId)
      .throwIfNotFound();
    return { link, invoice, tenant };
  }

  private async webhookContext(): Promise<void> {
    const tenant = await this.tenants
      .query()
      .findOne({ organizationId: this.allowedOrganizationId() })
      .throwIfNotFound();
    await this.setTenantContext(tenant);
  }

  private invoiceAmount(invoice: SaleInvoice): number {
    if (invoice.currencyCode !== 'USD') {
      throw new BadRequestException(
        'Coinbase checkout currently supports USD invoices only.',
      );
    }
    return minorAmount(invoice.dueAmount);
  }

  private returnUrl(linkId: string): string {
    const base = (
      this.config.get<string>('app.baseUrl') || 'https://freebooks.dev'
    ).replace(/\/$/, '');
    if (!base.startsWith('https://')) {
      throw new ServiceUnavailableException(
        'A secure FreeBooks base URL is required.',
      );
    }
    return (
      base +
      '/payment/' +
      encodeURIComponent(linkId) +
      '?crypto_provider=coinbase'
    );
  }

  async create(linkId: string) {
    const { link, invoice, tenant } = await this.invoiceContext(linkId);
    const amountMinor = this.invoiceAmount(invoice);
    const last = await this.attempts()
      .query()
      .findOne({ paymentLinkId: link.linkId, saleInvoiceId: invoice.id })
      .orderBy('id', 'desc');

    if (last) {
      if (last.paymentReceivedId || last.status === 'recorded') {
        throw new BadRequestException(
          'This invoice checkout was already recorded. Review any refund before requesting another payment.',
        );
      }
      if (Number(last.amountMinor) !== amountMinor) {
        throw new BadRequestException(
          'The invoice balance changed after a crypto checkout was created. Review that checkout first.',
        );
      }
      const current = await this.client.get(last.checkoutId);
      if (current.status === 'COMPLETED') {
        return this.reconcileAttempt(last, current);
      }
      if (!['EXPIRED', 'FAILED', 'DEACTIVATED'].includes(current.status)) {
        return {
          status: current.status,
          redirectTo: last.checkoutUrl,
          attempt: last.requestKey,
        };
      }
      await this.attempts()
        .query()
        .findById(last.id)
        .patch({ providerStatus: current.status });
    }

    const requestKey = createHash('sha256')
      .update(
        [link.linkId, invoice.id, amountMinor, last?.id || 0, 'coinbase'].join(
          ':',
        ),
      )
      .digest('hex');
    const existing = await this.attempts().query().findOne({ requestKey });
    if (existing) {
      return {
        status: existing.providerStatus,
        redirectTo: existing.checkoutUrl,
        attempt: requestKey,
      };
    }
    const amount = (amountMinor / 100).toFixed(2);
    const checkout = await this.client.create({
      amount,
      invoiceId: invoice.id,
      invoiceNo: String(invoice.invoiceNo || invoice.id),
      organizationId: tenant.organizationId,
      requestKey,
      idempotencyKey: requestUuid(requestKey),
      returnUrl: this.returnUrl(link.linkId),
    });
    try {
      await this.attempts().query().insert({
        requestKey,
        paymentLinkId: link.linkId,
        saleInvoiceId: invoice.id,
        checkoutId: checkout.id,
        checkoutUrl: checkout.url,
        amountMinor,
        currency: 'USD',
        providerStatus: checkout.status,
        status: 'pending',
      });
    } catch (error) {
      const concurrent = await this.attempts().query().findOne({ requestKey });
      if (!concurrent || concurrent.checkoutId !== checkout.id) throw error;
    }
    return {
      status: checkout.status,
      redirectTo: checkout.url,
      attempt: requestKey,
    };
  }

  async status(linkId: string, requestKey: string) {
    if (!/^[a-f0-9]{64}$/.test(requestKey)) {
      throw new BadRequestException('Invalid checkout attempt.');
    }
    const { invoice } = await this.invoiceContext(linkId);
    const attempt = await this.attempts()
      .query()
      .findOne({ requestKey, paymentLinkId: linkId, saleInvoiceId: invoice.id })
      .throwIfNotFound();
    const checkout = await this.client.get(attempt.checkoutId);
    return this.reconcileAttempt(attempt, checkout);
  }

  async receiveSignedWebhook(event: Record<string, any>) {
    if (
      !event ||
      !/^[a-f0-9]{24}$/i.test(String(event.id || '')) ||
      typeof event.eventType !== 'string'
    ) {
      throw new BadRequestException('Invalid Coinbase checkout event.');
    }
    await this.webhookContext();
    const attempt = await this.attempts()
      .query()
      .findOne({ checkoutId: event.id })
      .throwIfNotFound();
    const checkout = await this.client.get(attempt.checkoutId);
    return this.reconcileAttempt(attempt, checkout);
  }

  private async reconcileAttempt(
    attempt: CryptoCheckoutAttempt,
    checkout: CoinbaseCheckout,
  ) {
    if (
      checkout.id !== attempt.checkoutId ||
      checkout.metadata?.requestKey !== attempt.requestKey ||
      checkout.metadata?.invoiceId !== String(attempt.saleInvoiceId) ||
      checkout.metadata?.organizationId !== this.allowedOrganizationId() ||
      checkout.currency !== attempt.currency ||
      minorAmount(checkout.amount) !== Number(attempt.amountMinor)
    ) {
      throw new ForbiddenException(
        'Coinbase checkout does not match this invoice.',
      );
    }
    if (checkout.status !== 'COMPLETED') {
      const refund = ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(
        checkout.status,
      );
      await this.attempts()
        .query()
        .findById(attempt.id)
        .patch({
          providerStatus: checkout.status,
          ...(refund || attempt.status === 'recorded'
            ? { status: 'review' }
            : {}),
        });
      return refund || attempt.status === 'recorded'
        ? {
            status: 'review',
            reason:
              'Provider status changed after payment; review the invoice and refund.',
          }
        : { status: checkout.status, attempt: attempt.requestKey };
    }

    return this.tenantKnex().transaction(async (trx) => {
      const locked = await this.attempts()
        .query(trx)
        .findById(attempt.id)
        .forUpdate();
      if (!locked) throw new NotFoundException('Checkout attempt not found.');
      if (locked.paymentReceivedId) {
        return locked.status === 'recorded'
          ? { status: 'recorded', paymentReceivedId: locked.paymentReceivedId }
          : {
              status: 'review',
              reason:
                'A receipt was already recorded; review the provider status and refund.',
            };
      }
      const invoice = await this.invoices()
        .query(trx)
        .findById(locked.saleInvoiceId)
        .forUpdate()
        .throwIfNotFound();
      if (
        invoice.currencyCode !== 'USD' ||
        Math.round(Number(invoice.dueAmount) * 100) < Number(locked.amountMinor)
      ) {
        await this.attempts().query(trx).findById(locked.id).patch({
          status: 'review',
          providerStatus: checkout.status,
        });
        return {
          status: 'review',
          reason: 'Payment confirmed; invoice balance requires review.',
        };
      }

      let clearing = await this.accountRepository.model
        .query(trx)
        .findOne({
          slug: 'coinbase-usdc-clearing',
          accountType: 'other-current-asset',
        });
      if (!clearing) {
        clearing = await this.accountRepository.model
          .query(trx)
          .insertAndFetch({
            name: 'Coinbase USDC Clearing',
            slug: 'coinbase-usdc-clearing',
            accountType: 'other-current-asset',
            currencyCode: 'USD',
            active: true,
          });
      }
      const payment = await this.createPaymentReceived.createPaymentReceived(
        {
          customerId: invoice.customerId,
          paymentDate: new Date(),
          amount: Number(locked.amountMinor) / 100,
          exchangeRate: 1,
          referenceNo: 'Coinbase:' + checkout.id,
          statement:
            'Verified Coinbase Business checkout; settlement and fees require reconciliation.',
          depositAccountId: clearing.id,
          branchId: invoice.branchId,
          entries: [
            {
              invoiceId: invoice.id,
              paymentAmount: Number(locked.amountMinor) / 100,
            },
          ],
        },
        trx,
      );
      await this.attempts()
        .query(trx)
        .findById(locked.id)
        .patch({
          status: 'recorded',
          providerStatus: checkout.status,
          paymentReceivedId: payment.id,
          transactionHash: checkout.transactionHash || null,
          settlementTotal: checkout.settlement?.totalAmount || null,
          settlementFee: checkout.settlement?.feeAmount || null,
          settlementNet: checkout.settlement?.netAmount || null,
          settlementCurrency: checkout.settlement?.currency || null,
        });
      return { status: 'recorded', paymentReceivedId: payment.id };
    });
  }
}

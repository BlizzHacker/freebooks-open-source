import { BadRequestException, Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PaymentIntegration } from './models/PaymentIntegration.model';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { PaymentProviderCredentialsService } from './PaymentProviderCredentials.service';

export type PaymentProvider = 'Square' | 'PayPal' | 'Authorize.Net';
export interface ProviderCredentials {
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  apiLoginId?: string;
  transactionKey?: string;
  environment?: 'sandbox' | 'production';
}

@Injectable()
export class PaymentProviderConnectionsService {
  constructor(
    private readonly credentials: PaymentProviderCredentialsService,
    @Inject(PaymentIntegration.name)
    private readonly paymentIntegrationModel: TenantModelProxy<
      typeof PaymentIntegration
    >,
  ) {}

  public async list() {
    const rows = await this.paymentIntegrationModel()
      .query()
      .whereIn('service', ['Stripe', 'Square', 'PayPal', 'Authorize.Net'])
      .orderBy('createdAt', 'ASC');
    return rows.map((row) => ({
      id: row.id,
      provider: row.service,
      name: row.name,
      externalAccountId: row.accountId || null,
      paymentEnabled: row.paymentEnabled,
      payoutEnabled: row.payoutEnabled,
      active: !!row.paymentEnabled,
      checkoutReady: !!row.paymentEnabled,
      historySyncReady: !!row.payoutEnabled,
      connectionStatus: row.options?.providerDisconnected
        ? 'disconnected'
        : row.paymentEnabled
          ? 'checkout_ready'
          : 'credentials_validated',
    }));
  }

  public async connect(
    provider: PaymentProvider,
    name: string,
    supplied: ProviderCredentials,
  ) {
    if (!['Square', 'PayPal', 'Authorize.Net'].includes(provider)) {
      throw new BadRequestException('Unsupported payment provider.');
    }
    const credentials = this.normalize(provider, supplied);
    const account = await this.validateProvider(provider, credentials);
    const externalAccountId = account.id;
    const accountName = name.trim() || account.name || provider;

    let integration = await this.paymentIntegrationModel()
      .query()
      .findOne({ service: provider, accountId: externalAccountId });

    if (integration) {
      await this.credentials.save(integration.id, credentials);
      await this.paymentIntegrationModel()
        .query()
        .findById(integration.id)
        .patch({
          name: accountName,
          paymentEnabled: account.checkoutReady,
          payoutEnabled: false,
          options: {
            ...(integration.options || {}),
            ...account.options,
            environment: credentials.environment || 'production',
            providerDisconnected: false,
          },
        });
      integration = await this.paymentIntegrationModel()
        .query()
        .findById(integration.id);
    } else {
      integration = await this.paymentIntegrationModel()
        .query()
        .insertAndFetch({
          service: provider,
          name: accountName,
          accountId: externalAccountId,
          paymentEnabled: account.checkoutReady,
          payoutEnabled: false,
          options: {
            ...account.options,
            environment: credentials.environment || 'production',
            providerDisconnected: false,
          },
        });
      await this.credentials.save(integration.id, credentials);
    }

    return {
      id: integration.id,
      provider: integration.service,
      name: integration.name,
      externalAccountId: integration.accountId,
      paymentEnabled: integration.paymentEnabled,
      payoutEnabled: integration.payoutEnabled,
    };
  }

  public async refresh(integrationId: number) {
    const integration = await this.paymentIntegrationModel()
      .query()
      .findById(integrationId)
      .throwIfNotFound();
    const provider = integration.service as PaymentProvider;
    if (
      !['Square', 'PayPal', 'Authorize.Net'].includes(provider) ||
      integration.options?.providerDisconnected
    ) {
      throw new BadRequestException('This payment account is not connected.');
    }
    const credentials = await this.credentials.read(integrationId);
    const account = await this.validateProvider(provider, credentials);
    if (account.id !== integration.accountId) {
      throw new BadRequestException(
        'The provider credentials belong to a different account.',
      );
    }
    await this.paymentIntegrationModel()
      .query()
      .findById(integrationId)
      .patch({
        paymentEnabled: account.checkoutReady,
        options: {
          ...(integration.options || {}),
          ...account.options,
          checkoutStatus: account.checkoutReady
            ? 'ready'
            : 'permissions_required',
        },
      });
    return {
      id: integrationId,
      provider,
      checkoutReady: account.checkoutReady,
      historySyncReady: !!integration.payoutEnabled,
    };
  }

  public async disconnect(integrationId: number) {
    const integration = await this.paymentIntegrationModel()
      .query()
      .findById(integrationId)
      .throwIfNotFound();
    if (!['Square', 'PayPal', 'Authorize.Net'].includes(integration.service)) {
      throw new BadRequestException(
        'This provider cannot be disconnected here.',
      );
    }
    await this.paymentIntegrationModel()
      .query()
      .findById(integrationId)
      .patch({
        paymentEnabled: false,
        payoutEnabled: false,
        options: { ...(integration.options || {}), providerDisconnected: true },
      });
    await this.deleteCredentials(integrationId);
  }

  private async deleteCredentials(integrationId: number) {
    await this.credentials.remove(integrationId);
  }

  private normalize(provider: PaymentProvider, input: ProviderCredentials) {
    const value = {
      ...input,
      accessToken: input.accessToken?.trim(),
      clientId: input.clientId?.trim(),
      clientSecret: input.clientSecret?.trim(),
      apiLoginId: input.apiLoginId?.trim(),
      transactionKey: input.transactionKey?.trim(),
      environment: input.environment || 'production',
    };
    if (value.environment !== 'sandbox' && value.environment !== 'production') {
      throw new BadRequestException(
        'Environment must be sandbox or production.',
      );
    }
    if (
      provider === 'Square' &&
      (!value.accessToken || value.accessToken.length < 20)
    ) {
      throw new BadRequestException('A Square access token is required.');
    }
    if (provider === 'PayPal' && (!value.clientId || !value.clientSecret)) {
      throw new BadRequestException(
        'PayPal client ID and secret are required.',
      );
    }
    if (
      provider === 'Authorize.Net' &&
      (!value.apiLoginId || !value.transactionKey)
    ) {
      throw new BadRequestException(
        'Authorize.Net API Login ID and Transaction Key are required.',
      );
    }
    return value;
  }

  private async validateProvider(
    provider: PaymentProvider,
    credentials: ProviderCredentials,
  ): Promise<{
    id: string;
    name: string;
    checkoutReady: boolean;
    options?: Record<string, string>;
  }> {
    if (provider === 'Square') {
      const squareBase =
        credentials.environment === 'sandbox'
          ? 'https://connect.squareupsandbox.com'
          : 'https://connect.squareup.com';
      const response = await fetch(squareBase + '/v2/locations', {
        headers: {
          Authorization: 'Bearer ' + credentials.accessToken,
          'Square-Version': '2025-01-23',
        },
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (!response.ok) {
        const firstError = body.errors?.[0];
        const detail =
          firstError?.detail || firstError?.code || response.statusText;
        throw new BadRequestException(
          'Square could not validate this production token (HTTP ' +
            response.status +
            (detail ? ': ' + detail : '') +
            '). Check that it is a live token with the MERCHANT_PROFILE_READ permission.',
        );
      }
      const location =
        body.locations?.find((row) => row.status === 'ACTIVE') ||
        body.locations?.[0];
      if (!location?.merchant_id || !location?.id) {
        throw new BadRequestException(
          'Square returned no usable merchant location.',
        );
      }
      const statusResponse = await fetch(squareBase + '/oauth2/token/status', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + credentials.accessToken,
          'Square-Version': '2025-01-23',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
      const status = await statusResponse.json();
      if (!statusResponse.ok || status.merchant_id !== location.merchant_id) {
        throw new BadRequestException(
          'Square token status did not match the merchant account.',
        );
      }
      const requiredScopes = [
        'ORDERS_READ',
        'ORDERS_WRITE',
        'PAYMENTS_READ',
        'PAYMENTS_WRITE',
      ];
      const checkoutReady =
        location.status === 'ACTIVE' &&
        requiredScopes.every((scope) => status.scopes?.includes(scope));
      return {
        id: location.merchant_id,
        name: location.business_name || 'Square',
        checkoutReady,
        options: {
          locationId: location.id,
          checkoutStatus: checkoutReady ? 'ready' : 'permissions_required',
        },
      };
    }

    if (provider === 'PayPal') {
      const sandbox = credentials.environment === 'sandbox';
      const base = sandbox
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';
      const basic = Buffer.from(
        credentials.clientId + ':' + credentials.clientSecret,
      ).toString('base64');
      const response = await fetch(base + '/v1/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + basic,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(15000),
      });
      const token = await response.json();
      if (!response.ok || !token.access_token) {
        const detail =
          token.error_description || token.error || response.statusText;
        throw new BadRequestException(
          'PayPal could not validate these production app credentials (HTTP ' +
            response.status +
            (detail ? ': ' + detail : '') +
            '). Verify that both values come from a live REST app.',
        );
      }
      const scopes = String(token.scope || '').split(/\s+/);
      const checkoutReady = scopes.some((scope) =>
        scope.includes('/payments/payment'),
      );
      return {
        id: credentials.clientId!,
        name: 'PayPal merchant',
        checkoutReady,
        options: {
          checkoutStatus: checkoutReady ? 'ready' : 'permissions_required',
        },
      };
    }

    const sandbox = credentials.environment === 'sandbox';
    const response = await fetch(
      sandbox
        ? 'https://apitest.authorize.net/xml/v1/request.api'
        : 'https://api.authorize.net/xml/v1/request.api',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          getMerchantDetailsRequest: {
            merchantAuthentication: {
              name: credentials.apiLoginId,
              transactionKey: credentials.transactionKey,
            },
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const body = await response.json();
    if (!response.ok || body.messages?.resultCode !== 'Ok') {
      throw new BadRequestException(
        'Authorize.Net rejected the supplied API credentials.',
      );
    }
    const merchant = body.getMerchantDetailsResponse?.merchantAccount;
    return {
      id: credentials.apiLoginId!,
      name: merchant?.name || 'Authorize.Net merchant',
      checkoutReady: false,
    };
  }
}

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ConfigService } from '@nestjs/config';
import { PLAID_CLIENT } from '@/modules/Plaid/Plaid.module';
import { CountryCode, PlaidApi, Products } from 'plaid';

@Injectable()
export class PlaidLinkTokenService {
  constructor(
    private readonly clsService: ClsService,
    public readonly configService: ConfigService,

    @Inject(PLAID_CLIENT)
    private readonly plaidClient: PlaidApi,
  ) {}

  /**
   * Retrieves the plaid link token.
   * @param {number} tenantId
   * @returns
   */
  public async getLinkToken() {
    const userId = this.clsService.get<string | number>('userId');
    const organizationId = this.clsService.get<string | number>(
      'organizationId',
    );
    if (!userId || !organizationId) {
      throw new UnauthorizedException(
        'Sign in before connecting a financial account.',
      );
    }

    // Must include transactions in order to receive transaction webhooks.
    const linkTokenParams = {
      user: {
        client_user_id: 'freebooks-' + organizationId + '-' + userId,
      },
      client_name: 'FreeBooks',
      products: [Products.Transactions],
      ...(this.configService.get<boolean>('plaid.investmentsEnabled')
        ? { optional_products: [Products.Investments] }
        : {}),
      country_codes: [CountryCode.Us],
      language: 'en',
      webhook: this.configService.get('plaid.linkWebhook'),
      ...(this.configService.get<string>('plaid.redirectUri')
        ? { redirect_uri: this.configService.get<string>('plaid.redirectUri') }
        : {}),
    };
    const createResponse =
      await this.plaidClient.linkTokenCreate(linkTokenParams);

    return createResponse.data;
  }
}

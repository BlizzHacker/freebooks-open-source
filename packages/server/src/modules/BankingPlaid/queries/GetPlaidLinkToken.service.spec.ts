import plaidConfig from '@/common/config/plaid';
import { PlaidLinkTokenService } from './GetPlaidLinkToken.service';

describe('PlaidLinkTokenService', () => {
  it('shows the FreeBooks client name in Plaid Link', async () => {
    const plaidClient = {
      linkTokenCreate: jest
        .fn()
        .mockResolvedValue({ data: { link_token: 'link-token' } }),
    };
    const configService = { get: jest.fn(() => undefined) };
    const clsService = {
      get: jest.fn((key: string) =>
        key === 'userId' ? 1 : key === 'organizationId' ? 2 : undefined,
      ),
    };
    const service = new PlaidLinkTokenService(
      clsService as any,
      configService as any,
      plaidClient as any,
    );

    await expect(service.getLinkToken()).resolves.toEqual({
      link_token: 'link-token',
    });
    expect(plaidClient.linkTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({ client_name: 'FreeBooks' }),
    );
  });
});

describe('plaid config', () => {
  it('uses the FreeBooks name in Plaid Link', () => {
    expect(plaidConfig().clientName).toBe('FreeBooks');
  });
});

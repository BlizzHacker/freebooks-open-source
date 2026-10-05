import knex from 'knex';
import { TenancyDatabaseProxyProvider } from './TenancyDB.module';

jest.mock('knex', () => ({
  __esModule: true,
  default: jest.fn(() => ({ destroy: jest.fn() })),
}));
jest.mock('nestjs-cls', () => ({
  ClsModule: {
    forFeatureAsync: (options: unknown) => options,
  },
  ClsService: class {},
}));
jest.mock('./UnitOfWork.service', () => ({
  UnitOfWork: class {},
}));

describe('Tenant database naming', () => {
  beforeEach(() => jest.clearAllMocks());

  async function connection(
    prefix: string | undefined,
    organizationId: string,
  ) {
    const values = {
      'tenantDatabase.dbNamePrefix': prefix,
      'tenantDatabase.client': 'mysql2',
    };
    const config = { get: jest.fn((name: string) => values[name]) };
    const cls = { get: jest.fn(() => organizationId) };
    const factory = await (TenancyDatabaseProxyProvider as any).useFactory(
      config,
      cls,
    );
    factory();
    return (knex as unknown as jest.Mock).mock.calls[0][0].connection.database;
  }

  it('uses the configured prefix for isolated self-hosted installs', async () => {
    expect(await connection('freebooks_tenant_', 'selfhost_regression')).toBe(
      'freebooks_tenant_selfhost_regression',
    );
  });

  it('retains the legacy prefix when no prefix is configured', async () => {
    expect(await connection(undefined, 'legacy_regression')).toBe(
      'bigcapital_tenant_legacy_regression',
    );
  });

  it('does not reuse a cache entry from another prefix', async () => {
    await connection('alpha_', 'cache_regression');
    jest.clearAllMocks();
    expect(await connection('beta_', 'cache_regression')).toBe(
      'beta_cache_regression',
    );
  });
});

import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpRequestBody, OpResponseBody } from './utils';

export const ORGANIZATION_ROUTES = {
  CURRENT: '/api/organization/current',
  BUILD: '/api/organization/build',
  BUILD_JOB: '/api/organization/build/{buildJobId}',
  BASE_CURRENCY_MUTATE: '/api/organization/base-currency-mutate',
  UPDATE: '/api/organization',
} as const satisfies Record<string, keyof paths>;

export type OrganizationCurrent = OpResponseBody<OpForPath<typeof ORGANIZATION_ROUTES.CURRENT, 'get'>>;
export type OrganizationBuildJob = OpResponseBody<OpForPath<typeof ORGANIZATION_ROUTES.BUILD_JOB, 'get'>>;
export type UpdateOrganizationBody = OpRequestBody<OpForPath<typeof ORGANIZATION_ROUTES.UPDATE, 'put'>>;
export type BuildOrganizationBody = OpRequestBody<OpForPath<typeof ORGANIZATION_ROUTES.BUILD, 'post'>>;
export type BuildOrganizationResponse = OpResponseBody<OpForPath<typeof ORGANIZATION_ROUTES.BUILD, 'post'>>;
export type OrgBaseCurrencyMutateAbilitiesResponse = OpResponseBody<
  OpForPath<typeof ORGANIZATION_ROUTES.BASE_CURRENCY_MUTATE, 'get'>
>;

export async function fetchOrganizationCurrent(fetcher: ApiFetcher): Promise<OrganizationCurrent> {
  const get = fetcher.path(ORGANIZATION_ROUTES.CURRENT).method('get').create();
  const { data } = await get({});
  return data;
}

export async function buildOrganization(
  fetcher: ApiFetcher,
  values: BuildOrganizationBody
): Promise<BuildOrganizationResponse> {
  const post = fetcher.path(ORGANIZATION_ROUTES.BUILD).method('post').create();
  const { data } = await post(values as never);
  return data;
}

export async function fetchOrgBaseCurrencyMutateAbilities(
  fetcher: ApiFetcher
): Promise<OrgBaseCurrencyMutateAbilitiesResponse> {
  const get = fetcher
    .path(ORGANIZATION_ROUTES.BASE_CURRENCY_MUTATE)
    .method('get')
    .create();
  const { data } = await get({});
  return data;
}

export async function updateOrganization(
  fetcher: ApiFetcher,
  values: UpdateOrganizationBody
): Promise<void> {
  const put = fetcher.path(ORGANIZATION_ROUTES.UPDATE).method('put').create();
  await put(values);
}

export type Organization = OrganizationCurrent;
export async function fetchOrganization(fetcher: ApiFetcher): Promise<Organization> {
  return fetchOrganizationCurrent(fetcher);
}

export async function fetchOrganizationBuildJob(
  fetcher: ApiFetcher,
  buildJobId: number | string
): Promise<OrganizationBuildJob> {
  const get = fetcher.path(ORGANIZATION_ROUTES.BUILD_JOB).method('get').create();
  const { data } = await get({ buildJobId: Number(buildJobId) });
  return data;
}

import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpResponseBody } from './utils';

export const DASHBOARD_ROUTES = {
  BOOT: '/api/dashboard/boot',
} as const satisfies Record<string, keyof paths>;

export type GetDashboardBootMetaResponse = OpResponseBody<
  OpForPath<typeof DASHBOARD_ROUTES.BOOT, 'get'>
>;

export async function fetchDashboardBootMeta(
  fetcher: ApiFetcher
): Promise<GetDashboardBootMetaResponse> {
  const get = fetcher.path(DASHBOARD_ROUTES.BOOT).method('get').create();
  const { data } = await get({});
  return data;
}

import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpResponseBody } from './utils';

export const VIEWS_ROUTES = {
  RESOURCE: '/api/views/resource/{resourceModel}',
} as const satisfies Record<string, keyof paths>;

export type ResourceViewResponse = OpResponseBody<OpForPath<typeof VIEWS_ROUTES.RESOURCE, 'get'>>;

export async function fetchResourceView(
  fetcher: ApiFetcher,
  resourceModel: string
): Promise<ResourceViewResponse> {
  const get = fetcher.path(VIEWS_ROUTES.RESOURCE).method('get').create();
  const { data } = await get({ resourceModel });
  return data;
}

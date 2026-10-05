import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpResponseBody } from './utils';

export const GENERIC_RESOURCE_ROUTES = {
  META: '/api/resources/{resourceModel}/meta',
} as const satisfies Record<string, keyof paths>;

export type ResourceMetaResponse = OpResponseBody<OpForPath<typeof GENERIC_RESOURCE_ROUTES.META, 'get'>>;

export async function fetchResourceMeta(
  fetcher: ApiFetcher,
  resourceModel: string
): Promise<ResourceMetaResponse> {
  const get = fetcher.path(GENERIC_RESOURCE_ROUTES.META).method('get').create();
  const { data } = await get({ resourceModel });
  return data;
}

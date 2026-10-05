import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpResponseBody } from './utils';

export const MISC_ROUTES = {
  DATE_FORMATS: '/api/date-formats',
} as const satisfies Record<string, keyof paths>;

export type DateFormatsResponse = OpResponseBody<
  OpForPath<typeof MISC_ROUTES.DATE_FORMATS, 'get'>
>;

export async function fetchDateFormats(
  fetcher: ApiFetcher,
): Promise<DateFormatsResponse> {
  const get = fetcher.path(MISC_ROUTES.DATE_FORMATS).method('get').create();
  const { data } = await get({});
  return data;
}

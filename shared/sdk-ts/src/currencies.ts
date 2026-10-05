import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpRequestBody, OpResponseBody } from './utils';

export const CURRENCIES_ROUTES = {
  LIST: '/api/currencies',
  BY_ID: '/api/currencies/{id}',
  BY_CODE: '/api/currencies/{code}',
  BY_CURRENCY_CODE: '/api/currencies/{currencyCode}',
} as const satisfies Record<string, keyof paths>;

export type CurrenciesListResponse = OpResponseBody<OpForPath<typeof CURRENCIES_ROUTES.LIST, 'get'>>;
export type Currency = OpResponseBody<OpForPath<typeof CURRENCIES_ROUTES.BY_CURRENCY_CODE, 'get'>>;
export type CreateCurrencyBody = OpRequestBody<OpForPath<typeof CURRENCIES_ROUTES.LIST, 'post'>>;
export type EditCurrencyBody = OpRequestBody<OpForPath<typeof CURRENCIES_ROUTES.BY_ID, 'put'>>;

export async function fetchCurrencies(fetcher: ApiFetcher): Promise<CurrenciesListResponse> {
  const get = fetcher.path(CURRENCIES_ROUTES.LIST).method('get').create();
  const { data } = await get({});
  return data;
}

export async function fetchCurrencyByCode(fetcher: ApiFetcher, currencyCode: string): Promise<Currency> {
  const get = fetcher.path(CURRENCIES_ROUTES.BY_CURRENCY_CODE).method('get').create();
  const { data } = await get({ currencyCode });
  return data;
}

/** @deprecated Use fetchCurrencyByCode - schema has no get by id */
export async function fetchCurrency(fetcher: ApiFetcher, id: number): Promise<Currency> {
  return fetchCurrencyByCode(fetcher, String(id));
}

export async function createCurrency(
  fetcher: ApiFetcher,
  values: CreateCurrencyBody
): Promise<void> {
  const post = fetcher.path(CURRENCIES_ROUTES.LIST).method('post').create();
  await post(values as never);
}

export async function editCurrency(
  fetcher: ApiFetcher,
  id: number,
  values: EditCurrencyBody
): Promise<void> {
  const put = fetcher.path(CURRENCIES_ROUTES.BY_ID).method('put').create();
  await put({ id, ...values } as never);
}

export async function deleteCurrency(fetcher: ApiFetcher, code: string): Promise<void> {
  const del = fetcher.path(CURRENCIES_ROUTES.BY_CODE).method('delete').create();
  await del({ code });
}

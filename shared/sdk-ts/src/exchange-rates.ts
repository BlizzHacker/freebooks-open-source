import type { ApiFetcher } from './fetch-utils';

export const EXCHANGE_RATES_ROUTES = {
  LATEST: '/api/exchange-rates/latest',
} as const;

/** Query params for GET /api/exchange-rates/latest */
export interface ExchangeRateLatestQuery {
  /** Source currency code (ISO 4217) */
  from_currency?: string;
  /** Target currency code (ISO 4217) */
  to_currency?: string;
}

/** Response for GET /api/exchange-rates/latest */
export interface ExchangeRateLatestResponse {
  /** The base currency code */
  baseCurrency: string;
  /** The target currency code */
  toCurrency: string;
  /** The exchange rate value */
  exchangeRate: number;
}

/**
 * Fetches the latest exchange rate for the given currency pair.
 * @param fetcher - The API fetcher instance
 * @param query - Query parameters containing from_currency and/or to_currency
 * @returns The exchange rate response with baseCurrency, toCurrency, and exchangeRate
 */
export async function fetchLatestExchangeRate(
  fetcher: ApiFetcher,
  query?: ExchangeRateLatestQuery,
): Promise<ExchangeRateLatestResponse> {
  const get = fetcher
    .path(EXCHANGE_RATES_ROUTES.LATEST as never)
    .method('get')
    .create();
  const { data } = await get((query ?? {}) as never);
  return data as ExchangeRateLatestResponse;
}

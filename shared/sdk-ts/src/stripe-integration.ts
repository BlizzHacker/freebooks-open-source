import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';

export const STRIPE_INTEGRATION_ROUTES = {
  GET_LINK: '/api/stripe/link',
  CALLBACK: '/api/stripe/callback',
  ACCOUNT_LINK: '/api/stripe/account_link',
  ACCOUNT: '/api/stripe/account',
  ACCOUNT_SESSION: '/api/stripe/account_session',
} as const;

export interface GetStripeConnectLinkResponse {
  url: string;
}

export interface ExchangeStripeOAuthBody {
  code: string;
  state: string;
}

export interface CreateStripeAccountLinkBody {
  stripeAccountId: string;
}

export interface StripeAccountLinkResponse {
  url: string;
  created: number;
  expires_at: number;
  object: string;
}

export interface CreateStripeAccountLinkResponse {
  clientSecret: StripeAccountLinkResponse;
}

export async function fetchGetStripeConnectLink(
  fetcher: ApiFetcher,
): Promise<GetStripeConnectLinkResponse> {
  const get = fetcher
    .path(STRIPE_INTEGRATION_ROUTES.GET_LINK)
    .method('get')
    .create();
  const { data } = await get({});
  return data as GetStripeConnectLinkResponse;
}

export async function fetchExchangeStripeOAuth(
  fetcher: ApiFetcher,
  body: ExchangeStripeOAuthBody,
): Promise<void> {
  const post = fetcher
    .path(STRIPE_INTEGRATION_ROUTES.CALLBACK)
    .method('post')
    .create();
  await post(body as never);
}

export async function fetchCreateStripeAccountLink(
  fetcher: ApiFetcher,
  body: CreateStripeAccountLinkBody,
): Promise<CreateStripeAccountLinkResponse> {
  const post = fetcher
    .path(STRIPE_INTEGRATION_ROUTES.ACCOUNT_LINK)
    .method('post')
    .create();
  const { data } = await post(body as never);
  return data as CreateStripeAccountLinkResponse;
}

export interface CreateStripeAccountResponse {
  account_id: string;
}

export interface CreateStripeAccountSessionBody {
  account?: string;
}

export interface CreateStripeAccountSessionResponse {
  client_secret: string;
}

export async function fetchCreateStripeAccount(
  fetcher: ApiFetcher,
): Promise<CreateStripeAccountResponse> {
  const post = fetcher
    .path(STRIPE_INTEGRATION_ROUTES.ACCOUNT)
    .method('post')
    .create();
  const { data } = await post({});
  return data as CreateStripeAccountResponse;
}

export async function fetchCreateStripeAccountSession(
  fetcher: ApiFetcher,
  body: CreateStripeAccountSessionBody,
): Promise<CreateStripeAccountSessionResponse> {
  const post = fetcher
    .path(STRIPE_INTEGRATION_ROUTES.ACCOUNT_SESSION)
    .method('post')
    .create();
  const { data } = await post(body as never);
  return data as CreateStripeAccountSessionResponse;
}

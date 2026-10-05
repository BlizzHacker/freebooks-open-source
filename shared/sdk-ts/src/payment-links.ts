import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpResponseBody, OpResponseBodyPdf } from './utils';

export const PAYMENT_LINKS_ROUTES = {
  GET_INVOICE: '/api/payment-links/{paymentLinkId}/invoice',
  CREATE_STRIPE_CHECKOUT_SESSION:
    '/api/payment-links/{paymentLinkId}/stripe_checkout_session',
  GET_INVOICE_PDF: '/api/payment-links/{paymentLinkId}/invoice/pdf',
} as const satisfies Record<string, keyof paths>;

type GetInvoiceOp = OpForPath<
  (typeof PAYMENT_LINKS_ROUTES)['GET_INVOICE'],
  'get'
>;
type CreateCheckoutSessionOp = OpForPath<
  (typeof PAYMENT_LINKS_ROUTES)['CREATE_STRIPE_CHECKOUT_SESSION'],
  'post'
>;
type GetInvoicePdfOp = OpForPath<
  (typeof PAYMENT_LINKS_ROUTES)['GET_INVOICE_PDF'],
  'get'
>;

export type GetInvoicePaymentLinkResponse = GetInvoiceOp extends {
  responses: { 200: { content: { 'application/json': infer R } } };
}
  ? R extends { data?: infer D }
    ? D
    : R
  : unknown;

export type CreateStripeCheckoutSessionResponse =
  OpResponseBody<CreateCheckoutSessionOp>;
export type GetPaymentLinkInvoicePdfResponse = OpResponseBodyPdf<GetInvoicePdfOp>;

export async function fetchGetInvoicePaymentLink(
  fetcher: ApiFetcher,
  paymentLinkId: string,
): Promise<GetInvoicePaymentLinkResponse> {
  const get = fetcher
    .path(PAYMENT_LINKS_ROUTES.GET_INVOICE)
    .method('get')
    .create();
  const { data } = await get({ paymentLinkId });
  const body = data as { data?: GetInvoicePaymentLinkResponse };
  return body?.data ?? (body as GetInvoicePaymentLinkResponse);
}

export async function fetchCreateStripeCheckoutSession(
  fetcher: ApiFetcher,
  paymentLinkId: string,
): Promise<CreateStripeCheckoutSessionResponse> {
  const post = fetcher
    .path(PAYMENT_LINKS_ROUTES.CREATE_STRIPE_CHECKOUT_SESSION)
    .method('post')
    .create();
  const { data } = await post({ paymentLinkId });
  return data as CreateStripeCheckoutSessionResponse;
}

export async function fetchGetPaymentLinkInvoicePdf(
  fetcher: ApiFetcher,
  paymentLinkId: string,
): Promise<Blob> {
  const get = fetcher
    .path(PAYMENT_LINKS_ROUTES.GET_INVOICE_PDF)
    .method('get')
    .create();
  const response = await get({ paymentLinkId });
  return (response.data as Blob) ?? response.data;
}

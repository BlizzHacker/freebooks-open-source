import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpQueryParams, OpRequestBody, OpResponseBody } from './utils';

export const CUSTOMERS_ROUTES = {
  LIST: '/api/customers',
  BY_ID: '/api/customers/{id}',
  OPENING_BALANCE: '/api/customers/{id}/opening-balance',
  VALIDATE_BULK_DELETE: '/api/customers/validate-bulk-delete',
  BULK_DELETE: '/api/customers/bulk-delete',
} as const satisfies Record<string, keyof paths>;

export type CustomersListResponse = OpResponseBody<OpForPath<typeof CUSTOMERS_ROUTES.LIST, 'get'>>;
export type Customer = OpResponseBody<OpForPath<typeof CUSTOMERS_ROUTES.BY_ID, 'get'>>;
export type CreateCustomerBody = OpRequestBody<OpForPath<typeof CUSTOMERS_ROUTES.LIST, 'post'>>;
export type EditCustomerBody = OpRequestBody<OpForPath<typeof CUSTOMERS_ROUTES.BY_ID, 'put'>>;
export type ValidateBulkDeleteCustomersResponse = OpResponseBody<OpForPath<typeof CUSTOMERS_ROUTES.VALIDATE_BULK_DELETE, 'post'>>;
export type BulkDeleteCustomersBody = OpRequestBody<OpForPath<typeof CUSTOMERS_ROUTES.BULK_DELETE, 'post'>>;
export type GetCustomersQuery = OpQueryParams<OpForPath<typeof CUSTOMERS_ROUTES.LIST, 'get'>>;
export type EditCustomerOpeningBalanceBody = OpRequestBody<OpForPath<typeof CUSTOMERS_ROUTES.OPENING_BALANCE, 'put'>>;
export type EditCustomerOpeningBalanceResponse = OpResponseBody<OpForPath<typeof CUSTOMERS_ROUTES.OPENING_BALANCE, 'put'>>;

export async function fetchCustomers(
  fetcher: ApiFetcher,
  query?: GetCustomersQuery
): Promise<CustomersListResponse> {
  const get = fetcher.path(CUSTOMERS_ROUTES.LIST).method('get').create();
  const { data } = await (get as (params: GetCustomersQuery) => Promise<{ data: CustomersListResponse }>)(
    query ?? {}
  );
  return data;
}

export async function fetchCustomer(fetcher: ApiFetcher, id: number): Promise<Customer> {
  const get = fetcher.path(CUSTOMERS_ROUTES.BY_ID).method('get').create();
  const { data } = await get({ id });
  return data;
}

export async function createCustomer(
  fetcher: ApiFetcher,
  values: CreateCustomerBody
): Promise<void> {
  const post = fetcher.path(CUSTOMERS_ROUTES.LIST).method('post').create();
  await post(values);
}

export async function editCustomer(
  fetcher: ApiFetcher,
  id: number,
  values: EditCustomerBody
): Promise<void> {
  const put = fetcher.path(CUSTOMERS_ROUTES.BY_ID).method('put').create();
  await put({ id, ...values });
}

export async function deleteCustomer(fetcher: ApiFetcher, id: number): Promise<void> {
  const del = fetcher.path(CUSTOMERS_ROUTES.BY_ID).method('delete').create();
  await del({ id });
}

export async function validateBulkDeleteCustomers(
  fetcher: ApiFetcher,
  body: BulkDeleteCustomersBody
): Promise<ValidateBulkDeleteCustomersResponse> {
  const validate = fetcher.path(CUSTOMERS_ROUTES.VALIDATE_BULK_DELETE).method('post').create();
  const { data } = await validate(body);
  return data;
}

export async function bulkDeleteCustomers(
  fetcher: ApiFetcher,
  body: BulkDeleteCustomersBody
): Promise<void> {
  const post = fetcher.path(CUSTOMERS_ROUTES.BULK_DELETE).method('post').create();
  await post(body);
}

export async function editCustomerOpeningBalance(
  fetcher: ApiFetcher,
  id: number,
  values: EditCustomerOpeningBalanceBody
): Promise<EditCustomerOpeningBalanceResponse> {
  const put = fetcher.path(CUSTOMERS_ROUTES.OPENING_BALANCE).method('put').create();
  const { data } = await put({ id, ...values });
  return data;
}

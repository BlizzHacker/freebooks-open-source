import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpQueryParams, OpRequestBody, OpResponseBody } from './utils';

export const EXPENSES_ROUTES = {
  LIST: '/api/expenses',
  BY_ID: '/api/expenses/{id}',
  PUBLISH: '/api/expenses/{id}/publish',
  VALIDATE_BULK_DELETE: '/api/expenses/validate-bulk-delete',
  BULK_DELETE: '/api/expenses/bulk-delete',
} as const satisfies Record<string, keyof paths>;

export type ExpensesListResponse = OpResponseBody<OpForPath<typeof EXPENSES_ROUTES.LIST, 'get'>>;
export type Expense = OpResponseBody<OpForPath<typeof EXPENSES_ROUTES.BY_ID, 'get'>>;
export type CreateExpenseBody = OpRequestBody<OpForPath<typeof EXPENSES_ROUTES.LIST, 'post'>>;
export type EditExpenseBody = OpRequestBody<OpForPath<typeof EXPENSES_ROUTES.BY_ID, 'put'>>;
export type GetExpensesQuery = OpQueryParams<OpForPath<typeof EXPENSES_ROUTES.LIST, 'get'>>;
export type BulkDeleteExpensesBody = OpRequestBody<
  OpForPath<typeof EXPENSES_ROUTES.BULK_DELETE, 'post'>
>;
export type ValidateBulkDeleteExpensesResponse = OpResponseBody<
  OpForPath<typeof EXPENSES_ROUTES.VALIDATE_BULK_DELETE, 'post'>
>;

export async function fetchExpenses(
  fetcher: ApiFetcher,
  query?: GetExpensesQuery
): Promise<ExpensesListResponse> {
  const get = fetcher.path(EXPENSES_ROUTES.LIST).method('get').create();
  const { data } = await (get as (params?: GetExpensesQuery) => Promise<{ data: ExpensesListResponse }>)(
    query ?? {}
  );
  return data;
}

export async function fetchExpense(fetcher: ApiFetcher, id: number): Promise<Expense> {
  const get = fetcher.path(EXPENSES_ROUTES.BY_ID).method('get').create();
  const { data } = await get({ id });
  return data;
}

export async function createExpense(
  fetcher: ApiFetcher,
  values: CreateExpenseBody
): Promise<void> {
  const post = fetcher.path(EXPENSES_ROUTES.LIST).method('post').create();
  await post(values);
}

export async function editExpense(
  fetcher: ApiFetcher,
  id: number,
  values: EditExpenseBody
): Promise<void> {
  const put = fetcher.path(EXPENSES_ROUTES.BY_ID).method('put').create();
  await put({ id, ...values });
}

export async function deleteExpense(fetcher: ApiFetcher, id: number): Promise<void> {
  const del = fetcher.path(EXPENSES_ROUTES.BY_ID).method('delete').create();
  await del({ id });
}

export async function publishExpense(fetcher: ApiFetcher, id: number): Promise<void> {
  const post = fetcher.path(EXPENSES_ROUTES.PUBLISH).method('post').create();
  await post({ id });
}

export async function bulkDeleteExpenses(
  fetcher: ApiFetcher,
  body: BulkDeleteExpensesBody
): Promise<void> {
  const post = fetcher.path(EXPENSES_ROUTES.BULK_DELETE).method('post').create();
  await post(body);
}

export async function validateBulkDeleteExpenses(
  fetcher: ApiFetcher,
  body: BulkDeleteExpensesBody
): Promise<ValidateBulkDeleteExpensesResponse> {
  const post = fetcher
    .path(EXPENSES_ROUTES.VALIDATE_BULK_DELETE)
    .method('post')
    .create();
  const { data } = await post(body);
  return data;
}

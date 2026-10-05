import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpQueryParams, OpRequestBody, OpResponseBody } from './utils';

export const MANUAL_JOURNALS_ROUTES = {
  LIST: '/api/manual-journals',
  BY_ID: '/api/manual-journals/{id}',
  PUBLISH: '/api/manual-journals/{id}/publish',
  VALIDATE_BULK_DELETE: '/api/manual-journals/validate-bulk-delete',
  BULK_DELETE: '/api/manual-journals/bulk-delete',
} as const satisfies Record<string, keyof paths>;

export type ManualJournalsListResponse = OpResponseBody<OpForPath<typeof MANUAL_JOURNALS_ROUTES.LIST, 'get'>>;
export type ManualJournal = OpResponseBody<OpForPath<typeof MANUAL_JOURNALS_ROUTES.BY_ID, 'get'>>;
export type CreateManualJournalBody = OpRequestBody<OpForPath<typeof MANUAL_JOURNALS_ROUTES.LIST, 'post'>>;
export type EditManualJournalBody = OpRequestBody<OpForPath<typeof MANUAL_JOURNALS_ROUTES.BY_ID, 'put'>>;
export type BulkDeleteManualJournalsBody = OpRequestBody<OpForPath<typeof MANUAL_JOURNALS_ROUTES.BULK_DELETE, 'post'>>;
export type ValidateBulkDeleteManualJournalsResponse = OpResponseBody<OpForPath<typeof MANUAL_JOURNALS_ROUTES.VALIDATE_BULK_DELETE, 'post'>>;
export type ManualJournalsListQuery = OpQueryParams<OpForPath<typeof MANUAL_JOURNALS_ROUTES.LIST, 'get'>>;

export async function fetchManualJournals(
  fetcher: ApiFetcher,
  query?: ManualJournalsListQuery
): Promise<ManualJournalsListResponse> {
  const get = fetcher.path(MANUAL_JOURNALS_ROUTES.LIST).method('get').create();
  const { data } = await (
    get as unknown as (params?: ManualJournalsListQuery) => Promise<{ data: ManualJournalsListResponse }>
  )(query ?? {});
  return data;
}

export async function fetchManualJournal(fetcher: ApiFetcher, id: number): Promise<ManualJournal> {
  const get = fetcher.path(MANUAL_JOURNALS_ROUTES.BY_ID).method('get').create();
  const { data } = await get({ id });
  return data;
}

export async function createManualJournal(
  fetcher: ApiFetcher,
  values: CreateManualJournalBody
): Promise<void> {
  const post = fetcher.path(MANUAL_JOURNALS_ROUTES.LIST).method('post').create();
  await post(values);
}

export async function editManualJournal(
  fetcher: ApiFetcher,
  id: number,
  values: EditManualJournalBody
): Promise<void> {
  const put = fetcher.path(MANUAL_JOURNALS_ROUTES.BY_ID).method('put').create();
  await put({ id, ...values });
}

export async function deleteManualJournal(fetcher: ApiFetcher, id: number): Promise<void> {
  const del = fetcher.path(MANUAL_JOURNALS_ROUTES.BY_ID).method('delete').create();
  await del({ id });
}

export async function publishManualJournal(fetcher: ApiFetcher, id: number): Promise<void> {
  const patch = fetcher.path(MANUAL_JOURNALS_ROUTES.PUBLISH).method('patch').create();
  await patch({ id });
}

export async function bulkDeleteManualJournals(
  fetcher: ApiFetcher,
  body: BulkDeleteManualJournalsBody
): Promise<void> {
  const post = fetcher.path(MANUAL_JOURNALS_ROUTES.BULK_DELETE).method('post').create();
  await post({ ids: body.ids, skipUndeletable: body.skipUndeletable ?? false });
}

export async function validateBulkDeleteManualJournals(
  fetcher: ApiFetcher,
  body: { ids: number[] }
): Promise<ValidateBulkDeleteManualJournalsResponse> {
  const post = fetcher.path(MANUAL_JOURNALS_ROUTES.VALIDATE_BULK_DELETE).method('post').create();
  const { data } = await post({ ids: body.ids, skipUndeletable: false });
  return data;
}

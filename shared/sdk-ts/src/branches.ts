import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpRequestBody, OpResponseBody } from './utils';

export const BRANCHES_ROUTES = {
  LIST: '/api/branches',
  BY_ID: '/api/branches/{id}',
  ACTIVATE: '/api/branches/activate',
  MARK_AS_PRIMARY: '/api/branches/{id}/mark-as-primary',
} as const satisfies Record<string, keyof paths>;

export type BranchesListResponse = OpResponseBody<OpForPath<typeof BRANCHES_ROUTES.LIST, 'get'>>;
export type Branch = OpResponseBody<OpForPath<typeof BRANCHES_ROUTES.BY_ID, 'get'>>;
export type CreateBranchBody = OpRequestBody<OpForPath<typeof BRANCHES_ROUTES.LIST, 'post'>>;
export type EditBranchBody = OpRequestBody<OpForPath<typeof BRANCHES_ROUTES.BY_ID, 'put'>>;

export async function fetchBranches(fetcher: ApiFetcher): Promise<BranchesListResponse> {
  const get = fetcher.path(BRANCHES_ROUTES.LIST).method('get').create();
  const { data } = await get({});
  return data;
}

export async function fetchBranch(fetcher: ApiFetcher, id: string): Promise<Branch> {
  const get = fetcher.path(BRANCHES_ROUTES.BY_ID).method('get').create();
  const { data } = await get({ id });
  return data;
}

export async function createBranch(
  fetcher: ApiFetcher,
  values: CreateBranchBody
): Promise<void> {
  const post = fetcher.path(BRANCHES_ROUTES.LIST).method('post').create();
  await post(values);
}

export async function editBranch(
  fetcher: ApiFetcher,
  id: string,
  values: EditBranchBody
): Promise<void> {
  const put = fetcher.path(BRANCHES_ROUTES.BY_ID).method('put').create();
  await put({ id, ...values });
}

export async function deleteBranch(fetcher: ApiFetcher, id: string): Promise<void> {
  const del = fetcher.path(BRANCHES_ROUTES.BY_ID).method('delete').create();
  await del({ id });
}

export async function activateBranches(fetcher: ApiFetcher): Promise<void> {
  const post = fetcher.path(BRANCHES_ROUTES.ACTIVATE).method('post').create();
  await post({});
}

export async function markBranchAsPrimary(fetcher: ApiFetcher, id: string): Promise<void> {
  const put = fetcher.path(BRANCHES_ROUTES.MARK_AS_PRIMARY).method('put').create();
  await put({ id });
}

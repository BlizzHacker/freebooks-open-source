import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpRequestBody, OpResponseBody } from './utils';

export const ROLES_ROUTES = {
  LIST: '/api/roles',
  BY_ID: '/api/roles/{id}',
  PERMISSIONS_SCHEMA: '/api/roles/permissions/schema',
} as const satisfies Record<string, keyof paths>;

export type RolesListResponse = OpResponseBody<OpForPath<typeof ROLES_ROUTES.LIST, 'get'>>;
export type Role = OpResponseBody<OpForPath<typeof ROLES_ROUTES.BY_ID, 'get'>>;
export type CreateRoleBody = OpRequestBody<OpForPath<typeof ROLES_ROUTES.LIST, 'post'>>;
export type EditRoleBody = OpRequestBody<OpForPath<typeof ROLES_ROUTES.BY_ID, 'put'>>;
export type RolePermissionsSchema = OpResponseBody<OpForPath<typeof ROLES_ROUTES.PERMISSIONS_SCHEMA, 'get'>>;

export async function fetchRoles(fetcher: ApiFetcher): Promise<RolesListResponse> {
  const get = fetcher.path(ROLES_ROUTES.LIST).method('get').create();
  const { data } = await get({});
  return data;
}

export async function fetchRole(fetcher: ApiFetcher, id: number): Promise<Role> {
  const get = fetcher.path(ROLES_ROUTES.BY_ID).method('get').create();
  const { data } = await get({ id });
  return data;
}

export async function createRole(
  fetcher: ApiFetcher,
  values: CreateRoleBody
): Promise<void> {
  const post = fetcher.path(ROLES_ROUTES.LIST).method('post').create();
  await post(values);
}

export async function editRole(
  fetcher: ApiFetcher,
  id: number,
  values: EditRoleBody
): Promise<void> {
  const put = fetcher.path(ROLES_ROUTES.BY_ID).method('put').create();
  await put({ id, ...values });
}

export async function deleteRole(fetcher: ApiFetcher, id: number): Promise<void> {
  const del = fetcher.path(ROLES_ROUTES.BY_ID).method('delete').create();
  await del({ id });
}

export async function fetchRolePermissionsSchema(fetcher: ApiFetcher): Promise<RolePermissionsSchema> {
  const get = fetcher.path(ROLES_ROUTES.PERMISSIONS_SCHEMA).method('get').create();
  const { data } = await get({});
  return data;
}

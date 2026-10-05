import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpRequestBody, OpResponseBody } from './utils';

export const WAREHOUSES_ROUTES = {
  LIST: '/api/warehouses',
  BY_ID: '/api/warehouses/{id}',
  ACTIVATE: '/api/warehouses/activate',
  MARK_PRIMARY: '/api/warehouses/{id}/mark-primary',
} as const satisfies Record<string, keyof paths>;

export type WarehousesListResponse = OpResponseBody<OpForPath<typeof WAREHOUSES_ROUTES.LIST, 'get'>>;
export type Warehouse = OpResponseBody<OpForPath<typeof WAREHOUSES_ROUTES.BY_ID, 'get'>>;
export type CreateWarehouseBody = OpRequestBody<OpForPath<typeof WAREHOUSES_ROUTES.LIST, 'post'>>;
export type EditWarehouseBody = OpRequestBody<OpForPath<typeof WAREHOUSES_ROUTES.BY_ID, 'put'>>;

export async function fetchWarehouses(fetcher: ApiFetcher): Promise<WarehousesListResponse> {
  const get = fetcher.path(WAREHOUSES_ROUTES.LIST).method('get').create();
  const { data } = await get({});
  return data;
}

export async function fetchWarehouse(fetcher: ApiFetcher, id: string): Promise<Warehouse> {
  const get = fetcher.path(WAREHOUSES_ROUTES.BY_ID).method('get').create();
  const { data } = await get({ id });
  return data;
}

export async function createWarehouse(
  fetcher: ApiFetcher,
  values: CreateWarehouseBody
): Promise<void> {
  const post = fetcher.path(WAREHOUSES_ROUTES.LIST).method('post').create();
  await post(values);
}

export async function editWarehouse(
  fetcher: ApiFetcher,
  id: string,
  values: EditWarehouseBody
): Promise<void> {
  const put = fetcher.path(WAREHOUSES_ROUTES.BY_ID).method('put').create();
  await put({ id, ...values });
}

export async function deleteWarehouse(fetcher: ApiFetcher, id: string): Promise<void> {
  const del = fetcher.path(WAREHOUSES_ROUTES.BY_ID).method('delete').create();
  await del({ id });
}

export async function activateWarehouses(fetcher: ApiFetcher): Promise<void> {
  const post = fetcher.path(WAREHOUSES_ROUTES.ACTIVATE).method('post').create();
  await post({});
}

export async function markWarehousePrimary(fetcher: ApiFetcher, id: string): Promise<void> {
  const put = fetcher.path(WAREHOUSES_ROUTES.MARK_PRIMARY).method('put').create();
  await put({ id });
}

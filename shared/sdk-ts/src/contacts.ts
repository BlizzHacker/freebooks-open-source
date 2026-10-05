import type { ApiFetcher } from './fetch-utils';
import { paths } from './schema';
import { OpForPath, OpResponseBody } from './utils';

const CONTACTS_ROUTES = {
  BY_ID: '/api/contacts/{id}',
  AUTO_COMPLETE: '/api/contacts/auto-complete',
  ACTIVATE: '/api/contacts/{id}/activate',
  INACTIVATE: '/api/contacts/{id}/inactivate',
} as const;

export { CONTACTS_ROUTES };

export type ContactResponse = OpResponseBody<OpForPath<typeof CONTACTS_ROUTES.BY_ID, 'get'>>;
export type ContactsAutoCompleteResponse = OpResponseBody<OpForPath<typeof CONTACTS_ROUTES.AUTO_COMPLETE, 'get'>>;

export async function fetchContact(fetcher: ApiFetcher, id: number): Promise<ContactResponse> {
  const get = fetcher.path(CONTACTS_ROUTES.BY_ID as keyof paths).method('get').create();
  const { data } = await get({ id });
  return data as ContactResponse;
}

export async function fetchContactsAutoComplete(fetcher: ApiFetcher): Promise<ContactsAutoCompleteResponse> {
  const get = fetcher.path(CONTACTS_ROUTES.AUTO_COMPLETE).method('get').create();
  const { data } = await get({});
  return data;
}

export async function activateContact(fetcher: ApiFetcher, id: number): Promise<void> {
  const patch = fetcher.path(CONTACTS_ROUTES.ACTIVATE).method('patch').create();
  await patch({ id });
}

export async function inactivateContact(fetcher: ApiFetcher, id: number): Promise<void> {
  const patch = fetcher.path(CONTACTS_ROUTES.INACTIVATE).method('patch').create();
  await patch({ id });
}

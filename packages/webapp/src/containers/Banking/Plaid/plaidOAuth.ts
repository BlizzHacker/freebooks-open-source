const STORAGE_KEY = 'freebooks-plaid-link-token';
const MAX_AGE_MS = 60 * 60 * 1000;

export function savePendingPlaidLinkToken(token: string): void {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token, savedAt: Date.now() }),
    );
  } catch {
    // Plaid Link can still complete in the current page if storage is blocked.
  }
}

export function getPendingPlaidLinkToken(): string | null {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const value = JSON.parse(stored);
    if (
      typeof value.token !== 'string' ||
      typeof value.savedAt !== 'number' ||
      Date.now() - value.savedAt > MAX_AGE_MS
    ) {
      clearPendingPlaidLinkToken();
      return null;
    }
    return value.token;
  } catch {
    return null;
  }
}

export function clearPendingPlaidLinkToken(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage might be unavailable in a restricted browser context.
  }
}

export function getPlaidOAuthReturnUri(): string | undefined {
  const url = new URL(window.location.href);
  return url.pathname === '/cashflow-accounts' &&
    url.searchParams.has('oauth_state_id')
    ? url.href
    : undefined;
}

export function clearPlaidOAuthReturnUri(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('oauth_state_id')) return;
  url.searchParams.delete('oauth_state_id');
  window.history.replaceState(
    window.history.state,
    '',
    url.pathname + url.search + url.hash,
  );
}

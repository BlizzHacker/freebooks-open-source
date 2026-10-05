import { LaunchLink } from '@/containers/Banking/Plaid/PlaidLanchLink';
import { useGetBankingPlaidToken } from '@/hooks/state/banking';
import {
  getPendingPlaidLinkToken,
  getPlaidOAuthReturnUri,
} from '@/containers/Banking/Plaid/plaidOAuth';

export function CashflowAccountsPlaidLink() {
  const plaidToken = useGetBankingPlaidToken();
  const receivedRedirectUri = getPlaidOAuthReturnUri();
  const token = receivedRedirectUri ? getPendingPlaidLinkToken() : plaidToken;

  if (!token) {
    return receivedRedirectUri ? (
      <div role="alert" className="freebooks-plaid-oauth-error">
        The bank sign-in session expired. Select Connect Bank/Credit Card to
        start again.
      </div>
    ) : null;
  }
  return <LaunchLink token={token} receivedRedirectUri={receivedRedirectUri} />;
}

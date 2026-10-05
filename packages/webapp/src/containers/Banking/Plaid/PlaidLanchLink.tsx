// @ts-nocheck
import React, { useEffect } from 'react';
import {
  usePlaidLink,
  PlaidLinkOnSuccessMetadata,
  PlaidLinkOnExitMetadata,
  PlaidLinkError,
  PlaidLinkOptionsWithLinkToken,
  PlaidLinkOnEventMetadata,
  PlaidLinkStableEvent,
} from 'react-plaid-link';
import { Intent } from '@blueprintjs/core';
import { AppToaster } from '@/components';
import {
  clearPendingPlaidLinkToken,
  clearPlaidOAuthReturnUri,
} from './plaidOAuth';
import { usePlaidExchangeToken } from '@/hooks/query';
import { useResetBankingPlaidToken } from '@/hooks/state/banking';

interface PlaidLaunchLinkProps {
  token: string;
  itemId?: number | null;
  receivedRedirectUri?: string;
  children?: React.ReactNode;
}

/**
 * Uses the usePlaidLink hook to manage the Plaid Link creation.
 * See https://github.com/plaid/react-plaid-link for full usage instructions.
 * The link token passed to usePlaidLink cannot be null.
 * It must be generated outside of this component.  In this sample app, the link token
 * is generated in the link context in client/src/services/link.js.
 *
 * @param {PlaidLaunchLinkProps} props
 * @returns {React.ReactNode}
 */
export function LaunchLink(props: PlaidLaunchLinkProps) {
  const resetPlaidToken = useResetBankingPlaidToken();
  const { mutateAsync: exchangeAccessToken } = usePlaidExchangeToken();

  // define onSuccess, onExit and onEvent functions as configs for Plaid Link creation
  const onSuccess = async (
    publicToken: string,
    metadata: PlaidLinkOnSuccessMetadata,
  ) => {
    if (props.itemId != null) {
      // update mode: no need to exchange public token
      // await setItemState(props.itemId, 'good');
      // deleteLinkToken(null, props.itemId);
      // getItemById(props.itemId, true);
      // regular link mode: exchange public token for access token
    } else {
      await exchangeAccessToken({
        public_token: publicToken,
        institution_id: metadata.institution.institution_id,
      });
    }
    clearPendingPlaidLinkToken();
    clearPlaidOAuthReturnUri();
    resetPlaidToken();
  };

  // Handle other error codes, see https://plaid.com/docs/errors/
  const onExit = async (
    error: PlaidLinkError | null,
    metadata: PlaidLinkOnExitMetadata,
  ) => {
    if (error != null) {
      AppToaster.show({
        message:
          error.display_message ||
          'Bank connection did not finish. Please try again.',
        intent: Intent.DANGER,
      });
    }
    clearPendingPlaidLinkToken();
    clearPlaidOAuthReturnUri();
    resetPlaidToken();
  };

  const onEvent = async (
    eventName: PlaidLinkStableEvent | string,
    metadata: PlaidLinkOnEventMetadata,
  ) => {
    if (eventName === 'ERROR' && metadata.error_code != null) {
      AppToaster.show({
        message: 'Bank connection error: ' + metadata.error_code,
        intent: Intent.DANGER,
      });
    }
  };

  const config: PlaidLinkOptionsWithLinkToken = {
    onSuccess,
    onExit,
    onEvent,
    token: props.token,
    ...(props.receivedRedirectUri
      ? { receivedRedirectUri: props.receivedRedirectUri }
      : {}),
  };

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    // initiallizes Link automatically
    if (ready) {
      open();
    }
  }, [ready, open, props.itemId, props.token]);

  return <></>;
}

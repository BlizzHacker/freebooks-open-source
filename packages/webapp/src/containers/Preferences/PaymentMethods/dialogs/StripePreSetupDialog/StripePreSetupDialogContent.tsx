import {
  Button,
  Callout,
  DialogBody,
  DialogFooter,
  Intent,
} from '@blueprintjs/core';
import { useState } from 'react';
import styled from 'styled-components';
import { usePaymentMethodsBoot } from '../../PreferencesPaymentMethodsBoot';
import { Stack } from '@/components';
import { useDialogContext } from '@/components/Dialog/DialogProvider';
import { useDialogActions } from '@/hooks/state';
import { CreditCard2Icon } from '@/icons/CreditCard2';
import { DollarIcon } from '@/icons/Dollar';
import { LayoutAutoIcon } from '@/icons/LayoutAuto';
import { SwitchIcon } from '@/icons/SwitchIcon';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';

export function StripePreSetupDialogContent() {
  const { name } = useDialogContext();
  const { closeDialog } = useDialogActions();
  const { paymentMethodsState } = usePaymentMethodsBoot();
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [isConnectingPlatform, setIsConnectingPlatform] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();

  const handleConnectPlatform = async () => {
    setIsConnectingPlatform(true);
    setConnectionError('');
    try {
      const response = await fetch('/api/stripe/platform-account', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(organizationId ? { 'organization-id': organizationId } : {}),
        },
        body: JSON.stringify({}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          result.message ||
            'Stripe could not validate the configured live account.',
        );
      }
      window.location.reload();
    } catch (error: any) {
      setConnectionError(error.message || 'Stripe connection failed.');
      setIsConnectingPlatform(false);
    }
  };

  const handleSetUpBtnClick = () => {
    if (paymentMethodsState?.stripe.stripeAuthLink) {
      setIsRedirecting(true);
      window.location.href = paymentMethodsState?.stripe.stripeAuthLink;
    }
  };
  // Handle cancel button click.
  const handleCancelBtnClick = () => {
    closeDialog(name);
  };

  return (
    <>
      <DialogBody>
        {connectionError && (
          <Callout intent={Intent.DANGER}>{connectionError}</Callout>
        )}
        <Stack style={{ paddingTop: 10, paddingBottom: 20 }}>
          <PaymentFeatureItem>
            <PaymentFeatureIcon>
              <LayoutAutoIcon size={16} />
            </PaymentFeatureIcon>{' '}
            If you're already using Stripe, you can connect your Stripe account
            to FreeBooks.
          </PaymentFeatureItem>

          <PaymentFeatureItem>
            <PaymentFeatureIcon>
              <DollarIcon size={16} />
            </PaymentFeatureIcon>{' '}
            Stripe applies a processing fee for each card payment, but we only
            charge for the application subscription.
          </PaymentFeatureItem>

          <PaymentFeatureItem>
            <PaymentFeatureIcon>
              <CreditCard2Icon size={16} />
            </PaymentFeatureIcon>{' '}
            Customers can pay invoice using credit card, debit card or digital
            wallets like Apple Pay or Google Pay.
          </PaymentFeatureItem>

          <PaymentFeatureItem>
            <PaymentFeatureIcon>
              <SwitchIcon size={16} />
            </PaymentFeatureIcon>{' '}
            You can enable or disable card payments for each invoice
          </PaymentFeatureItem>
        </Stack>
      </DialogBody>

      <DialogFooter
        actions={
          <>
            <Button onClick={handleCancelBtnClick}>Cancel</Button>
            <Button
              onClick={handleConnectPlatform}
              loading={isConnectingPlatform}
              disabled={
                !paymentMethodsState?.stripe.isStripeServerConfigured ||
                !token ||
                !organizationId
              }
            >
              Use configured Stripe account
            </Button>
            <Button
              intent={Intent.PRIMARY}
              onClick={handleSetUpBtnClick}
              loading={isRedirecting}
              disabled={!paymentMethodsState?.stripe.isStripeServerConfigured}
            >
              Connect a different Stripe account
            </Button>
          </>
        }
      ></DialogFooter>
    </>
  );
}

const PaymentFeatureItem = styled('div')`
  padding-left: 20px;
  position: relative;
  padding-left: 50px;
`;

const PaymentFeatureIcon = styled('span')`
  position: absolute;
  left: 12px;
  top: 2px;
  color: var(--color-primary);
`;

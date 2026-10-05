import {
  Button,
  Callout,
  Classes,
  Intent,
  Menu,
  MenuItem,
  Popover,
  Tag,
  Text,
} from '@blueprintjs/core';
import React from 'react';
import styled from 'styled-components';
import { usePaymentMethodsBoot } from './PreferencesPaymentMethodsBoot';
import { Box, Card, Group, Stack } from '@/components';
import { DialogsName } from '@/constants/dialogs';
import { DRAWERS } from '@/constants/drawers';
import {
  useAlertActions,
  useDialogActions,
  useDrawerActions,
} from '@/hooks/state';
import { useIsDarkMode } from '@/hooks/useDarkMode';
import { MoreIcon } from '@/icons/More';
import { StripeLogo } from '@/icons/StripeLogo';
import { StripePreSetupDialog } from './dialogs/StripePreSetupDialog/StripePreSetupDialog';
import { StripeIntegrationEditDrawer } from './drawers/StripeIntegrationEditDrawer';

export function StripePaymentMethod() {
  const { openDialog } = useDialogActions();
  const { openDrawer } = useDrawerActions();
  const { openAlert } = useAlertActions();
  const isDarkMode = useIsDarkMode();
  const { paymentMethodsState } = usePaymentMethodsBoot();
  const stripeState = (paymentMethodsState as any)?.stripe;
  const accounts = stripeState?.accounts ?? [];
  const isStripeServerConfigured = stripeState?.isStripeServerConfigured;
  const missingStripeConfiguration: string[] =
    stripeState?.stripeMissingConfiguration || [];

  const handleSetUpBtnClick = () => openDialog(DialogsName.StripeSetup);
  const handleEditBtnClick = (paymentMethodId: number) => {
    openDrawer(DRAWERS.STRIPE_PAYMENT_INTEGRATION_EDIT, {
      stripePaymentMethodId: paymentMethodId,
    });
  };
  const handleDeleteConnectionClick = (paymentMethodId: number) => {
    openAlert('delete-stripe-payment-method', { paymentMethodId });
  };

  return (
    <Card style={{ margin: 0 }}>
      {missingStripeConfiguration.length > 0 && (
        <Callout
          intent={Intent.WARNING}
          title="Stripe connection needs server setup"
          style={{ marginTop: 12 }}
        >
          Connect is disabled until the FreeBooks Stripe platform has its
          required settings: {missingStripeConfiguration.join(', ')}. The Stripe
          dashboard account link does not provide these platform credentials.
          Add them to the protected server configuration; never paste secret
          keys into chat.
        </Callout>
      )}
      <Group position="apart">
        <Group>
          <StripeLogo
            color={isDarkMode ? 'rgba(255, 255, 255, 0.85)' : '#0A2540'}
          />
          <Text>Stripe payment accounts</Text>
        </Group>
        <Button
          intent={Intent.PRIMARY}
          small
          disabled={!isStripeServerConfigured}
          onClick={handleSetUpBtnClick}
        >
          {accounts.length ? 'Add account' : 'Connect account'}
        </Button>
      </Group>

      {accounts.length === 0 && (
        <PaymentDescription className={Classes.TEXT_MUTED}>
          Connect a Stripe account to accept card payments on invoices.
        </PaymentDescription>
      )}

      {accounts.map((account: any) => (
        <StripeAccountRow key={account.id}>
          <Group position="apart">
            <Stack spacing={4}>
              <Group spacing={8}>
                <Text>{account.name || 'Stripe account'}</Text>
                {account.isStripeEnabled ? (
                  <Tag minimal intent={Intent.SUCCESS}>
                    Active
                  </Tag>
                ) : (
                  <Tag minimal intent={Intent.WARNING}>
                    Setup incomplete
                  </Tag>
                )}
              </Group>
              <Text className={Classes.TEXT_MUTED} style={{ fontSize: 12 }}>
                {account.stripeAccountId || 'Account ID unavailable'}
              </Text>
              {!account.isStripePaymentEnabled && (
                <Tag minimal intent={Intent.DANGER}>
                  Payments unavailable
                </Tag>
              )}
              {account.isStripePaymentEnabled &&
                !account.isStripePayoutEnabled && (
                  <Tag minimal intent={Intent.WARNING}>
                    Payouts unavailable
                  </Tag>
                )}
            </Stack>
            <Group spacing={8}>
              <Button small onClick={() => handleEditBtnClick(account.id)}>
                Edit
              </Button>
              <Popover
                content={
                  <Menu>
                    <MenuItem
                      intent={Intent.DANGER}
                      text="Delete connection"
                      onClick={() => handleDeleteConnectionClick(account.id)}
                    />
                  </Menu>
                }
              >
                <Button small icon={<MoreIcon height={10} width={10} />} />
              </Popover>
            </Group>
          </Group>
        </StripeAccountRow>
      ))}

      {!isStripeServerConfigured && (
        <PaymentFooter>
          <Text style={{ color: '#CD4246' }}>
            Stripe payment is not configured on the server.
          </Text>
        </PaymentFooter>
      )}
      <StripePreSetupDialog dialogName={DialogsName.StripeSetup} />
      <StripeIntegrationEditDrawer
        name={DRAWERS.STRIPE_PAYMENT_INTEGRATION_EDIT}
      />
    </Card>
  );
}

const PaymentDescription = styled(Text)`
  font-size: 13px;
  margin-top: 12px;
`;

const StripeAccountRow = styled(Box)`
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--color-divider);
`;

const PaymentFooter = styled(Box)`
  margin-top: 14px;
  font-size: 12px;
`;

import {
  AnchorButton,
  Callout,
  Classes,
  Intent,
  Text,
} from '@blueprintjs/core';
import React, { useEffect } from 'react';
import styled from 'styled-components';
import { PaymentMethodsBoot } from './PreferencesPaymentMethodsBoot';
import { PaymentProviderConnections } from './PaymentProviderConnections';
import { StripePaymentMethod } from './StripePaymentMethod';
import { Box, Stack } from '@/components';
import { useChangePreferencesPageTitle } from '@/hooks/state';

/**
 * Payment methods page.
 */
export function PreferencesPaymentMethodsPage() {
  const changePageTitle = useChangePreferencesPageTitle();

  useEffect(() => {
    changePageTitle('Payment Methods');
  }, [changePageTitle]);

  return (
    <PaymentMethodsRoot>
      <PaymentMethodsBoot>
        <Text className={Classes.TEXT_MUTED} style={{ marginBottom: 20 }}>
          Manage payment processor connections and choose which invoice payment
          methods are available.
        </Text>
        <Callout
          intent={Intent.NONE}
          title="Bank and credit-card feeds"
          style={{ marginBottom: 16 }}
        >
          Connect source accounts separately in Cash Flow Accounts. Plaid Link
          handles the institution sign-in and consent; FreeBooks does not ask
          you to enter bank passwords here. Processor accounts below are for
          collecting customer invoice payments.
          <div style={{ marginTop: 8 }}>
            <AnchorButton small minimal href="/cashflow-accounts">
              Manage bank feeds
            </AnchorButton>
          </div>
        </Callout>

        <Callout
          intent={Intent.NONE}
          title="Coinbase Business checkout"
          style={{ marginBottom: 16 }}
        >
          Merchant setup is required before Coinbase can be offered on invoice
          payment links: a Coinbase Business account, API key, webhook secret,
          and organization enablement. A personal Coinbase account or Phantom
          wallet does not enable merchant checkout.
        </Callout>

        <Stack>
          <StripePaymentMethod />
          <PaymentProviderConnections />
        </Stack>
      </PaymentMethodsBoot>
    </PaymentMethodsRoot>
  );
}

const PaymentMethodsRoot = styled(Box)`
  box-sizing: border-box;
  width: calc(100% - 40px);
  max-width: 700px;
  min-width: 0;
  margin: 20px;
  overflow-wrap: anywhere;
`;

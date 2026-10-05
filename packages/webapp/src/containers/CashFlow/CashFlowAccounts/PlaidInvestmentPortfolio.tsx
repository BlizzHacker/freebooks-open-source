import { Callout, Classes, Intent, Text } from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Card, Group, Stack } from '@/components';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';

type Snapshot = {
  institutionName?: string;
  accounts?: Array<{ account_id: string; name: string; mask?: string }>;
  holdings?: Array<{
    account_id: string;
    security_id: string;
    quantity: number;
    institution_price?: number;
    institution_value?: number;
  }>;
  securities?: Array<{
    security_id: string;
    name?: string;
    ticker_symbol?: string;
    type?: string;
  }>;
};

const money = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export function PlaidInvestmentPortfolio() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const snapshots = useQuery({
    queryKey: ['plaid-investment-snapshots', organizationId],
    queryFn: async (): Promise<Snapshot[]> => {
      const response = await fetch('/api/banking/plaid/investments', {
        headers: {
          accept: 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(organizationId ? { 'organization-id': organizationId } : {}),
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error('Could not load investment holdings.');
      const data = body?.data ?? body;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!token && !!organizationId,
  });

  const holdings = (snapshots.data || []).flatMap((snapshot) => {
    const securities = snapshot.securities || [];
    const accounts = snapshot.accounts || [];
    return (snapshot.holdings || []).map((holding) => {
      const security = securities.find(
        (value) => value.security_id === holding.security_id,
      );
      const account = accounts.find(
        (value) => value.account_id === holding.account_id,
      );
      return {
        ...holding,
        name: security?.name || security?.ticker_symbol || 'Investment',
        institutionName: snapshot.institutionName || 'Investment account',
        accountName: account?.name || 'Account',
        value:
          holding.institution_value ??
          (holding.institution_price || 0) * (holding.quantity || 0),
      };
    });
  });
  const total = holdings.reduce(
    (sum, holding) => sum + (holding.value || 0),
    0,
  );

  return (
    <Card style={{ marginTop: 16 }}>
      <Stack spacing={10}>
        <Stack spacing={2}>
          <Text>
            <strong>Investment holdings</strong>
          </Text>
          <Text className={Classes.TEXT_MUTED}>
            Read-only values from connected Plaid investment accounts. FreeBooks
            does not trade or recommend investments.
          </Text>
        </Stack>
        {snapshots.isError && (
          <Callout intent={Intent.WARNING}>
            Investment holdings could not be loaded. Bank and card feeds are
            unaffected.
          </Callout>
        )}
        {!snapshots.isLoading &&
          !snapshots.isError &&
          holdings.length === 0 && (
            <Text className={Classes.TEXT_MUTED}>
              No supported investment holdings are connected yet. Data appears
              only when Plaid and the institution support it and you grant
              access in Plaid Link.
            </Text>
          )}
        {holdings.length > 0 && (
          <>
            <Group position="apart">
              <Text>Connected holdings</Text>
              <Text>
                <strong>{money.format(total)}</strong>
              </Text>
            </Group>
            {holdings.map((holding, index) => (
              <HoldingRow key={holding.security_id + '-' + index}>
                <Stack spacing={1}>
                  <Text>{holding.name}</Text>
                  <Text className={Classes.TEXT_MUTED}>
                    {holding.institutionName} - {holding.accountName} -{' '}
                    {holding.quantity}
                  </Text>
                </Stack>
                <Stack spacing={1} align="flex-end">
                  <Text>{money.format(holding.value || 0)}</Text>
                  <Text className={Classes.TEXT_MUTED}>
                    {total > 0
                      ? ((holding.value / total) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </Text>
                </Stack>
              </HoldingRow>
            ))}
          </>
        )}
      </Stack>
    </Card>
  );
}

function HoldingRow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        borderTop: '1px solid var(--color-divider)',
        paddingTop: 10,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

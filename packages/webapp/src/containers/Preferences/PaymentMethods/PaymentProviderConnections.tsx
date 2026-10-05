import {
  Button,
  Callout,
  Card,
  FormGroup,
  HTMLSelect,
  Intent,
  InputGroup,
  Text,
} from '@blueprintjs/core';
import React, { useState } from 'react';
import styled from 'styled-components';
import { PaymentProvider } from './PaymentProviderTypes';
import { usePaymentProviderConnections } from '@/hooks/query/payment-provider-connections';
import { Group, Stack } from '@/components';

const providers: Array<{
  name: PaymentProvider;
  title: string;
  secretFields: Array<{ key: string; label: string }>;
}> = [
  {
    name: 'Square',
    title: 'Square',
    secretFields: [{ key: 'accessToken', label: 'Square access token' }],
  },
  {
    name: 'PayPal',
    title: 'PayPal',
    secretFields: [
      { key: 'clientId', label: 'REST app client ID' },
      { key: 'clientSecret', label: 'REST app client secret' },
    ],
  },
  {
    name: 'Authorize.Net',
    title: 'Authorize.Net',
    secretFields: [
      { key: 'apiLoginId', label: 'API Login ID' },
      { key: 'transactionKey', label: 'Transaction Key' },
    ],
  },
];

export function PaymentProviderConnections() {
  const { accounts, connect, refresh, disconnect } =
    usePaymentProviderConnections();
  const rows = Array.isArray(accounts.data)
    ? accounts.data
    : Array.isArray(accounts.data?.data)
      ? accounts.data.data
      : [];

  return (
    <Stack spacing={16}>
      {accounts.isError && (
        <Callout
          intent={Intent.WARNING}
          title="Payment connectors are unavailable"
        >
          FreeBooks could not reach the payment-connection API.{' '}
          {accounts.error instanceof Error
            ? accounts.error.message
            : 'Request failed.'}{' '}
          <Button minimal small onClick={() => accounts.refetch()}>
            Retry
          </Button>
        </Callout>
      )}
      {providers.map((provider) => (
        <ProviderCard
          key={provider.name}
          provider={provider}
          accounts={rows.filter((row: any) => row.provider === provider.name)}
          onConnect={(name, credentials) =>
            connect.mutateAsync({ provider: provider.name, name, credentials })
          }
          onDisconnect={(id) => disconnect.mutateAsync(id)}
          onRecheck={(id) => refresh.mutateAsync(id)}
          busy={connect.isPending || refresh.isPending || disconnect.isPending}
        />
      ))}
    </Stack>
  );
}

function ProviderCard({
  provider,
  accounts,
  onConnect,
  onDisconnect,
  onRecheck,
  busy,
}: {
  provider: (typeof providers)[number];
  accounts: any[];
  onConnect: (
    name: string,
    credentials: Record<string, string>,
  ) => Promise<unknown>;
  onDisconnect: (id: number) => Promise<unknown>;
  onRecheck: (id: number) => Promise<unknown>;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await onConnect(name, { ...values, environment });
      setValues({});
      setName('');
      setEditing(false);
    } catch (reason: any) {
      setError(reason?.message || 'Could not connect this account.');
    }
  };

  return (
    <Card>
      <Group position="apart">
        <Stack spacing={2}>
          <Text>
            <strong>{provider.title}</strong>
          </Text>
          <Text className="bp4-text-muted">
            {accounts.length} account{accounts.length === 1 ? '' : 's'}{' '}
            configured
          </Text>
        </Stack>
        <Button
          intent={Intent.PRIMARY}
          small
          onClick={() => setEditing(!editing)}
        >
          {editing ? 'Cancel' : 'Connect account'}
        </Button>
      </Group>

      {accounts.map((account) => (
        <AccountRow key={account.id}>
          <Group position="apart">
            <Stack spacing={2}>
              <Text>{account.name}</Text>
              <Text className="bp4-text-muted">
                {account.externalAccountId}
              </Text>
              {account.connectionStatus === 'disconnected' ? (
                <Text className="bp4-text-muted">Disconnected</Text>
              ) : account.checkoutReady ? (
                <Text className="bp4-text-muted">
                  Live invoice checkout ready. Historical activity sync is
                  tracked separately.
                </Text>
              ) : (
                <Text className="bp4-text-muted">
                  Credentials validated. Checkout requires additional provider
                  permissions.
                </Text>
              )}
            </Stack>
            {account.connectionStatus !== 'disconnected' && (
              <Group spacing={6}>
                <Button
                  small
                  disabled={busy}
                  onClick={() => onRecheck(account.id)}
                >
                  Recheck
                </Button>
                <Button
                  small
                  intent={Intent.DANGER}
                  disabled={busy}
                  onClick={() => onDisconnect(account.id)}
                >
                  Disconnect
                </Button>
              </Group>
            )}
          </Group>
        </AccountRow>
      ))}

      {editing && (
        <ConnectForm onSubmit={submit}>
          <FormGroup label="Account name">
            <InputGroup
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </FormGroup>
          <FormGroup label="Environment">
            <HTMLSelect
              value={environment}
              onChange={(event) => setEnvironment(event.currentTarget.value)}
              options={[
                { label: 'Production', value: 'production' },
                { label: 'Sandbox', value: 'sandbox' },
              ]}
            />
          </FormGroup>
          {provider.secretFields.map((field) => (
            <FormGroup key={field.key} label={field.label}>
              <InputGroup
                type="password"
                autoComplete="new-password"
                value={values[field.key] || ''}
                onChange={(event) =>
                  setValues({
                    ...values,
                    [field.key]: event.currentTarget.value,
                  })
                }
              />
            </FormGroup>
          ))}
          <Text className="bp4-text-muted">
            Credentials are sent over HTTPS and stored encrypted on the
            FreeBooks server. They are never returned to this page.
          </Text>
          {error && <ErrorText>{error}</ErrorText>}
          <Button
            type="submit"
            intent={Intent.PRIMARY}
            loading={busy}
            disabled={provider.secretFields.some((field) => !values[field.key])}
          >
            Validate and connect
          </Button>
        </ConnectForm>
      )}
    </Card>
  );
}

const AccountRow = styled.div`
  border-top: 1px solid var(--color-divider);
  margin-top: 12px;
  padding-top: 12px;
`;

const ConnectForm = styled.form`
  border-top: 1px solid var(--color-divider);
  margin-top: 16px;
  padding-top: 16px;
`;

const ErrorText = styled(Text)`
  color: #cd4246;
  display: block;
  margin: 8px 0;
`;

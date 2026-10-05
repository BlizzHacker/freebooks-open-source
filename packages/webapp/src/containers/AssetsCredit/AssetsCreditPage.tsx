import { Button, Callout, Card, Intent, Spinner, Tag } from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { DashboardInsider } from '@/components';
import { DashboardPageContent } from '@/components/Dashboard/DashboardPageContent';
import { useAccounts } from '@/hooks/query';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';
import { transformToCamelCase } from '@/utils';

interface MoneyAccount {
  id: number;
  name: string;
  code?: string;
  accountType: string;
  description?: string;
}

const assetTypes = new Set(['fixed-asset']);
const creditTypes = new Set(['credit-card']);
const loanTypes = new Set(['long-term-liability']);

function snapshotText(account: MoneyAccount) {
  const description = account.description || '';
  const statement = description.match(
    /statement balance \$([\d,.]+), credit limit \$([\d,.]+)/i,
  );
  const statementDate = description.match(/closed (\d{4}-\d{2}-\d{2})/i);
  if (statement) {
    return {
      label: 'Dated statement balance',
      value: '$' + statement[1],
      context:
        'Credit limit $' +
        statement[2] +
        (statementDate ? ' / closed ' + statementDate[1] : ''),
    };
  }
  const payoff = description.match(/payoff quote (?:was )?\$([\d,.]+)/i);
  const payoffDate = description.match(/good through (\d{4}-\d{2}-\d{2})/i);
  if (payoff) {
    return {
      label: 'Dated payoff quote',
      value: '$' + payoff[1],
      context: payoffDate
        ? 'Good through ' + payoffDate[1]
        : 'See source statement',
    };
  }
  return {
    label: assetTypes.has(account.accountType)
      ? 'Market value'
      : 'Statement value',
    value: 'Not verified',
    context: 'Add source evidence before assigning a value.',
  };
}

export function AssetsCreditPage() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const accountsQuery = useAccounts({ structure: 'flat', pageSize: 1000 });
  const selected = useMemo(
    () =>
      ((accountsQuery.data || []) as unknown as MoneyAccount[])
        .filter(
          (account) =>
            assetTypes.has(account.accountType) ||
            creditTypes.has(account.accountType) ||
            loanTypes.has(account.accountType),
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    [accountsQuery.data],
  );
  const ids = selected
    .map((account) => Number(account.id))
    .filter(Number.isFinite);
  const detailsQuery = useQuery({
    queryKey: ['assets-credit-details', ids],
    enabled: Boolean(token && organizationId && ids.length),
    queryFn: async (): Promise<MoneyAccount[]> =>
      Promise.all(
        ids.map(async (id) => {
          const response = await fetch('/api/accounts/' + id, {
            headers: {
              Authorization: 'Bearer ' + token,
              'organization-id': organizationId!,
              Accept: 'application/json',
            },
            credentials: 'same-origin',
          });
          if (!response.ok) throw new Error('Could not load account #' + id);
          return transformToCamelCase(await response.json()) as MoneyAccount;
        }),
      ),
  });
  const details = detailsQuery.data || [];
  const groups = [
    {
      title: 'Vehicles and owned assets',
      subtitle:
        'Ownership and value require source evidence. Ledger balances are separate.',
      accounts: details.filter((account) =>
        assetTypes.has(account.accountType),
      ),
    },
    {
      title: 'Credit cards',
      subtitle:
        'Balances below come from dated statements, not a live credit pull.',
      accounts: details.filter((account) =>
        creditTypes.has(account.accountType),
      ),
    },
    {
      title: 'Loans',
      subtitle:
        'A payoff quote can differ from principal and changes over time.',
      accounts: details.filter((account) => loanTypes.has(account.accountType)),
    },
  ];

  return (
    <DashboardInsider name="assets-credit">
      <DashboardPageContent>
        <main className="assets-credit-page">
          <header className="assets-credit-page__header">
            <span className="source-documents-page__eyebrow">
              Your financial picture
            </span>
            <h1>Vehicles &amp; Credit</h1>
            <p>
              Review what you own and owe alongside the statements that support
              each figure.
            </p>
          </header>
          <Callout icon="info-sign" intent={Intent.PRIMARY}>
            These are source snapshots for review. FreeBooks has not booked a
            vehicle market value or treated a dated card balance or payoff quote
            as a reconciled ledger balance.
          </Callout>
          {accountsQuery.isLoading || detailsQuery.isLoading ? (
            <div className="assets-credit-page__loading">
              <Spinner size={28} /> Loading accounts…
            </div>
          ) : accountsQuery.isError || detailsQuery.isError ? (
            <Callout
              intent={Intent.DANGER}
              title="Could not load this overview"
            >
              Retry the page after the accounting API is available.
            </Callout>
          ) : (
            groups.map((group) => (
              <section
                key={group.title}
                className="assets-credit-page__section"
              >
                <div className="assets-credit-page__section-heading">
                  <h2>{group.title}</h2>
                  <p>{group.subtitle}</p>
                </div>
                {group.accounts.length === 0 ? (
                  <Card className="assets-credit-page__empty">
                    No accounts recorded in this section yet.
                  </Card>
                ) : (
                  <div className="assets-credit-page__grid">
                    {group.accounts.map((account) => {
                      const snapshot = snapshotText(account);
                      return (
                        <Card
                          key={account.id}
                          className="assets-credit-page__card"
                        >
                          <div className="assets-credit-page__card-top">
                            <h3>{account.name}</h3>
                            {account.code && <Tag minimal>{account.code}</Tag>}
                          </div>
                          <div className="assets-credit-page__snapshot">
                            <span>{snapshot.label}</span>
                            <strong>{snapshot.value}</strong>
                            <small>{snapshot.context}</small>
                          </div>
                          {account.description && <p>{account.description}</p>}
                          <Button
                            small
                            icon="document"
                            onClick={() =>
                              window.location.assign(
                                '/source-documents?account_id=' + account.id,
                              )
                            }
                          >
                            View source documents
                          </Button>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            ))
          )}
        </main>
      </DashboardPageContent>
    </DashboardInsider>
  );
}

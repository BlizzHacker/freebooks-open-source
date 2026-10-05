import * as FF from 'fp-ts/function';
import React, { useEffect } from 'react';
import '@/style/pages/CashFlow/CashFlowAccounts/List.scss';
import { CashFlowAccountsActionsBar } from './CashFlowAccountsActionsBar';
import { CashflowAccountsGrid } from './CashflowAccountsGrid';
import { CashflowAccountsLoadingBar } from './CashFlowAccountsLoadingBar';
import { CashflowAccountsPlaidLink } from './CashflowAccountsPlaidLink';
import { PlaidInvestmentPortfolio } from './PlaidInvestmentPortfolio';
import { PlaidDataExportPanel } from './PlaidDataExportPanel';
import { CashFlowAccountsProvider } from './CashFlowAccountsProvider';
import type { WithCashflowAccountsProps } from '@/containers/CashFlow/AccountTransactions/withCashflowAccounts';
import type { WithCashflowAccountsTableActionsProps } from '@/containers/CashFlow/AccountTransactions/withCashflowAccountsTableActions';
import { DashboardPageContent } from '@/components';
import { withCashflowAccounts } from '@/containers/CashFlow/AccountTransactions/withCashflowAccounts';
import { withCashflowAccountsTableActions } from '@/containers/CashFlow/AccountTransactions/withCashflowAccountsTableActions';
import { CashFlowDrawers } from '@/containers/CashFlow/CashFlowDrawers';

interface CashFlowAccountsListInnerProps
  extends Pick<WithCashflowAccountsProps, 'cashflowAccountsTableState'>,
    Pick<
      WithCashflowAccountsTableActionsProps,
      'resetCashflowAccountsTableState'
    > {}

/**
 * Cashflow accounts list.
 */
function CashFlowAccountsListInner({
  // #withCashflowAccounts
  cashflowAccountsTableState,

  // #withCashflowAccountsTableActions
  resetCashflowAccountsTableState,
}: CashFlowAccountsListInnerProps) {
  // Resets the cashflow accounts table state.
  useEffect(
    () => () => {
      resetCashflowAccountsTableState();
    },
    [resetCashflowAccountsTableState],
  );

  return (
    <CashFlowAccountsProvider tableState={cashflowAccountsTableState}>
      <CashFlowDrawers />
      <CashFlowAccountsActionsBar />
      <CashflowAccountsLoadingBar />

      <DashboardPageContent>
        <details className="freebooks-import-guide">
          <summary>
            <span className="freebooks-import-guide__title">
              Import a bank or card file
            </span>
            <span className="freebooks-import-guide__hint">
              CSV and XLSX guidance when a bank feed is unavailable
            </span>
          </summary>
          <div className="freebooks-import-guide__body">
            <p>
              Use Plaid Link when your institution is supported. Otherwise
              export posted transactions from the bank or card activity page as
              CSV, then open the matching cash-flow account and choose Import.
              FreeBooks accepts CSV and XLSX; statement PDFs are for reference
              and cannot be imported directly.
            </p>
            <ol>
              <li>
                Export only the date range you need. Include posted date,
                amount, and transaction description or payee.
              </li>
              <li>
                Choose the existing account or create the matching bank or card
                account, upload the file, map its columns, and preview the rows.
              </li>
              <li>
                Check the date range, incoming/outgoing signs, and balances
                before committing. Avoid periods already brought in by Plaid to
                prevent duplicate transactions; keep the original statement for
                reference.
              </li>
            </ol>
            <p>
              Keep original statements and supporting receipts in{' '}
              <a href="/source-documents">Source Documents</a>.
            </p>
            <p>
              If your provider offers QFX or OFX but not CSV, export CSV for
              now. Availability and exact export steps vary by institution.
            </p>
            <p>
              Need to normalize a bank CSV first?{' '}
              <a href="/tools/freebooks-bank-csv-normalizer.py" download>
                Download the offline FreeBooks CSV normalizer
              </a>
              . It runs locally with Python 3, uses no bank login, and never
              uploads your file. It standardizes common bank/card columns into
              the FreeBooks import format; review dates and debit/credit signs
              in the import preview before committing.
            </p>
          </div>
        </details>
        <CashflowAccountsGrid />
        <PlaidInvestmentPortfolio />
        <PlaidDataExportPanel />
      </DashboardPageContent>

      <CashflowAccountsPlaidLink />
    </CashFlowAccountsProvider>
  );
}

export const CashFlowAccountsList = FF.pipe(
  CashFlowAccountsListInner,
  withCashflowAccountsTableActions,
  withCashflowAccounts(({ cashflowAccountsTableState }) => ({
    cashflowAccountsTableState,
  })),
);

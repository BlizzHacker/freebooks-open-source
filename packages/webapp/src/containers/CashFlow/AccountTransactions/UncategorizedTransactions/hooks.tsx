import {
  Checkbox,
  Classes,
  Intent,
  PopoverInteractionKind,
  Position,
  Tag,
  Tooltip,
} from '@blueprintjs/core';
import clsx from 'classnames';
import React from 'react';
import intl from 'react-intl-universal';
import styles from './AccountTransactionsUncategorizedTable.module.scss';
import type { DataTableColumn } from '@/components/Datatable/types';
import type { UncategorizedTransactionResponse } from '@bigcapital/sdk-ts';
import { Box, Icon } from '@/components';
import {
  useAddTransactionsToCategorizeSelected,
  useIsTransactionToCategorizeSelected,
  useRemoveTransactionsToCategorizeSelected,
} from '@/hooks/state/banking';

/**
 * `UncategorizedTransactionResponse` SDK type is loosely defined (OpenAPI
 * response schema is empty). Surface fields the runtime actually sends.
 */
export type UncategorizedTransactionRow = UncategorizedTransactionResponse & {
  id?: number;
  isRecognized?: boolean;
  assignedCategoryFormatted?: string;
  assignedAccountName?: string;
  formattedDate?: string;
  formattedDepositAmount?: string;
  formattedWithdrawalAmount?: string;
  referenceNo?: string;
  description?: string;
  payee?: string;
  reviewFlags?: string[];
  needsReview?: boolean;
};

function reviewStatusAccessor(transaction: UncategorizedTransactionRow) {
  const labels: Record<string, string> = {
    large_payment: 'Review $500+',
    possible_transfer: 'Transfer?',
    possible_p2p: 'Person to person?',
  };
  const flags = (transaction.reviewFlags ?? []).filter((flag) => labels[flag]);
  if (flags.length === 0) return null;

  return (
    <div className="uncategorized-review-badges" aria-label="Needs review">
      {flags.map((flag) => (
        <Tag
          key={flag}
          intent={flag === 'large_payment' ? Intent.WARNING : Intent.NONE}
          minimal
          round
        >
          {labels[flag]}
        </Tag>
      ))}
    </div>
  );
}

function statusAccessor(transaction: UncategorizedTransactionRow) {
  return transaction.isRecognized ? (
    <Tooltip
      interactionKind={PopoverInteractionKind.HOVER}
      position={Position.RIGHT}
      content={
        <Box>
          <span>{transaction.assignedCategoryFormatted}</span>
          <Icon
            icon={'arrowRight'}
            color={'#8F99A8'}
            iconSize={12}
            style={{ marginLeft: 8, marginRight: 8 }}
          />
          <span>{transaction.assignedAccountName}</span>
        </Box>
      }
    >
      <Box>
        <Tag intent={Intent.SUCCESS} interactive>
          Recognized
        </Tag>
      </Box>
    </Tooltip>
  ) : null;
}

interface TransactionSelectCheckboxProps {
  transactionId: number;
}

function TransactionSelectCheckbox({
  transactionId,
}: TransactionSelectCheckboxProps) {
  const addTransactionsToCategorizeSelected =
    useAddTransactionsToCategorizeSelected();

  const removeTransactionsToCategorizeSelected =
    useRemoveTransactionsToCategorizeSelected();

  const isTransactionSelected =
    useIsTransactionToCategorizeSelected(transactionId);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.target.checked
      ? addTransactionsToCategorizeSelected(transactionId)
      : removeTransactionsToCategorizeSelected(transactionId);
  };

  return (
    <Checkbox
      large
      checked={isTransactionSelected}
      onChange={handleChange}
      className={styles.categorizeCheckbox}
    />
  );
}

/**
 * Retrieve account uncategorized transctions table columns.
 */
export function useAccountUncategorizedTransactionsColumns(): DataTableColumn<UncategorizedTransactionRow>[] {
  return React.useMemo(
    () => [
      {
        id: 'date',
        Header: intl.get('date'),
        accessor: 'formattedDate',
        width: 40,
        clickable: true,
        textOverview: true,
      },
      {
        id: 'description',
        Header: 'Description',
        accessor: 'description',
        width: 160,
        textOverview: true,
        clickable: true,
        className: clsx(Classes.TEXT_MUTED),
      },
      {
        id: 'payee',
        Header: 'Payee',
        accessor: 'payee',
        width: 60,
        clickable: true,
        textOverview: true,
      },
      {
        id: 'reference_number',
        Header: 'Ref.#',
        accessor: 'referenceNo',
        width: 50,
        clickable: true,
        textOverview: true,
      },
      {
        id: 'status',
        Header: 'Status',
        accessor: statusAccessor,
      },
      {
        id: 'review',
        Header: 'Review',
        accessor: reviewStatusAccessor,
        width: 115,
        minWidth: 95,
      },
      {
        id: 'deposit',
        Header: intl.get('banking.label.deposit'),
        accessor: 'formattedDepositAmount',
        align: 'right',
        width: 40,
        textOverview: true,
        clickable: true,
        money: true,
      },
      {
        id: 'withdrawal',
        Header: intl.get('banking.label.withdrawal'),
        accessor: 'formattedWithdrawalAmount',
        width: 40,
        textOverview: true,
        align: 'right',
        clickable: true,
        money: true,
      },
      {
        id: 'categorize_include',
        Header: '',
        accessor: (value: UncategorizedTransactionRow) => (
          <TransactionSelectCheckbox transactionId={value.id ?? 0} />
        ),
        width: 20,
        minWidth: 20,
        maxWidth: 20,
        align: 'right',
        className: 'categorize_include selection-checkbox',
      },
    ],
    [],
  );
}

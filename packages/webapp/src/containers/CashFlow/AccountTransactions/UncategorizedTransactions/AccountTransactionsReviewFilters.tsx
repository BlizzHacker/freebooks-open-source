import {
  Button,
  ButtonGroup,
  InputGroup,
  Intent,
  Tag,
} from '@blueprintjs/core';
import * as FF from 'fp-ts/function';
import React, { useCallback, useEffect, useState } from 'react';
import { withBanking } from '../../withBanking';
import { withBankingActions } from '../../withBankingActions';
import type { WithBankingProps } from '../../withBanking';
import type {
  UncategorizedTransactionsFilter,
  WithBankingActionsProps,
} from '../../withBankingActions';
import { useAccountTransactionsContext } from '../AccountTransactionsProvider';
import { useAppQueryString } from '@/hooks';

interface ReviewFilterProps
  extends Pick<WithBankingProps, 'uncategorizedTransactionsFilter'>,
    Pick<WithBankingActionsProps, 'setUncategorizedTransactionsFilter'> {}

function AccountTransactionsReviewFiltersRoot({
  uncategorizedTransactionsFilter,
  setUncategorizedTransactionsFilter,
}: ReviewFilterProps) {
  const { currentAccount, bankAccountMetaSummary } =
    useAccountTransactionsContext();
  const [locationQuery] = useAppQueryString();
  const filter = uncategorizedTransactionsFilter ?? {};
  const [merchant, setMerchant] = useState(filter.merchant ?? '');
  const [minAmount, setMinAmount] = useState(
    filter.minAbsoluteAmount?.toString() ?? '',
  );
  const [maxAmount, setMaxAmount] = useState(
    filter.maxAbsoluteAmount?.toString() ?? '',
  );

  const updateFilter = useCallback(
    (patch: Partial<UncategorizedTransactionsFilter>) =>
      setUncategorizedTransactionsFilter(patch),
    [setUncategorizedTransactionsFilter],
  );

  useEffect(() => {
    setMerchant(filter.merchant ?? '');
    setMinAmount(filter.minAbsoluteAmount?.toString() ?? '');
    setMaxAmount(filter.maxAbsoluteAmount?.toString() ?? '');
  }, [filter.merchant, filter.minAbsoluteAmount, filter.maxAbsoluteAmount]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextMerchant = merchant.trim() || undefined;
      const parsedMin = minAmount.trim() ? Number(minAmount) : undefined;
      const parsedMax = maxAmount.trim() ? Number(maxAmount) : undefined;
      const nextMin =
        Number.isFinite(parsedMin) && parsedMin! >= 0 ? parsedMin : undefined;
      const nextMax =
        Number.isFinite(parsedMax) && parsedMax! >= 0 ? parsedMax : undefined;

      if (
        nextMerchant !== (filter.merchant ?? undefined) ||
        nextMin !== filter.minAbsoluteAmount ||
        nextMax !== filter.maxAbsoluteAmount
      ) {
        updateFilter({
          merchant: nextMerchant,
          minAbsoluteAmount: nextMin,
          maxAbsoluteAmount: nextMax,
        });
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [
    merchant,
    minAmount,
    maxAmount,
    filter.merchant,
    filter.minAbsoluteAmount,
    filter.maxAbsoluteAmount,
    updateFilter,
  ]);

  if ((locationQuery?.uncategorizedFilter || 'all') !== 'all') return null;

  const toggleReview = (
    reviewFlag: UncategorizedTransactionsFilter['reviewFlag'],
  ) => {
    updateFilter({
      reviewFlag: filter.reviewFlag === reviewFlag ? undefined : reviewFlag,
    });
  };

  return (
    <section
      className="banking-review-toolbar"
      aria-label="Transaction review filters"
    >
      <div className="banking-review-toolbar__context">
        <div>
          <strong>Review transactions</strong>
          <span>{currentAccount?.name || 'Selected account'}</span>
        </div>
        <Tag minimal intent={Intent.PRIMARY}>
          {bankAccountMetaSummary?.totalUncategorizedTransactions ?? 0}{' '}
          uncategorized
        </Tag>
      </div>

      <div className="banking-review-toolbar__controls">
        <InputGroup
          className="banking-review-toolbar__search"
          leftIcon="search"
          placeholder="Search description or payee"
          value={merchant}
          onChange={(event) => setMerchant(event.currentTarget.value)}
          aria-label="Search transactions by description or payee"
          rightElement={
            merchant ? (
              <Button
                minimal
                icon="cross"
                aria-label="Clear transaction search"
                onClick={() => setMerchant('')}
              />
            ) : undefined
          }
        />
        <InputGroup
          className="banking-review-toolbar__amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="Min amount"
          value={minAmount}
          onChange={(event) => setMinAmount(event.currentTarget.value)}
          aria-label="Minimum absolute transaction amount"
        />
        <InputGroup
          className="banking-review-toolbar__amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="Max amount"
          value={maxAmount}
          onChange={(event) => setMaxAmount(event.currentTarget.value)}
          aria-label="Maximum absolute transaction amount"
        />
        <ButtonGroup className="banking-review-toolbar__direction" minimal>
          <Button
            active={!filter.direction}
            onClick={() => updateFilter({ direction: undefined })}
          >
            All
          </Button>
          <Button
            active={filter.direction === 'withdrawal'}
            onClick={() =>
              updateFilter({
                direction:
                  filter.direction === 'withdrawal' ? undefined : 'withdrawal',
              })
            }
          >
            Outgoing
          </Button>
          <Button
            active={filter.direction === 'deposit'}
            onClick={() =>
              updateFilter({
                direction:
                  filter.direction === 'deposit' ? undefined : 'deposit',
              })
            }
          >
            Incoming
          </Button>
        </ButtonGroup>
        <Button
          className="banking-review-toolbar__quick-filter"
          active={filter.reviewFlag === 'large_payment'}
          icon="warning-sign"
          intent={
            filter.reviewFlag === 'large_payment' ? Intent.WARNING : Intent.NONE
          }
          onClick={() => toggleReview('large_payment')}
        >
          $500+ to review
        </Button>
        <Button
          className="banking-review-toolbar__quick-filter"
          active={filter.reviewFlag === 'possible_transfer'}
          icon="exchange"
          onClick={() => toggleReview('possible_transfer')}
        >
          Transfers
        </Button>
        <Button
          className="banking-review-toolbar__quick-filter"
          active={filter.reviewFlag === 'possible_p2p'}
          icon="people"
          onClick={() => toggleReview('possible_p2p')}
        >
          Person to person
        </Button>
      </div>
      <p className="banking-review-toolbar__hint">
        Review flags identify large withdrawals and possible transfers or
        person-to-person payments. Nothing is categorized automatically.
      </p>
    </section>
  );
}

export const AccountTransactionsReviewFilters = FF.pipe(
  AccountTransactionsReviewFiltersRoot,
  withBanking(({ uncategorizedTransactionsFilter }) => ({
    uncategorizedTransactionsFilter,
  })),
  withBankingActions,
);

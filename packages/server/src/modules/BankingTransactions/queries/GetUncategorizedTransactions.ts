import { Inject, Injectable } from '@nestjs/common';
import { TransformerInjectable } from '@/modules/Transformer/TransformerInjectable.service';
import { UncategorizedBankTransaction } from '../models/UncategorizedBankTransaction';
import { UncategorizedTransactionTransformer } from '../../BankingCategorize/commands/UncategorizedTransaction.transformer';
import {
  BankTransactionReviewFlag,
  GetUncategorizedTransactionsQueryDto,
} from '../dtos/GetUncategorizedTransactionsQuery.dto';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

const TRANSACTIONS_TABLE = 'uncategorized_cashflow_transactions';
const LARGE_PAYMENT_THRESHOLD = 500;

// These flags are review candidates. A processor name alone is not proof of a
// transfer or of the business purpose of a payment.
const TRANSFER_KEYWORDS = ['transfer', 'xfer', 'wire transfer', 'bank to bank'];
const P2P_KEYWORDS = [
  'zelle',
  'venmo',
  'cash app',
  'cashapp',
  'p2p',
  'person to person',
  'apple cash',
  'friends and family',
];

const containsKeyword = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword));

const getReviewFlags = (
  transaction: UncategorizedBankTransaction,
): BankTransactionReviewFlag[] => {
  const amount = Number(transaction.amount);
  const text = [transaction.payee, transaction.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const possibleP2P = containsKeyword(text, P2P_KEYWORDS);
  const flags: BankTransactionReviewFlag[] = [];

  if (amount < -LARGE_PAYMENT_THRESHOLD) {
    flags.push('large_payment');
  }
  if (containsKeyword(text, TRANSFER_KEYWORDS) || possibleP2P) {
    flags.push('possible_transfer');
  }
  if (possibleP2P) {
    flags.push('possible_p2p');
  }
  return flags;
};

@Injectable()
export class GetUncategorizedTransactions {
  constructor(
    private readonly transformer: TransformerInjectable,

    @Inject(UncategorizedBankTransaction.name)
    private readonly uncategorizedBankTransactionModel: TenantModelProxy<
      typeof UncategorizedBankTransaction
    >,
  ) {}

  /**
   * Retrieves the uncategorized cashflow transactions for one tenant account.
   * Filters run before pagination so the total count reflects the review queue.
   */
  public async getTransactions(
    accountId: number,
    query: GetUncategorizedTransactionsQueryDto,
  ) {
    const _query = {
      page: 1,
      pageSize: 20,
      ...query,
    };
    const textContainsSql = "LOCATE(?, LOWER(CONCAT_WS(' ', ??, ??))) > 0";
    const textColumns = [
      TRANSACTIONS_TABLE + '.payee',
      TRANSACTIONS_TABLE + '.description',
    ];
    const { results, pagination } =
      await this.uncategorizedBankTransactionModel()
        .query()
        .onBuild((q) => {
          q.where('accountId', accountId);
          q.where('categorized', false);

          q.modify('notExcluded');
          q.modify('notPending');

          q.withGraphFetched('account');
          q.withGraphFetched('recognizedTransaction.assignAccount');
          q.withGraphJoined('matchedBankTransactions');

          q.whereNull('matchedBankTransactions.id');
          q.orderBy('date', 'DESC');

          if (_query.minDate) {
            q.modify('fromDate', _query.minDate);
          }
          if (_query.maxDate) {
            q.modify('toDate', _query.maxDate);
          }
          if (_query.minAmount !== undefined) {
            q.modify('minAmount', _query.minAmount);
          }
          if (_query.maxAmount !== undefined) {
            q.modify('maxAmount', _query.maxAmount);
          }
          if (_query.minAbsoluteAmount !== undefined) {
            q.whereRaw('ABS(??) >= ?', [
              TRANSACTIONS_TABLE + '.amount',
              _query.minAbsoluteAmount,
            ]);
          }
          if (_query.maxAbsoluteAmount !== undefined) {
            q.whereRaw('ABS(??) <= ?', [
              TRANSACTIONS_TABLE + '.amount',
              _query.maxAbsoluteAmount,
            ]);
          }
          if (_query.direction === 'deposit') {
            q.where(TRANSACTIONS_TABLE + '.amount', '>', 0);
          } else if (_query.direction === 'withdrawal') {
            q.where(TRANSACTIONS_TABLE + '.amount', '<', 0);
          }
          if (_query.merchant) {
            q.whereRaw(textContainsSql, [
              _query.merchant.toLowerCase(),
              ...textColumns,
            ]);
          }
          if (_query.reviewFlag === 'large_payment') {
            q.where(
              TRANSACTIONS_TABLE + '.amount',
              '<',
              -LARGE_PAYMENT_THRESHOLD,
            );
          }
          if (
            _query.reviewFlag === 'possible_transfer' ||
            _query.reviewFlag === 'possible_p2p'
          ) {
            const keywords =
              _query.reviewFlag === 'possible_p2p'
                ? P2P_KEYWORDS
                : [...TRANSFER_KEYWORDS, ...P2P_KEYWORDS];

            q.where((keywordQuery) => {
              keywords.forEach((keyword, index) => {
                const bindings = [keyword, ...textColumns];
                if (index === 0) {
                  keywordQuery.whereRaw(textContainsSql, bindings);
                } else {
                  keywordQuery.orWhereRaw(textContainsSql, bindings);
                }
              });
            });
          }
        })
        .pagination(_query.page - 1, _query.pageSize);

    const transformed = (await this.transformer.transform(
      results,
      new UncategorizedTransactionTransformer(),
    )) as Record<string, any>[];
    const data = transformed.map((transaction, index) => {
      const reviewFlags = getReviewFlags(results[index]);

      return {
        ...transaction,
        reviewFlags,
        needsReview: reviewFlags.length > 0,
      };
    });
    return {
      data,
      pagination,
    };
  }
}

import { Knex } from 'knex';
import { PlaidSyncDb } from './PlaidSyncDB';
import { PlaidFetchedTransactionsUpdates } from '../types/BankingPlaid.types';
import { PlaidItem } from '../models/PlaidItem';
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '@/modules/Tenancy/TenancyDB/UnitOfWork.service';
import {
  CountryCode,
  Products,
  PlaidApi,
  Transaction as PlaidTransaction,
  RemovedTransaction,
} from 'plaid';
import { PLAID_CLIENT } from '@/modules/Plaid/Plaid.module';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { decryptPlaidAccessToken } from '../utils/PlaidAccessTokenCrypto';

@Injectable()
export class PlaidUpdateTransactions {
  /**
   * Constructor method.
   * @param {PlaidSyncDb} plaidSync - Plaid sync service.
   * @param {UnitOfWork} uow - Unit of work.
   * @param {TenantModelProxy<typeof PlaidItem>} plaidItemModel - Plaid item model.
   * @param {PlaidApi} plaidClient - Plaid client.
   */
  constructor(
    private readonly plaidSync: PlaidSyncDb,
    private readonly uow: UnitOfWork,

    @Inject(PlaidItem.name)
    private readonly plaidItemModel: TenantModelProxy<typeof PlaidItem>,

    @Inject(PLAID_CLIENT)
    private readonly plaidClient: PlaidApi,
  ) {}

  /**
   * Handles sync the Plaid item to Bigcaptial under UOW.
   * @param {string} plaidItemId - Plaid item id.
   * @returns {Promise<{ addedCount: number; modifiedCount: number; removedCount: number; }>}
   */
  public async updateTransactions(plaidItemId: string) {
    return this.uow.withTransaction((trx: Knex.Transaction) => {
      return this.updateTransactionsWork(plaidItemId, trx);
    });
  }

  /**
   * Handles the fetching and storing the following:
   *  - New, modified, or removed transactions.
   *  - New bank accounts.
   *  - Last accounts feeds updated at.
   *  - Turn on the accounts feed flag.
   * @param {string} plaidItemId - The Plaid ID for the item.
   * @param {Knex.Transaction} trx - Knex transaction.
   * @returns {Promise<{ addedCount: number; modifiedCount: number; removedCount: number; }>}
   */
  public async updateTransactionsWork(
    plaidItemId: string,
    trx?: Knex.Transaction,
  ): Promise<{
    addedCount: number;
    modifiedCount: number;
    removedCount: number;
  }> {
    // Lock the Plaid item row (FOR UPDATE) to serialize concurrent syncs for
    // the same item across the webhook and the background job, then use the
    // locked row's cursor so the second run only fetches the pending delta.
    const plaidItem = await this.plaidItemModel()
      .query(trx)
      .findOne({ plaidItemId })
      .forUpdate();

    // Can't continue if the Plaid item is not found or the feeds syncing is
    // paused (re-checked under the lock to avoid a race with pausing).
    if (!plaidItem || plaidItem.isPaused) {
      return { addedCount: 0, modifiedCount: 0, removedCount: 0 };
    }
    // Fetch new transactions from plaid api.
    const accessToken = decryptPlaidAccessToken(plaidItem.plaidAccessToken);
    const { added, modified, removed, cursor } =
      await this.fetchTransactionUpdates(accessToken, plaidItem.lastCursor);

    const request = { access_token: accessToken };
    const {
      data: { accounts, item },
    } = await this.plaidClient.accountsGet(request);

    const plaidAccountsIds = accounts.map((a) => a.account_id);
    const {
      data: { institution },
    } = await this.plaidClient.institutionsGetById({
      institution_id: item.institution_id,
      country_codes: [CountryCode.Us, CountryCode.Gb],
    });
    // Sync bank accounts.
    await this.plaidSync.syncBankAccounts(accounts, institution, item, trx);
    if (item.billed_products?.includes(Products.Investments)) {
      try {
        const { data: investmentData } =
          await this.plaidClient.investmentsHoldingsGet({
            access_token: accessToken,
          });
        await this.plaidItemModel()
          .query(trx)
          .findById(plaidItem.id)
          .patch({
            investmentData: JSON.stringify({
              updatedAt: new Date().toISOString(),
              institutionName: institution.name,
              accounts: investmentData.accounts,
              holdings: investmentData.holdings,
              securities: investmentData.securities,
            }),
          });
      } catch (error) {
        // Investment access is optional: bank and card syncing must continue
        // when an institution or Plaid account does not provide holdings.
        console.warn('Plaid investment holdings were unavailable for an item.');
      }
    }
    // Sync removed transactions.
    await this.plaidSync.syncRemoveTransactions(
      removed?.map((r) => r.transaction_id),
      trx,
    );
    // Sync bank account transactions.
    await this.plaidSync.syncAccountsTransactions(added.concat(modified), trx);
    // Sync transactions cursor.
    await this.plaidSync.syncTransactionsCursor(plaidItemId, cursor, trx);
    // Update the last feeds updated at of the updated accounts.
    await this.plaidSync.updateLastFeedsUpdatedAt(plaidAccountsIds, trx);
    // Turn on the accounts feeds flag.
    await this.plaidSync.updateAccountsFeedsActive(plaidAccountsIds, true, trx);
    // Refresh the bank balance of the updated accounts.
    await this.plaidSync.updateAccountsBankBalance(accounts, trx);

    return {
      addedCount: added.length,
      modifiedCount: modified.length,
      removedCount: removed.length,
    };
  }

  /**
   * Fetches transactions from the `Plaid API` for a given item.
   * @param {string} plaidAccessToken - Plaid access token.
   * @param {string} lastCursor - Last transactions cursor.
   * @returns {Promise<PlaidFetchedTransactionsUpdates>}
   */
  private async fetchTransactionUpdates(
    plaidAccessToken: string,
    lastCursor: string,
  ): Promise<PlaidFetchedTransactionsUpdates> {
    // the transactions endpoint is paginated, so we may need to hit it multiple times to
    // retrieve all available transactions.
    let cursor = lastCursor;

    // New transaction updates since "cursor"
    let added: PlaidTransaction[] = [];
    let modified: PlaidTransaction[] = [];
    // Removed transaction ids
    let removed: RemovedTransaction[] = [];
    let hasMore = true;

    const batchSize = 100;
    // Iterate through each page of new transaction updates for item.
    // A failed page must fail the sync so a partial batch is never marked current.
    while (hasMore) {
      const request = {
        access_token: plaidAccessToken,
        cursor,
        count: batchSize,
      };
      const response = await this.plaidClient.transactionsSync(request);
      const data = response.data;
      added = added.concat(data.added);
      modified = modified.concat(data.modified);
      removed = removed.concat(data.removed);
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }
    return { added, modified, removed, cursor };
  }
}

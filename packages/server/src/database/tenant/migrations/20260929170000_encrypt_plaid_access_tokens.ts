import { Knex } from 'knex';
import { encryptPlaidAccessToken } from '../../../modules/BankingPlaid/utils/PlaidAccessTokenCrypto';

export async function up(knex: Knex): Promise<void> {
  let lastId = 0;
  while (true) {
    const rows = await knex('plaid_items')
      .select('id', 'plaid_access_token')
      .where('id', '>', lastId)
      .orderBy('id', 'asc')
      .limit(100);
    if (!rows.length) break;

    for (const row of rows) {
      lastId = row.id;
      if (
        row.plaid_access_token &&
        !row.plaid_access_token.startsWith('enc:v1:')
      ) {
        await knex('plaid_items')
          .where({ id: row.id })
          .update({
            plaid_access_token: encryptPlaidAccessToken(row.plaid_access_token),
          });
      }
    }
  }
}

export async function down(): Promise<void> {
  // Encrypted provider tokens are intentionally not downgraded to plaintext.
}

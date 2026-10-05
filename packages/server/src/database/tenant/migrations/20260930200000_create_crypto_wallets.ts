import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('crypto_wallets', (table) => {
    table.increments('id').primary();
    table.string('label', 80).notNullable();
    table.string('network', 20).notNullable().defaultTo('solana-mainnet');
    table.string('provider', 20).notNullable().defaultTo('manual');
    table.string('address', 44).notNullable();
    // MySQL's default string collation is case-insensitive. Solana addresses are not.
    table.string('address_hash', 64).notNullable().unique();
    table.string('last_balance_lamports', 32).nullable();
    table.text('token_balances_json').nullable();
    table.boolean('token_snapshot_truncated').notNullable().defaultTo(false);
    table.timestamp('last_synced_at').nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('crypto_wallets');
}

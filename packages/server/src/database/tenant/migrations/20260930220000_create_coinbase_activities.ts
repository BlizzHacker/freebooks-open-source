import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('coinbase_activities', (table) => {
    table.increments('id').primary();
    table.string('source_id', 80).notNullable().unique();
    table.string('occurred_at_utc', 20).notNullable().index();
    table.string('transaction_type', 80).notNullable();
    table.string('asset', 20).notNullable();
    // Decimal strings retain every digit from the Coinbase export.
    table.string('quantity', 80).notNullable();
    table.string('price_currency', 20).notNullable();
    table.string('price_at_transaction', 80).nullable();
    table.string('subtotal', 80).nullable();
    table.string('total_inclusive', 80).nullable();
    table.string('fees_or_spread', 80).nullable();
    table.text('notes').nullable();
    table.string('sender_address', 255).nullable();
    table.string('recipient_address', 255).nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('coinbase_activities');
}

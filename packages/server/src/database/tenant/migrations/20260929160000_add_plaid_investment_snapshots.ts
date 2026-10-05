import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plaid_items', (table) => {
    table.text('investment_data').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plaid_items', (table) => {
    table.dropColumn('investment_data');
  });
}

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('payment_provider_credentials', (table) => {
    table.increments('id').primary();
    table.integer('payment_integration_id').unsigned().notNullable().unique();
    table.text('encrypted_credentials').notNullable();
    table.timestamps(true, true);
    table
      .foreign('payment_integration_id')
      .references('payment_integrations.id')
      .onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payment_provider_credentials');
}

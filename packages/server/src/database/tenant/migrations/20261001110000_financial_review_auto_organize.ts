import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(
    'financial_review_auto_organize_policy',
    (table) => {
      table.integer('id').unsigned().primary();
      table.integer('personal_branch_id').unsigned().nullable();
      table.integer('mwn_branch_id').unsigned().nullable();
      table.integer('w2_branch_id').unsigned().nullable();
      table.decimal('review_threshold', 16, 2).notNullable().defaultTo(500);
      table.integer('revision').unsigned().notNullable().defaultTo(1);
      table.timestamps(true, true);
    },
  );

  await knex.schema.createTable('financial_review_classifications', (table) => {
    table.increments('id').primary();
    table
      .integer('transaction_id')
      .unsigned()
      .notNullable()
      .unique()
      .references('id')
      .inTable('uncategorized_cashflow_transactions')
      .onDelete('CASCADE');
    table.string('status', 32).notNullable().index();
    table.string('category', 100).nullable().index();
    table.string('entity', 50).nullable().index();
    table.integer('branch_id').unsigned().nullable();
    table.string('confidence', 10).nullable();
    table.text('reason').notNullable();
    table.boolean('manual_override').notNullable().defaultTo(false);
    table.integer('rule_version').unsigned().notNullable();
    table.integer('policy_revision').unsigned().notNullable();
    table.timestamp('source_updated_at').nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('financial_review_classifications');
  await knex.schema.dropTableIfExists('financial_review_auto_organize_policy');
}

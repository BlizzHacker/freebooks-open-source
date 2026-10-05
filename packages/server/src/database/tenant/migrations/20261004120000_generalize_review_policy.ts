import { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(
    'financial_review_auto_organize_policy',
    (table) => {
      table.boolean('enabled').notNullable().defaultTo(false);
      table.string('business_name', 80).notNullable().defaultTo('Business');
      table
        .boolean('default_unknown_to_personal')
        .notNullable()
        .defaultTo(false);
    },
  );
  await knex('financial_review_auto_organize_policy')
    .whereNotNull('personal_branch_id')
    .whereNotNull('mwn_branch_id')
    .update({ enabled: true, default_unknown_to_personal: true });
  await knex('financial_review_classifications')
    .where('entity', (process.env.FREEBOOKS_LEGACY_BUSINESS_LABEL || 'Legacy business'))
    .update({ entity: 'Business' });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(
    'financial_review_auto_organize_policy',
    (table) => {
      table.dropColumn('enabled');
      table.dropColumn('business_name');
      table.dropColumn('default_unknown_to_personal');
    },
  );
}

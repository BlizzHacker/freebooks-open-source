exports.up = async function (knex) {
  await knex.schema.createTable('processor_checkout_attempts', (table) => {
    table.increments('id');
    table.string('request_key', 64).notNullable().unique();
    table.string('payment_link_id', 100).notNullable();
    table.integer('sale_invoice_id').unsigned().notNullable().index();
    table.integer('payment_integration_id').unsigned().notNullable().index();
    table.string('provider', 20).notNullable();
    table.string('provider_order_id', 192).notNullable();
    table.string('provider_payment_id', 192).nullable();
    table.string('checkout_url', 2048).notNullable();
    table.bigInteger('amount_minor').notNullable();
    table.string('currency', 3).notNullable();
    table.string('status', 24).notNullable().defaultTo('pending');
    table.integer('payment_received_id').unsigned().nullable();
    table.timestamps();
    table.unique(['provider', 'provider_order_id'], 'processor_order_unique');
    table.unique(
      ['provider', 'provider_payment_id'],
      'processor_payment_unique',
    );
    table.index(['payment_link_id', 'provider'], 'processor_link_provider_idx');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('processor_checkout_attempts');
};

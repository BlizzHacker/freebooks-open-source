exports.up = async function (knex) {
  await knex.schema.createTable('crypto_checkout_attempts', (table) => {
    table.increments('id');
    table.string('request_key', 64).notNullable().unique();
    table.string('payment_link_id', 100).notNullable().index();
    table.integer('sale_invoice_id').unsigned().notNullable().index();
    table.string('checkout_id', 64).notNullable().unique();
    table.string('checkout_url', 2048).notNullable();
    table.bigInteger('amount_minor').notNullable();
    table.string('currency', 10).notNullable();
    table.string('provider_status', 30).notNullable().defaultTo('ACTIVE');
    table.string('status', 24).notNullable().defaultTo('pending');
    table.string('transaction_hash', 150).nullable();
    table.string('settlement_total', 80).nullable();
    table.string('settlement_fee', 80).nullable();
    table.string('settlement_net', 80).nullable();
    table.string('settlement_currency', 10).nullable();
    table.integer('payment_received_id').unsigned().nullable();
    table.timestamps();
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('crypto_checkout_attempts');
};

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Email Inbox Connections (Gmail, Hotmail/Outlook, Yahoo, iCloud, Custom IMAP)
  await knex.schema.createTable('email_inbox_connections', (table) => {
    table.increments('id').primary();
    table.string('label', 120).notNullable();
    table.string('provider', 40).notNullable().index(); // gmail | outlook | hotmail | yahoo | icloud | proton | imap
    table.string('email_address', 190).notNullable().unique();
    table.string('auth_type', 32).notNullable().defaultTo('imap_app_password'); // oauth2 | imap_app_password
    table.string('imap_host', 190).nullable();
    table.integer('imap_port').unsigned().nullable().defaultTo(993);
    table.boolean('imap_tls').notNullable().defaultTo(true);
    table.text('encrypted_credentials').notNullable();
    table.string('status', 32).notNullable().defaultTo('connected');
    table.integer('last_scanned_messages').unsigned().notNullable().defaultTo(0);
    table.timestamp('last_scanned_at').nullable();
    table.text('last_error').nullable();
    table.timestamps(true, true);
  });

  // 2. Detected Email & Bank Subscriptions
  await knex.schema.createTable('detected_subscriptions', (table) => {
    table.increments('id').primary();
    table.string('merchant_name', 160).notNullable().index();
    table.string('normalized_key', 160).notNullable().unique();
    table.string('category', 80).notNullable().defaultTo('Software & Subscriptions');
    table.string('entity', 32).notNullable().defaultTo('Personal'); // Personal | Business
    table.decimal('amount', 16, 2).notNullable().defaultTo(0);
    table.decimal('previous_amount', 16, 2).nullable();
    table.string('currency', 10).notNullable().defaultTo('USD');
    table.string('billing_cycle', 24).notNullable().defaultTo('monthly'); // weekly | monthly | quarterly | yearly
    table.string('status', 32).notNullable().defaultTo('active').index(); // active | trial | cancelled | paused | price_hike | duplicate
    table.date('next_billing_date').nullable();
    table.date('trial_ends_at').nullable();
    table.string('source_type', 40).notNullable().defaultTo('email_scan'); // email_scan | bank_recurring | manual
    table.string('source_email', 190).nullable();
    table.string('last_subject', 255).nullable();
    table.string('cancel_url', 1024).nullable();
    table.integer('matched_transaction_id').unsigned().nullable();
    table.boolean('price_increased').notNullable().defaultTo(false);
    table.text('notes').nullable();
    table.timestamps(true, true);
  });

  // 3. Universal Banking Provider Connections (Plaid, Teller, SimpleFIN, GoCardless, Finicity, MX, FDX)
  await knex.schema.createTable('universal_bank_connections', (table) => {
    table.increments('id').primary();
    table.string('provider', 40).notNullable().index(); // plaid | teller | simplefin | gocardless | finicity | mx | fdx | manual_import
    table.string('institution_name', 160).notNullable();
    table.string('institution_id', 120).nullable();
    table.string('account_name', 160).notNullable();
    table.string('account_type', 40).notNullable().defaultTo('checking'); // checking | savings | credit_card | investment | loan | line_of_credit
    table.string('account_mask', 16).nullable();
    table.string('currency', 10).notNullable().defaultTo('USD');
    table.decimal('current_balance', 16, 2).notNullable().defaultTo(0);
    table.decimal('available_balance', 16, 2).nullable();
    table.decimal('credit_limit', 16, 2).nullable();
    table.decimal('apr_percent', 6, 2).nullable();
    table.text('encrypted_credentials').nullable();
    table.string('sync_status', 32).notNullable().defaultTo('healthy');
    table.timestamp('last_synced_at').nullable();
    table.integer('linked_account_id').unsigned().nullable();
    table.timestamps(true, true);
  });

  // 4. Tax Center Profile & Tax Documents (TurboTax Replacement)
  await knex.schema.createTable('tax_center_profiles', (table) => {
    table.integer('id').unsigned().primary();
    table.integer('tax_year').unsigned().notNullable().defaultTo(2026);
    table.string('filing_status', 32).notNullable().defaultTo('single'); // single | married_joint | married_separate | head_of_household
    table.integer('dependents_count').unsigned().notNullable().defaultTo(0);
    table.string('state_code', 8).notNullable().defaultTo('OK');
    table.decimal('w2_wages', 16, 2).notNullable().defaultTo(0);
    table.decimal('w2_federal_withheld', 16, 2).notNullable().defaultTo(0);
    table.decimal('w2_state_withheld', 16, 2).notNullable().defaultTo(0);
    table.decimal('other_1099_nec', 16, 2).notNullable().defaultTo(0);
    table.decimal('other_1099_int', 16, 2).notNullable().defaultTo(0);
    table.decimal('other_1099_div', 16, 2).notNullable().defaultTo(0);
    table.decimal('business_miles', 12, 2).notNullable().defaultTo(0);
    table.decimal('home_office_sqft', 10, 2).notNullable().defaultTo(0);
    table.decimal('total_home_sqft', 10, 2).notNullable().defaultTo(1500);
    table.decimal('retirement_contributions', 16, 2).notNullable().defaultTo(0);
    table.decimal('hsa_contributions', 16, 2).notNullable().defaultTo(0);
    table.decimal('itemized_mortgage_interest', 16, 2).notNullable().defaultTo(0);
    table.decimal('itemized_state_local_taxes', 16, 2).notNullable().defaultTo(0);
    table.decimal('itemized_charitable', 16, 2).notNullable().defaultTo(0);
    table.decimal('itemized_medical', 16, 2).notNullable().defaultTo(0);
    table.decimal('estimated_q1_paid', 16, 2).notNullable().defaultTo(0);
    table.decimal('estimated_q2_paid', 16, 2).notNullable().defaultTo(0);
    table.decimal('estimated_q3_paid', 16, 2).notNullable().defaultTo(0);
    table.decimal('estimated_q4_paid', 16, 2).notNullable().defaultTo(0);
    table.decimal('prior_year_total_tax', 16, 2).notNullable().defaultTo(0);
    table.timestamps(true, true);
  });

  // 5. Credit Health & Tradelines (Credit Karma Replacement)
  await knex.schema.createTable('credit_tradelines', (table) => {
    table.increments('id').primary();
    table.string('lender_name', 160).notNullable();
    table.string('account_type', 40).notNullable().defaultTo('revolving'); // revolving | auto_loan | installment_loan | mortgage | credit_builder
    table.decimal('current_balance', 16, 2).notNullable().defaultTo(0);
    table.decimal('credit_limit', 16, 2).notNullable().defaultTo(0);
    table.decimal('monthly_payment', 16, 2).notNullable().defaultTo(0);
    table.decimal('apr_percent', 6, 2).notNullable().defaultTo(0);
    table.date('opened_date').nullable();
    table.string('payment_status', 32).notNullable().defaultTo('current'); // current | late_30 | late_60 | collection
    table.integer('on_time_payments').unsigned().notNullable().defaultTo(12);
    table.integer('late_payments').unsigned().notNullable().defaultTo(0);
    table.string('bureaus_reporting', 64).notNullable().defaultTo('TransUnion,Equifax,Experian');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('credit_inquiries', (table) => {
    table.increments('id').primary();
    table.string('creditor_name', 160).notNullable();
    table.string('bureau', 32).notNullable().defaultTo('TransUnion');
    table.string('inquiry_type', 16).notNullable().defaultTo('hard'); // hard | soft
    table.date('inquiry_date').notNullable();
    table.string('purpose', 80).nullable();
    table.timestamps(true, true);
  });

  // 6. Credit Builder & Rent/Utility Reporting (Kikoff Replacement)
  await knex.schema.createTable('credit_builder_plans', (table) => {
    table.increments('id').primary();
    table.string('plan_name', 160).notNullable();
    table.string('plan_type', 40).notNullable().defaultTo('revolving_builder'); // revolving_builder | credit_builder_loan | rent_utility_furnisher
    table.decimal('credit_limit_or_principal', 16, 2).notNullable().defaultTo(750);
    table.decimal('reported_balance', 16, 2).notNullable().defaultTo(20);
    table.decimal('monthly_contribution', 16, 2).notNullable().defaultTo(10);
    table.decimal('apr_percent', 6, 2).notNullable().defaultTo(0);
    table.integer('term_months').unsigned().notNullable().defaultTo(12);
    table.integer('months_completed').unsigned().notNullable().defaultTo(0);
    table.integer('streak_months').unsigned().notNullable().defaultTo(0);
    table.date('next_furnishing_date').nullable();
    table.string('bureaus', 64).notNullable().defaultTo('Equifax,Experian,TransUnion');
    table.string('status', 32).notNullable().defaultTo('active');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('credit_builder_bill_reports', (table) => {
    table.increments('id').primary();
    table.string('biller_name', 160).notNullable();
    table.string('bill_category', 40).notNullable(); // rent | natural_gas | electric_water | internet | mobile_phone | credit_builder
    table.decimal('amount', 16, 2).notNullable();
    table.date('paid_date').notNullable();
    table.string('billing_period', 16).notNullable(); // YYYY-MM
    table.string('verification_status', 32).notNullable().defaultTo('verified'); // verified | pending_evidence | furnished
    table.string('bureaus_furnished', 64).notNullable().defaultTo('TransUnion,Experian,Equifax');
    table.string('metro2_account_status', 16).notNullable().defaultTo('11'); // 11 = Current account (0-29 days)
    table.integer('linked_transaction_id').unsigned().nullable();
    table.string('evidence_sha256', 64).nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('credit_builder_bill_reports');
  await knex.schema.dropTableIfExists('credit_builder_plans');
  await knex.schema.dropTableIfExists('credit_inquiries');
  await knex.schema.dropTableIfExists('credit_tradelines');
  await knex.schema.dropTableIfExists('tax_center_profiles');
  await knex.schema.dropTableIfExists('universal_bank_connections');
  await knex.schema.dropTableIfExists('detected_subscriptions');
  await knex.schema.dropTableIfExists('email_inbox_connections');
}

exports.up = async function (knex) {
  await knex.schema.alterTable('documents', (table) => {
    table.string('source_type', 50).nullable();
    table.string('source_name', 160).nullable();
    table.date('document_date').nullable();
    table.string('sha256', 64).nullable();
    table.index(['source_type', 'document_date'], 'documents_source_date_idx');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('documents', (table) => {
    table.dropIndex(
      ['source_type', 'document_date'],
      'documents_source_date_idx',
    );
    table.dropColumn('source_type');
    table.dropColumn('source_name');
    table.dropColumn('document_date');
    table.dropColumn('sha256');
  });
};

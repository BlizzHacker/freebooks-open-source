exports.up = async function (knex) {
  await knex.schema.alterTable('document_links', (table) => {
    table.unique(
      ['model_ref', 'model_id', 'document_id'],
      'document_links_model_document_unique',
    );
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('document_links', (table) => {
    table.dropUnique(
      ['model_ref', 'model_id', 'document_id'],
      'document_links_model_document_unique',
    );
  });
};

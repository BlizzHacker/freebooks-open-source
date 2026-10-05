import { BaseModel } from '@/models/Model';

export class ViewColumn extends BaseModel {
  /**
   * Table name.
   */
  static get tableName() {
    return 'view_has_columns';
  }

  /**
   * Timestamps columns.
   */
  get timestamps() {
    return [];
  }

  /**
   * Relationship mapping.
   */
  static get relationMappings() {
    return {};
  }
}

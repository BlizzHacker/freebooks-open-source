import { TenantBaseModel } from '@/modules/System/models/TenantBaseModel';

export class DocumentModel extends TenantBaseModel {
  originName!: string;
  size!: number;
  mimeType!: string;
  key!: string;
  sourceType?: string | null;
  sourceName?: string | null;
  documentDate?: string | null;
  sha256?: string | null;
  createdAt!: Date;

  /**
   * Table name
   */
  static get tableName() {
    return 'documents';
  }

  /**
   * Model timestamps.
   */
  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { DocumentModel } from './models/Document.model';
import { VaultDocumentMetadataDto } from './dtos/VaultDocument.dto';

@Injectable()
export class UploadDocument {
  constructor(
    @Inject(DocumentModel.name)
    private readonly documentModel: TenantModelProxy<typeof DocumentModel>,
  ) {}

  /**
   * Inserts the document metadata.
   * @param {number} tenantId
   * @param {} file
   * @returns {}
   */
  async upload(file: any, metadata: VaultDocumentMetadataDto = {}) {
    const insertedDocument = await this.documentModel()
      .query()
      .insert({
        key: file.key,
        mimeType: file.mimetype,
        size: file.size,
        originName: file.originalname,
        sourceType: metadata.sourceType ?? null,
        sourceName: metadata.sourceName ?? null,
        documentDate: metadata.documentDate ?? null,
        sha256: metadata.sha256 ?? null,
      });
    return insertedDocument;
  }
}

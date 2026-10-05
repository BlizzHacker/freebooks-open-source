import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { S3_CLIENT } from '../S3/S3.module';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { VaultDocumentListQueryDto } from './dtos/VaultDocument.dto';
import { DocumentModel } from './models/Document.model';
import { DocumentLinkModel } from './models/DocumentLink.model';

@Injectable()
export class DocumentVault {
  constructor(
    @Inject(DocumentModel.name)
    private readonly documentModel: TenantModelProxy<typeof DocumentModel>,

    @Inject(DocumentLinkModel.name)
    private readonly documentLinkModel: TenantModelProxy<
      typeof DocumentLinkModel
    >,

    @Inject(S3_CLIENT)
    private readonly s3: S3Client,

    private readonly config: ConfigService,
  ) {}

  async list(filters: VaultDocumentListQueryDto) {
    if (Boolean(filters.modelRef) !== Boolean(filters.modelId)) {
      throw new BadRequestException(
        'modelRef and modelId must be provided together.',
      );
    }
    const page = Number(filters.page || 1);
    const pageSize = Math.min(Number(filters.pageSize || 25), 100);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1
    ) {
      throw new BadRequestException('Invalid pagination.');
    }

    const linkedIds = this.documentLinkModel()
      .query()
      .select('documentId')
      .whereNotNull('documentId');

    const query = this.documentModel()
      .query()
      .select(
        'id',
        'originName',
        'mimeType',
        'size',
        'sourceType',
        'sourceName',
        'documentDate',
        'sha256',
        'createdAt',
      )
      .orderBy('id', 'desc');

    if (filters.q) {
      const needle = '%' + filters.q.trim() + '%';
      query.where((builder) => {
        builder
          .where('originName', 'like', needle)
          .orWhere('sourceName', 'like', needle);
      });
    }
    if (filters.sourceType) query.where('sourceType', filters.sourceType);
    if (filters.documentFrom)
      query.where('documentDate', '>=', filters.documentFrom);
    if (filters.documentTo)
      query.where('documentDate', '<=', filters.documentTo);
    if (filters.sourceName)
      query.where('sourceName', 'like', '%' + filters.sourceName.trim() + '%');
    if (filters.status === 'linked') query.whereIn('id', linkedIds);
    if (filters.status === 'unlinked') query.whereNotIn('id', linkedIds);
    if (filters.modelRef && filters.modelId) {
      const modelLinks = this.documentLinkModel()
        .query()
        .select('documentId')
        .where('modelRef', filters.modelRef)
        .where('modelId', filters.modelId);
      query.whereIn('id', modelLinks);
    }

    const { results, total } = await query.page(page - 1, pageSize);
    const ids = results.map((document) => document.id);
    const links = ids.length
      ? await this.documentLinkModel()
          .query()
          .select('documentId', 'modelRef', 'modelId')
          .whereIn('documentId', ids)
      : [];
    const linksByDocument = new Map<
      number,
      Array<{ modelRef: string; modelId: number }>
    >();
    for (const link of links) {
      const bucket = linksByDocument.get(link.documentId) || [];
      bucket.push({ modelRef: link.modelRef, modelId: link.modelId });
      linksByDocument.set(link.documentId, bucket);
    }

    return {
      data: results.map((document) => {
        const documentLinks = linksByDocument.get(document.id) || [];
        return {
          id: document.id,
          filename: document.originName,
          mimeType: document.mimeType,
          size: document.size,
          sourceType: document.sourceType,
          sourceName: document.sourceName,
          documentDate: document.documentDate,
          sha256: document.sha256,
          createdAt: document.createdAt,
          reviewStatus: documentLinks.length ? 'linked' : 'needs_review',
          links: documentLinks,
        };
      }),
      pagination: { total, page, pageSize },
    };
  }

  async getDocument(id: number) {
    return this.documentModel().query().findById(id).throwIfNotFound();
  }

  async getForDownload(id: number) {
    const document = await this.getDocument(id);
    const object = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.config.get('s3.bucket'),
        Key: document.key,
      }),
    );
    return { document, object };
  }
}

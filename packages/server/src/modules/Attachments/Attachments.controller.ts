import mime from 'mime-types';
import { createHash } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  LinkAttachmentDto,
  UnlinkAttachmentDto,
  UploadAttachmentDto,
} from './dtos/Attachment.dto';
import { AttachmentsApplication } from './AttachmentsApplication';
import { AttachmentUploadPipeline } from './S3UploadPipeline';
import { FileInterceptor } from '@/common/interceptors/file.interceptor';
import { ConfigService } from '@nestjs/config';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { RequirePermission } from '@/modules/Roles/RequirePermission.decorator';
import { PermissionGuard } from '@/modules/Roles/Permission.guard';
import { AuthorizationGuard } from '@/modules/Roles/Authorization.guard';
import { AbilitySubject } from '@/modules/Roles/Roles.types';
import { AttachmentAction } from './Attachments.types';
import { DocumentVault } from './DocumentVault';
import { S3_CLIENT } from '@/modules/S3/S3.module';
import {
  VaultDocumentListQueryDto,
  VaultDocumentMetadataDto,
} from './dtos/VaultDocument.dto';

const MAX_RECEIPT_BYTES = 25 * 1024 * 1024;
const RECEIPT_MIME_BY_EXTENSION: Record<string, string[]> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  heic: ['image/heic', 'image/heif'],
  heif: ['image/heic', 'image/heif'],
  pdf: ['application/pdf'],
};

function receiptFormat(bytes: Buffer): string | null {
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf';
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return 'jpeg';
  if (
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'png';
  if (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'webp';
  if (
    bytes.subarray(4, 8).toString('ascii') === 'ftyp' &&
    /heic|heix|hevc|hevx/.test(bytes.subarray(8, 32).toString('ascii'))
  )
    return 'heic';
  return null;
}

@ApiTags('Attachments')
@Controller('/attachments')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard, PermissionGuard)
export class AttachmentsController {
  /**
   * @param {AttachmentsApplication} attachmentsApplication - Attachments application.
   * @param uploadPipelineService
   */
  constructor(
    private readonly attachmentsApplication: AttachmentsApplication,
    private readonly uploadPipelineService: AttachmentUploadPipeline,
    private readonly configService: ConfigService,
    private readonly documentVault: DocumentVault,
    @Inject(S3_CLIENT) private readonly s3Client: S3Client,
  ) {}

  /**
   * Uploads the attachments to S3 and store the file metadata to DB.
   */
  @Post()
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @RequirePermission(AttachmentAction.Create, AbilitySubject.Attachment)
  @ApiOperation({ summary: 'Upload attachment to S3' })
  @ApiBody({ description: 'Upload attachment', type: UploadAttachmentDto })
  @ApiResponse({
    status: 200,
    description: 'The document has been uploaded successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - no file was provided in the upload',
  })
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: VaultDocumentMetadataDto,
  ) {
    if (!file) {
      throw new BadRequestException({
        errorType: 'FILE_UPLOAD_FAILED',
        message: 'No file uploaded.',
      });
    }
    const data = await this.attachmentsApplication.upload(file, metadata);

    return {
      status: 200,
      message: 'The document has uploaded successfully.',
      data,
    };
  }

  /**
   * Receipts use a size-limited endpoint so phones cannot upload arbitrary files
   * into the private evidence vault. The generic attachment API remains available
   * for existing accounting features.
   */
  @Post('/vault/receipt')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_RECEIPT_BYTES },
      fileFilter: (_request, file, callback) => {
        const extension = file.originalname.split('.').pop()?.toLowerCase();
        const acceptedMimes = extension
          ? RECEIPT_MIME_BY_EXTENSION[extension]
          : undefined;
        const mimeType = file.mimetype.toLowerCase();
        if (
          !acceptedMimes ||
          !(
            acceptedMimes.includes(mimeType) ||
            mimeType === 'application/octet-stream'
          )
        ) {
          callback(
            new BadRequestException(
              'Receipt must be a PDF, JPEG, PNG, WebP, HEIC, or HEIF file.',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @RequirePermission(AttachmentAction.Create, AbilitySubject.Attachment)
  @ApiOperation({ summary: 'Upload a private receipt, 25 MB maximum' })
  @ApiBody({
    description: 'Receipt file and source name',
    type: UploadAttachmentDto,
  })
  async uploadReceipt(
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: VaultDocumentMetadataDto,
  ) {
    const objectKey = (file as Express.Multer.File & { key?: string })?.key;
    if (!objectKey || !file.size) {
      throw new BadRequestException('No receipt uploaded.');
    }
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    const expectedFormat =
      extension === 'jpg' || extension === 'jpeg'
        ? 'jpeg'
        : extension === 'heic' || extension === 'heif'
          ? 'heic'
          : extension;
    const bucket = this.configService.get<string>('s3.bucket');
    try {
      const object = await this.s3Client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      );
      if (!object.Body) throw new BadRequestException('Receipt upload failed.');
      const bytes = Buffer.from(await object.Body.transformToByteArray());
      if (
        bytes.length === 0 ||
        bytes.length > MAX_RECEIPT_BYTES ||
        receiptFormat(bytes) !== expectedFormat
      ) {
        throw new BadRequestException(
          'The file contents do not match the selected receipt format.',
        );
      }
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (metadata?.sha256 && metadata.sha256.toLowerCase() !== sha256) {
        throw new BadRequestException('Receipt changed during upload.');
      }
      const data = await this.attachmentsApplication.upload(file, {
        sourceType: 'receipt',
        sourceName: metadata?.sourceName?.trim() || 'Receipt upload',
        sha256,
      });
      return {
        status: 200,
        message: 'The receipt has uploaded successfully.',
        data,
      };
    } catch (error) {
      await this.s3Client
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
        .catch(() => undefined);
      throw error;
    }
  }

  /**
   * Lists source documents from the current tenant, including unlinked uploads.
   * Storage keys are intentionally omitted from the response.
   */
  @Get('/vault')
  @RequirePermission(AttachmentAction.View, AbilitySubject.Attachment)
  @ApiOperation({ summary: 'Search private source documents' })
  async listVaultDocuments(@Query() query: VaultDocumentListQueryDto) {
    return this.documentVault.list(query);
  }

  /**
   * Downloads a tenant-owned document by numeric ID through the authenticated API.
   */
  @Get('/vault/:id/download')
  @RequirePermission(AttachmentAction.View, AbilitySubject.Attachment)
  @ApiOperation({ summary: 'Download private source document' })
  async downloadVaultDocument(
    @Param('id', ParseIntPipe) id: number,
    @Query('inline') inline: string,
    @Res() res: Response,
  ): Promise<void> {
    const { document, object } = await this.documentVault.getForDownload(id);
    if (!object.Body)
      throw new NotFoundException('Document content not found.');

    const isPdf = document.mimeType === 'application/pdf';
    const disposition = inline === '1' && isPdf ? 'inline' : 'attachment';
    const originalName = document.originName || 'document';
    const fallbackName = originalName
      .replace(/[^a-zA-Z0-9._ -]/g, '_')
      .slice(0, 180);

    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set(
      'Content-Type',
      isPdf ? 'application/pdf' : 'application/octet-stream',
    );
    res.set(
      'Content-Disposition',
      disposition +
        '; filename="' +
        fallbackName +
        "\"; filename*=UTF-8''" +
        encodeURIComponent(originalName),
    );
    if (object.ContentLength)
      res.set('Content-Length', String(object.ContentLength));

    const body = object.Body as any;
    if (typeof body.pipe === 'function') {
      await pipeline(body, res);
    } else {
      res.send(Buffer.from(await body.transformToByteArray()));
    }
  }

  /**
   * Associates a vault document with a tenant-owned record using its numeric ID.
   */
  @Post('/vault/:id/link')
  @RequirePermission(AttachmentAction.Create, AbilitySubject.Attachment)
  @ApiBody({ type: LinkAttachmentDto })
  async linkVaultDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() linkDto: LinkAttachmentDto,
  ) {
    const document = await this.documentVault.getDocument(id);
    await this.attachmentsApplication.link(
      document.key,
      linkDto.modelRef,
      linkDto.modelId,
    );
    return { status: 200, message: 'Document linked.' };
  }

  /**
   * Removes an association without deleting the source document.
   */
  @Post('/vault/:id/unlink')
  @RequirePermission(AttachmentAction.Delete, AbilitySubject.Attachment)
  @ApiBody({ type: UnlinkAttachmentDto })
  async unlinkVaultDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() unlinkDto: UnlinkAttachmentDto,
  ) {
    const document = await this.documentVault.getDocument(id);
    await this.attachmentsApplication.unlink(
      document.key,
      unlinkDto.modelRef,
      unlinkDto.modelId,
    );
    return { status: 200, message: 'Document unlinked.' };
  }

  /**
   * Retrieves the given attachment key.
   */
  @Get('/:id')
  @ApiOperation({ summary: 'Get attachment by ID' })
  @ApiParam({ name: 'id', description: 'Attachment ID' })
  @ApiResponse({ status: 200, description: 'Returns the attachment file' })
  @RequirePermission(AttachmentAction.View, AbilitySubject.Attachment)
  async getAttachment(
    @Res() res: Response,
    @Param('id') documentId: string,
  ): Promise<Response | void> {
    const data = await this.attachmentsApplication.get(documentId);

    const byte = await data.Body.transformToByteArray();
    const contentType = data.ContentType || 'application/octet-stream';
    const extension = mime.extension(contentType) || 'bin';
    const buffer = Buffer.from(byte);

    res.set('Content-Disposition', `filename="${documentId}.${extension}"`);
    res.set('Content-Type', contentType);
    res.send(buffer);
  }

  /**
   * Deletes the given document key.
   */
  @Delete('/:id')
  @ApiOperation({ summary: 'Delete attachment by ID' })
  @ApiParam({ name: 'id', description: 'Attachment ID' })
  @ApiResponse({
    status: 200,
    description: 'The document has been deleted successfully',
  })
  @RequirePermission(AttachmentAction.Delete, AbilitySubject.Attachment)
  async deleteAttachment(@Param('id') documentId: string) {
    await this.attachmentsApplication.delete(documentId);

    return {
      status: 200,
      message: 'The document has been delete successfully.',
    };
  }

  /**
   * Links the given document key.
   */
  @Post('/:id/link')
  @ApiOperation({ summary: 'Link attachment to a model' })
  @ApiParam({ name: 'id', description: 'Attachment ID' })
  @ApiBody({ type: LinkAttachmentDto })
  @RequirePermission(AttachmentAction.Create, AbilitySubject.Attachment)
  @ApiResponse({
    status: 200,
    description: 'The document has been linked successfully',
  })
  async linkDocument(
    @Body() linkDocumentDto: LinkAttachmentDto,
    @Param('id') documentId: string,
  ) {
    await this.attachmentsApplication.link(
      documentId,
      linkDocumentDto.modelRef,
      linkDocumentDto.modelId,
    );

    return {
      status: 200,
      message: 'The document has been linked successfully.',
    };
  }

  /**
   * Links the given document key.
   */
  @Post('/:id/unlink')
  @ApiOperation({ summary: 'Unlink attachment from a model' })
  @ApiParam({ name: 'id', description: 'Attachment ID' })
  @ApiBody({ type: UnlinkAttachmentDto })
  @RequirePermission(AttachmentAction.Delete, AbilitySubject.Attachment)
  @ApiResponse({
    status: 200,
    description: 'The document has been unlinked successfully',
  })
  async unlinkDocument(
    @Body() unlinkDto: UnlinkAttachmentDto,
    @Param('id') documentId: string,
  ) {
    await this.attachmentsApplication.unlink(
      documentId,
      unlinkDto.modelRef,
      unlinkDto.modelId,
    );

    return {
      status: 200,
      message: 'The document has been unlinked successfully.',
    };
  }

  /**
   * Retreives the presigned url of the given attachment key.
   */
  @Get('/:id/presigned-url')
  @ApiOperation({ summary: 'Get presigned URL for attachment' })
  @ApiParam({ name: 'id', description: 'Attachment ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the presigned URL for the attachment',
  })
  @RequirePermission(AttachmentAction.View, AbilitySubject.Attachment)
  async getAttachmentPresignedUrl(@Param('id') documentKey: string) {
    const presignedUrl =
      await this.attachmentsApplication.getPresignedUrl(documentKey);

    return { presignedUrl };
  }
}

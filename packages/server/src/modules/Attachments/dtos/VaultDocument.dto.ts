import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class VaultDocumentMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  sourceName?: string;

  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @IsOptional()
  @Matches(/^[0-9a-f]{64}$/i)
  sha256?: string;
}

export class VaultDocumentListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  sourceName?: string;

  @IsOptional()
  @IsString()
  @IsIn(['linked', 'unlinked'])
  status?: 'linked' | 'unlinked';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  modelRef?: string;

  @IsOptional()
  @IsDateString()
  documentFrom?: string;

  @IsOptional()
  @IsDateString()
  documentTo?: string;

  @IsOptional()
  @Matches(/^[1-9]\d*$/)
  modelId?: string;

  @IsOptional()
  @Matches(/^[1-9]\d*$/)
  page?: string;

  @IsOptional()
  @Matches(/^[1-9]\d*$/)
  pageSize?: string;
}

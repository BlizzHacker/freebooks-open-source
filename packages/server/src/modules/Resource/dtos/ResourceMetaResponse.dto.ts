import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { IModelMetaDefaultSort } from '@/interfaces/Model';

export class ModelMetaDefaultSortDto implements IModelMetaDefaultSort {
  @ApiProperty({
    description: 'The sort order',
    example: 'DESC',
    enum: ['DESC', 'ASC'],
  })
  sortOrder: 'DESC' | 'ASC';

  @ApiProperty({
    description: 'The sort field',
    example: 'createdAt',
  })
  sortField: string;
}

export class ModelMetaEnumerationOptionDto {
  @ApiProperty({
    description: 'The option key',
    example: 'active',
  })
  key: string;

  @ApiProperty({
    description: 'The option label',
    example: 'Active',
  })
  label: string;
}

export class ModelMetaFieldCommonDto {
  @ApiProperty({
    description: 'The field name',
    example: 'Customer Name',
  })
  name: string;

  @ApiProperty({
    description: 'The database column name',
    example: 'customerName',
  })
  column: string;

  @ApiProperty({
    description: 'Whether the field is columnable',
    example: true,
    required: false,
  })
  columnable?: boolean;

  @ApiProperty({
    description: 'Whether the field is required',
    example: true,
    required: false,
  })
  required?: boolean;

  @ApiProperty({
    description: 'The import hint for the field',
    example: 'Enter the customer display name',
    required: false,
  })
  importHint?: string;

  @ApiProperty({
    description: 'The importable relation label',
    example: 'displayName',
    required: false,
  })
  importableRelationLabel?: string;

  @ApiProperty({
    description: 'The field order',
    example: 1,
    required: false,
  })
  order?: number;

  @ApiProperty({
    description: 'Whether the field is unique',
    example: 1,
    required: false,
  })
  unique?: number;

  @ApiProperty({
    description: 'The data transfer object key',
    example: 'customerDisplayName',
    required: false,
  })
  dataTransferObjectKey?: string;
}

export class ModelMetaFieldTextDto extends ModelMetaFieldCommonDto {
  @ApiProperty({
    description: 'The field type',
    example: 'text',
  })
  fieldType: 'text';

  @ApiProperty({
    description: 'The minimum length',
    example: 1,
    required: false,
  })
  minLength?: number;

  @ApiProperty({
    description: 'The maximum length',
    example: 255,
    required: false,
  })
  maxLength?: number;
}

export class ModelMetaFieldNumberDto extends ModelMetaFieldCommonDto {
  @ApiProperty({
    description: 'The field type',
    example: 'number',
  })
  fieldType: 'number';

  @ApiProperty({
    description: 'The minimum value',
    example: 0,
    required: false,
  })
  min?: number;

  @ApiProperty({
    description: 'The maximum value',
    example: 999999,
    required: false,
  })
  max?: number;
}

export class ModelMetaFieldBooleanDto extends ModelMetaFieldCommonDto {
  @ApiProperty({
    description: 'The field type',
    example: 'boolean',
  })
  fieldType: 'boolean';
}

export class ModelMetaFieldDateDto extends ModelMetaFieldCommonDto {
  @ApiProperty({
    description: 'The field type',
    example: 'date',
  })
  fieldType: 'date';
}

export class ModelMetaFieldUrlDto extends ModelMetaFieldCommonDto {
  @ApiProperty({
    description: 'The field type',
    example: 'url',
  })
  fieldType: 'url';
}

export class ModelMetaFieldEnumerationDto extends ModelMetaFieldCommonDto {
  @ApiProperty({
    description: 'The field type',
    example: 'enumeration',
  })
  fieldType: 'enumeration';

  @ApiProperty({
    description: 'The enumeration options',
    type: 'array',
    items: { $ref: getSchemaPath(ModelMetaEnumerationOptionDto) },
  })
  options: ModelMetaEnumerationOptionDto[];
}

export class ModelMetaFieldRelationDto extends ModelMetaFieldCommonDto {
  @ApiProperty({
    description: 'The field type',
    example: 'relation',
  })
  fieldType: 'relation';

  @ApiProperty({
    description: 'The relation type',
    example: 'enumeration',
  })
  relationType: 'enumeration';

  @ApiProperty({
    description: 'The relation key',
    example: 'customerId',
  })
  relationKey: string;

  @ApiProperty({
    description: 'The relation entity label',
    example: 'displayName',
  })
  relationEntityLabel: string;

  @ApiProperty({
    description: 'The relation entity key',
    example: 'id',
  })
  relationEntityKey: string;
}

export class ModelMetaFieldCollectionDto extends ModelMetaFieldCommonDto {
  @ApiProperty({
    description: 'The field type',
    example: 'collection',
  })
  fieldType: 'collection';

  @ApiProperty({
    description: 'The collection type',
    example: 'object',
  })
  collectionOf: 'object';

  @ApiProperty({
    description: 'The minimum collection length',
    example: 1,
    required: false,
  })
  collectionMinLength?: number;

  @ApiProperty({
    description: 'The maximum collection length',
    example: 100,
    required: false,
  })
  collectionMaxLength?: number;

  @ApiProperty({
    description: 'The nested fields',
    required: false,
  })
  fields?: Record<string, any>;
}

export class ModelMetaColumnMetaDto {
  @ApiProperty({
    description: 'The column name',
    example: 'Customer Name',
  })
  name: string;

  @ApiProperty({
    description: 'The column accessor',
    example: 'customer.displayName',
    required: false,
  })
  accessor?: string;

  @ApiProperty({
    description: 'Whether the column is exportable',
    example: true,
    required: false,
  })
  exportable?: boolean;
}

export class ModelMetaColumnTextDto extends ModelMetaColumnMetaDto {
  @ApiProperty({
    description: 'The column type',
    example: 'text',
  })
  type: 'text';
}

export class ModelMetaColumnCollectionDto extends ModelMetaColumnMetaDto {
  @ApiProperty({
    description: 'The column type',
    example: 'collection',
  })
  type: 'collection';

  @ApiProperty({
    description: 'The collection type',
    example: 'object',
  })
  collectionOf: 'object';

  @ApiProperty({
    description: 'The nested columns',
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(ModelMetaColumnTextDto) },
  })
  columns: Record<string, ModelMetaColumnTextDto>;
}

export class ModelPrintMetaDto {
  @ApiProperty({
    description: 'The page title for print',
    example: 'Invoice INV-0001',
  })
  pageTitle: string;
}

export class ResourceMetaResponseDto {
  @ApiProperty({
    description: 'The default filter field',
    example: 'query',
  })
  defaultFilterField: string;

  @ApiProperty({
    description: 'The default sort configuration',
    type: () => ModelMetaDefaultSortDto,
  })
  defaultSort: ModelMetaDefaultSortDto;

  @ApiProperty({
    description: 'Whether the resource is exportable',
    example: true,
    required: false,
  })
  exportable?: boolean;

  @ApiProperty({
    description: 'The field to flatten on during export',
    example: 'entries',
    required: false,
  })
  exportFlattenOn?: string;

  @ApiProperty({
    description: 'Whether the resource is importable',
    example: true,
    required: false,
  })
  importable?: boolean;

  @ApiProperty({
    description: 'The import aggregator field',
    example: 'entries',
    required: false,
  })
  importAggregator?: string;

  @ApiProperty({
    description: 'The field to aggregate on during import',
    example: 'referenceNo',
    required: false,
  })
  importAggregateOn?: string;

  @ApiProperty({
    description: 'The field to aggregate by during import',
    example: 'id',
    required: false,
  })
  importAggregateBy?: string;

  @ApiProperty({
    description: 'The print metadata',
    type: () => ModelPrintMetaDto,
    required: false,
  })
  print?: ModelPrintMetaDto;

  @ApiProperty({
    description: 'The resource fields (legacy format)',
    type: 'object',
    additionalProperties: true,
  })
  fields: Record<string, any>;

  @ApiProperty({
    description: 'The resource fields (new format)',
    type: 'object',
    additionalProperties: true,
  })
  fields2: Record<string, any>;

  @ApiProperty({
    description: 'The resource columns',
    type: 'object',
    additionalProperties: true,
  })
  columns: Record<string, any>;
}

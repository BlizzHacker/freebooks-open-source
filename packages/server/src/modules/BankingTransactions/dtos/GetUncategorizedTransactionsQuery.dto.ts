import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type BankTransactionDirection = 'deposit' | 'withdrawal';
export type BankTransactionReviewFlag =
  | 'large_payment'
  | 'possible_transfer'
  | 'possible_p2p';

export class GetUncategorizedTransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ description: 'Page number', type: Number, example: 1 })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    description: 'Number of items per page',
    type: Number,
    example: 20,
  })
  pageSize?: number;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Earliest transaction date (ISO 8601)',
    type: String,
    example: '2023-01-01',
  })
  minDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Latest transaction date (ISO 8601)',
    type: String,
    example: '2023-12-31',
  })
  maxDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({
    description: 'Minimum signed amount; withdrawals are negative',
    type: Number,
    example: -1000,
  })
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @ApiPropertyOptional({
    description: 'Maximum signed amount; withdrawals are negative',
    type: Number,
    example: -100,
  })
  maxAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({
    description: 'Minimum absolute transaction amount',
    type: Number,
    example: 500,
  })
  minAbsoluteAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @ApiPropertyOptional({
    description: 'Maximum absolute transaction amount',
    type: Number,
    example: 1000,
  })
  maxAbsoluteAmount?: number;

  @IsOptional()
  @IsIn(['deposit', 'withdrawal'])
  @ApiPropertyOptional({
    description: 'Money entering or leaving the account',
    enum: ['deposit', 'withdrawal'],
  })
  direction?: BankTransactionDirection;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({
    description: 'Case-insensitive literal search in payee and description',
    type: String,
    example: 'rent',
  })
  merchant?: string;

  @IsOptional()
  @IsIn(['large_payment', 'possible_transfer', 'possible_p2p'])
  @ApiPropertyOptional({
    description:
      'Candidate review flag. large_payment means an outgoing payment over $500; transfer flags are keyword matches and require human review.',
    enum: ['large_payment', 'possible_transfer', 'possible_p2p'],
  })
  reviewFlag?: BankTransactionReviewFlag;
}

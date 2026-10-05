import { IsOptional, IsString, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ExchangeRateLatestQueryDto {
  @ApiPropertyOptional({
    description: 'The source currency code (ISO 4217)',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'Currency code must be 3 characters (ISO 4217)' })
  from_currency?: string;

  @ApiPropertyOptional({
    description: 'The target currency code (ISO 4217)',
    example: 'EUR',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'Currency code must be 3 characters (ISO 4217)' })
  to_currency?: string;
}

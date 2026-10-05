import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class PaymentProviderCredentialsDto {
  @ApiPropertyOptional({ description: 'Square access token', writeOnly: true })
  @IsOptional()
  @IsString()
  @MinLength(20)
  accessToken?: string;

  @ApiPropertyOptional({
    description: 'PayPal REST app client ID',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({
    description: 'PayPal REST app client secret',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @ApiPropertyOptional({
    description: 'Authorize.Net API Login ID',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  apiLoginId?: string;

  @ApiPropertyOptional({
    description: 'Authorize.Net Transaction Key',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  transactionKey?: string;

  @ApiPropertyOptional({
    enum: ['sandbox', 'production'],
    default: 'production',
  })
  @IsOptional()
  @IsIn(['sandbox', 'production'])
  environment?: 'sandbox' | 'production';
}

export class PaymentProviderConnectDto {
  @ApiPropertyOptional({
    description: 'Friendly display name for this account',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ type: PaymentProviderCredentialsDto })
  @IsObject()
  credentials: PaymentProviderCredentialsDto;
}

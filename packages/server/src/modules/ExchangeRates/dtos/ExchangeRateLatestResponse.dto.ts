import { ApiProperty } from '@nestjs/swagger';

export class ExchangeRateLatestResponseDto {
  @ApiProperty({
    description: 'The base currency code',
    example: 'USD',
  })
  baseCurrency: string;

  @ApiProperty({
    description: 'The target currency code',
    example: 'EUR',
  })
  toCurrency: string;

  @ApiProperty({
    description: 'The exchange rate value',
    example: 0.85,
  })
  exchangeRate: number;
}

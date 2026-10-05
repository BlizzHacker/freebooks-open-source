import { ApiProperty } from '@nestjs/swagger';

export class CreateStripeAccountResponseDto {
  @ApiProperty({
    description: 'The Stripe Connect account ID',
    example: 'acct_1234567890',
  })
  account_id: string;
}

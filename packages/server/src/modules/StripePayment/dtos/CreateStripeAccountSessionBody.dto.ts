import { ApiProperty } from '@nestjs/swagger';

export class CreateStripeAccountSessionBodyDto {
  @ApiProperty({
    description: 'Stripe Connect account ID to create a session for',
    example: 'acct_1234567890',
    required: false,
  })
  account?: string;
}

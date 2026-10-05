import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateStripeAccountLinkBodyDto {
  @ApiProperty({
    description: 'Stripe Connect account ID',
    example: 'acct_xxx',
  })
  @IsString()
  stripeAccountId: string;
}

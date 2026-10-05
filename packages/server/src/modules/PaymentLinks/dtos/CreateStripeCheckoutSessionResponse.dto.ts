import { ApiProperty } from '@nestjs/swagger';

export class CreateStripeCheckoutSessionResponseDto {
  @ApiProperty({
    description: 'Stripe checkout session ID',
    example: 'cs_test_xxx',
  })
  sessionId: string;

  @ApiProperty({
    description: 'Stripe publishable key for the client',
    example: 'pk_test_xxx',
  })
  publishableKey: string;

  @ApiProperty({
    description: 'URL to redirect the customer to complete checkout',
    example: 'https://checkout.stripe.com/c/pay/cs_test_xxx',
  })
  redirectTo: string;
}

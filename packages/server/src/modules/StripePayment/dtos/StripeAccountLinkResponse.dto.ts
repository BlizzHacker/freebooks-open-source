import { ApiProperty } from '@nestjs/swagger';

export class StripeAccountLinkResponseDto {
  @ApiProperty({
    description: 'URL for the account onboarding flow',
    example: 'https://connect.stripe.com/setup/xxx',
  })
  url: string;

  @ApiProperty({
    description: 'Unix timestamp when the link was created',
    example: 1234567890,
  })
  created: number;

  @ApiProperty({
    description: 'Unix timestamp when the link expires',
    example: 1234567890,
  })
  expires_at: number;

  @ApiProperty({
    description: 'Stripe object type',
    example: 'account_link',
  })
  object: string;
}

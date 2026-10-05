import { ApiProperty } from '@nestjs/swagger';
import { StripeAccountLinkResponseDto } from './StripeAccountLinkResponse.dto';

export class CreateStripeAccountLinkResponseDto {
  @ApiProperty({
    type: StripeAccountLinkResponseDto,
    description: 'Stripe AccountLink object for onboarding',
  })
  clientSecret: StripeAccountLinkResponseDto;
}

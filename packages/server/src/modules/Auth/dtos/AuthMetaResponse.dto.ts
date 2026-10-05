import { ApiProperty } from '@nestjs/swagger';

export class AuthMetaResponseDto {
  @ApiProperty({ description: 'Whether signup is disabled' })
  signupDisabled: boolean;

  @ApiProperty({
    description: 'Whether this installation uses protected proxy SSO',
  })
  ssoEnabled: boolean;
}

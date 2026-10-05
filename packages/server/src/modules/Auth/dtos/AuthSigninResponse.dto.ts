import { ApiProperty } from '@nestjs/swagger';

export class AuthSigninResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'Organization ID' })
  organizationId: string;

  @ApiProperty({ description: 'Tenant ID' })
  tenantId: number;

  @ApiProperty({ description: 'User ID' })
  userId: number;
}

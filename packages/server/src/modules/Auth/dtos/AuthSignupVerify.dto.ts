import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthSignupVerifyDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({
    example: 'confirmation-token',
    description: 'Signup confirmation token from email',
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}

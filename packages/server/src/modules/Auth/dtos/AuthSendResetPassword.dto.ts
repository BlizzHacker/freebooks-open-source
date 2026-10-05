import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthSendResetPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address to send reset link to',
  })
  @IsNotEmpty()
  @IsString()
  email: string;
}

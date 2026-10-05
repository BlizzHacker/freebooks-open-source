import { ApiProperty } from '@nestjs/swagger';

export class DateFormatResponseDto {
  @ApiProperty({ example: '03/09/2026 [MM/DD/YYYY]' })
  label: string;

  @ApiProperty({ example: 'MM/DD/YYYY' })
  key: string;
}

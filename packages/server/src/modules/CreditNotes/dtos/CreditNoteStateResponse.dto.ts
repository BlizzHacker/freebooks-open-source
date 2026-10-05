import { ApiProperty } from '@nestjs/swagger';

export class CreditNoteStateResponseDto {
  @ApiProperty({
    description: 'Default PDF template ID for credit notes',
    example: 1,
  })
  defaultTemplateId: number;
}

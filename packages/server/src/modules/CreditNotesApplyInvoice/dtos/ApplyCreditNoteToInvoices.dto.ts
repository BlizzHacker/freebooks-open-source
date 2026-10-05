import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  ValidateNested,
} from 'class-validator';

export class ApplyCreditNoteInvoiceEntryDto {
  @IsNotEmpty()
  @IsInt()
  @ApiProperty({ description: 'Invoice ID to apply credit to', example: 1 })
  invoiceId: number;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({ description: 'Amount to apply', example: 100.5 })
  amount: number;
}

export class ApplyCreditNoteToInvoicesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApplyCreditNoteInvoiceEntryDto)
  @ApiProperty({
    description: 'Entries of invoice ID and amount to apply',
    type: [ApplyCreditNoteInvoiceEntryDto],
    example: [
      { invoice_id: 1, amount: 100.5 },
      { invoice_id: 2, amount: 50 },
    ],
  })
  entries: ApplyCreditNoteInvoiceEntryDto[];
}

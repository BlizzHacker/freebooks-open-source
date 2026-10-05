import { ApiProperty } from '@nestjs/swagger';

export class AppliedCreditNoteInvoiceResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 200 })
  amount: number;

  @ApiProperty({ example: '$200.00' })
  formttedAmount: string;

  @ApiProperty({ example: 'CN-0001' })
  creditNoteNumber: string;

  @ApiProperty({ example: '2024-01-10' })
  creditNoteDate: string;

  @ApiProperty({ example: '2024-01-10' })
  formattedCreditNoteDate: string;

  @ApiProperty({ example: 'INV-0001' })
  invoiceNumber: string;

  @ApiProperty({ example: 'REF-001', required: false, nullable: true })
  invoiceReferenceNo?: string | null;
}

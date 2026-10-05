import { ApiProperty } from '@nestjs/swagger';

export class MatchedTransactionItemDto {
  @ApiProperty({ description: 'Transaction amount', example: 100.5 })
  amount: number;

  @ApiProperty({ description: 'Formatted amount', example: '$100.50' })
  amountFormatted: string;

  @ApiProperty({ description: 'Transaction date', example: '2024-01-15' })
  date: string;

  @ApiProperty({ description: 'Formatted date', example: 'Jan 15, 2024' })
  dateFormatted: string;

  @ApiProperty({ description: 'Reference number', example: 'REF-001' })
  referenceNo: string;

  @ApiProperty({ description: 'Transaction number', example: 'TXN-001' })
  transactionNo: string;

  @ApiProperty({ description: 'Transaction ID', example: 1 })
  transactionId: number;

  @ApiProperty({ description: 'Transaction type', example: 'SaleInvoice' })
  transactionType: string;
}

export class GetMatchedTransactionsResponseDto {
  @ApiProperty({
    description: 'Perfect matches (amount and date match)',
    type: [MatchedTransactionItemDto],
  })
  perfectMatches: MatchedTransactionItemDto[];

  @ApiProperty({
    description: 'Possible matches (candidates)',
    type: [MatchedTransactionItemDto],
  })
  possibleMatches: MatchedTransactionItemDto[];

  @ApiProperty({ description: 'Total pending amount', example: 500 })
  totalPending: number;
}

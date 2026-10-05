import { ApiProperty } from '@nestjs/swagger';

export class InventoryItemCostDto {
  @ApiProperty({ description: 'Item ID' })
  itemId: number;

  @ApiProperty({ description: 'Valuation' })
  valuation: number;

  @ApiProperty({ description: 'Quantity' })
  quantity: number;

  @ApiProperty({ description: 'Average cost' })
  average: number;
}

export class GetInventoryItemsCostResponseDto {
  @ApiProperty({
    type: [InventoryItemCostDto],
    description: 'List of item costs',
  })
  costs: InventoryItemCostDto[];
}

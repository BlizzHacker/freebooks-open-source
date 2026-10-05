import { ApiProperty } from '@nestjs/swagger';
import { InventoryAdjustmentResponseDto } from './InventoryAdjustmentResponse.dto';

class InventoryAdjustmentsPaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 12 })
  pageSize: number;

  @ApiProperty({ example: 42 })
  total: number;
}

export class InventoryAdjustmentsListResponseDto {
  @ApiProperty({ type: [InventoryAdjustmentResponseDto] })
  data: InventoryAdjustmentResponseDto[];

  @ApiProperty({ type: InventoryAdjustmentsPaginationDto })
  pagination: InventoryAdjustmentsPaginationDto;
}

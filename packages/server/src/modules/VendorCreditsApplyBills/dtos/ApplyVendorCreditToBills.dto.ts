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

export class ApplyVendorCreditToBillEntryDto {
  @IsNotEmpty()
  @IsInt()
  @ApiProperty({ description: 'Bill ID to apply vendor credit to', example: 1 })
  billId: number;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({ description: 'Amount to apply', example: 100.5 })
  amount: number;
}

export class ApplyVendorCreditToBillsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApplyVendorCreditToBillEntryDto)
  @ApiProperty({
    description: 'Entries of bill ID and amount to apply',
    type: [ApplyVendorCreditToBillEntryDto],
    example: [
      { billId: 1, amount: 100.5 },
      { billId: 2, amount: 50 },
    ],
  })
  entries: ApplyVendorCreditToBillEntryDto[];
}

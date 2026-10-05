import { Exportable } from '@/modules/Export/Exportable';
import { Injectable } from '@nestjs/common';
import { SaleReceiptApplication } from '../SaleReceiptApplication.service';
import { EXPORT_SIZE_LIMIT } from '@/modules/Export/constants';
import { GetSaleReceiptsQueryDto } from '../dtos/GetSaleReceiptsQuery.dto';
import { ISortOrder } from '@/modules/DynamicListing/DynamicFilter/DynamicFilter.types';

@Injectable()
export class SaleReceiptsExportable extends Exportable {
  constructor(private readonly saleReceiptsApp: SaleReceiptApplication) {
    super();
  }

  /**
   * Retrieves the accounts data to exportable sheet.
   * @param {GetSaleReceiptsQueryDto} query -
   */
  public exportable(query: GetSaleReceiptsQueryDto) {
    const filterQuery = (query) => {
      query.withGraphFetched('branch');
      query.withGraphFetched('warehouse');
    };
    const parsedQuery = {
      sortOrder: 'desc' as ISortOrder,
      columnSortBy: 'created_at',
      ...query,
      page: 1,
      pageSize: EXPORT_SIZE_LIMIT,
      filterQuery,
    } as GetSaleReceiptsQueryDto;

    return this.saleReceiptsApp
      .getSaleReceipts(parsedQuery)
      .then((output) => output.data);
  }
}

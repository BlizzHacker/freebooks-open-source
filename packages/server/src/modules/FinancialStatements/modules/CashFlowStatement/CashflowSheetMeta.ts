import * as moment from 'moment';
import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { FinancialSheetMeta } from '../../common/FinancialSheetMeta';
import {
  ICashFlowStatementMeta,
  ICashFlowStatementQuery,
} from './Cashflow.types';

@Injectable()
export class CashflowSheetMeta {
  constructor(
    private readonly financialSheetMeta: FinancialSheetMeta,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Cashflow sheet meta.
   * @param {ICashFlowStatementQuery} query
   * @returns {Promise<ICashFlowStatementMeta>}
   */
  public async meta(
    query: ICashFlowStatementQuery,
  ): Promise<ICashFlowStatementMeta> {
    const meta = await this.financialSheetMeta.meta();
    const formattedToDate = moment(query.toDate).format(meta.dateFormat);
    const formattedFromDate = moment(query.fromDate).format(meta.dateFormat);
    const fromLabel = this.i18n.t('cash_flow_statement.from_date');
    const toLabel = this.i18n.t('cash_flow_statement.to_date');
    const formattedDateRange = `${fromLabel} ${formattedFromDate} | ${toLabel} ${formattedToDate}`;

    const sheetName = this.i18n.t('cash_flow_statement.sheet_name');

    return {
      ...meta,
      sheetName,
      formattedToDate,
      formattedFromDate,
      formattedDateRange,
    };
  }
}

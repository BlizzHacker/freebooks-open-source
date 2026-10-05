import { EventEmitter2 } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common';
import { events } from '@/common/events/events';
import { IAPAgingSummarySheet } from './APAgingSummary.types';
import { APAgingSummarySheet } from './APAgingSummarySheet';
import { APAgingSummaryMeta } from './APAgingSummaryMeta';
import { getAPAgingSummaryDefaultQuery } from './utils';
import { APAgingSummaryRepository } from './APAgingSummaryRepository';
import { APAgingSummaryQueryDto } from './APAgingSummaryQuery.dto';

@Injectable()
export class APAgingSummaryService {
  constructor(
    private readonly APAgingSummaryMeta: APAgingSummaryMeta,
    private readonly eventPublisher: EventEmitter2,
    private readonly APAgingSummaryRepository: APAgingSummaryRepository,
  ) {}

  /**
   * Retrieve A/P aging summary report.
   * @param {APAgingSummaryQueryDto} query - A/P aging summary query.
   * @returns {Promise<IAPAgingSummarySheet>}
   */
  public async APAgingSummary(
    query: APAgingSummaryQueryDto,
  ): Promise<IAPAgingSummarySheet> {
    const filter = {
      ...getAPAgingSummaryDefaultQuery(),
      ...query,
    };
    // Load the data.
    this.APAgingSummaryRepository.setFilter(filter);
    await this.APAgingSummaryRepository.load();

    // Retrieve the aging summary report meta first to get date format.
    const meta = await this.APAgingSummaryMeta.meta(filter);

    // A/P aging summary report instance.
    const APAgingSummaryReport = new APAgingSummarySheet(
      filter,
      this.APAgingSummaryRepository,
      { baseCurrency: meta.baseCurrency, dateFormat: meta.dateFormat },
    );
    // A/P aging summary report data and columns.
    const data = APAgingSummaryReport.reportData();
    const columns = APAgingSummaryReport.reportColumns();

    // Triggers `onPayableAgingViewed` event.
    await this.eventPublisher.emitAsync(events.reports.onPayableAgingViewed, {
      query,
    });

    return {
      data,
      columns,
      query: filter,
      meta,
    };
  }
}

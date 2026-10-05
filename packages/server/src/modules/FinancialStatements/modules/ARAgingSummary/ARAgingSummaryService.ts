import { ARAgingSummarySheet } from './ARAgingSummarySheet';
import { ARAgingSummaryMeta } from './ARAgingSummaryMeta';
import { getARAgingSummaryDefaultQuery } from './utils';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { events } from '@/common/events/events';
import { ARAgingSummaryRepository } from './ARAgingSummaryRepository';
import { ARAgingSummaryQueryDto } from './ARAgingSummaryQuery.dto';

@Injectable()
export class ARAgingSummaryService {
  constructor(
    private readonly ARAgingSummaryMeta: ARAgingSummaryMeta,
    private readonly ARAgingSummaryRepository: ARAgingSummaryRepository,
    private readonly eventPublisher: EventEmitter2,
  ) {}

  /**
   * Retrieve A/R aging summary report.
   * @param {ARAgingSummaryQueryDto} query -
   */
  async ARAgingSummary(query: ARAgingSummaryQueryDto) {
    const filter = {
      ...getARAgingSummaryDefaultQuery(),
      ...query,
    };
    // Load the A/R aging summary repository.
    this.ARAgingSummaryRepository.setFilter(filter);
    await this.ARAgingSummaryRepository.load();

    // Retrieve the aging summary report meta first to get date format.
    const meta = await this.ARAgingSummaryMeta.meta(filter);

    // A/R aging summary report instance.
    const ARAgingSummaryReport = new ARAgingSummarySheet(
      filter,
      this.ARAgingSummaryRepository,
      { baseCurrency: meta.baseCurrency, dateFormat: meta.dateFormat },
    );
    // A/R aging summary report data and columns.
    const data = ARAgingSummaryReport.reportData();
    const columns = ARAgingSummaryReport.reportColumns();

    // Triggers `onReceivableAgingViewed` event.
    await this.eventPublisher.emitAsync(
      events.reports.onReceivableAgingViewed,
      { query },
    );

    return {
      data,
      columns,
      query: filter,
      meta,
    };
  }
}

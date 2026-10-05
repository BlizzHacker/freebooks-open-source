import { Inject, Injectable } from '@nestjs/common';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { CoinbaseActivity } from './CoinbaseActivity.model';
import { parseCoinbaseCsv } from './parseCoinbaseCsv';

@Injectable()
export class CoinbaseActivityService {
  constructor(
    @Inject(CoinbaseActivity.name)
    private readonly activityModel: TenantModelProxy<typeof CoinbaseActivity>,
  ) {}

  async list(rawPage: unknown) {
    const parsed = Number(rawPage);
    const page =
      Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100000) : 1;
    const pageSize = 250;
    const { results, total } = await this.activityModel()
      .query()
      .orderBy('occurredAtUtc', 'desc')
      .orderBy('id', 'desc')
      .page(page - 1, pageSize);
    return { activities: results, total, page, pageSize };
  }

  async importCsv(buffer: Buffer) {
    // Validate the entire archive before writing any records.
    const rows = parseCoinbaseCsv(buffer);
    const model = this.activityModel();
    const existing = await model
      .query()
      .select('sourceId')
      .whereIn(
        'sourceId',
        rows.map((row) => row.sourceId),
      );
    const known = new Set(existing.map((activity) => activity.sourceId));
    let imported = 0;

    for (const row of rows) {
      if (known.has(row.sourceId)) continue;
      try {
        await model.query().insert(row);
        imported += 1;
      } catch (error) {
        const code =
          (error as { nativeError?: { code?: string }; code?: string })
            .nativeError?.code ?? (error as { code?: string }).code;
        if (code !== 'ER_DUP_ENTRY') throw error;
      }
    }
    return { total: rows.length, imported, skipped: rows.length - imported };
  }
}

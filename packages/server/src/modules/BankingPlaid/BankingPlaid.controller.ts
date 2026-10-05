import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { once } from 'node:events';
import { Response } from 'express';
import { PlaidApplication } from './PlaidApplication';
import { PlaidDataExportService } from './PlaidDataExport.service';
import { AuthorizationGuard } from '@/modules/Roles/Authorization.guard';
import { PermissionGuard } from '@/modules/Roles/Permission.guard';
import { RequirePermission } from '@/modules/Roles/RequirePermission.decorator';
import { AbilitySubject } from '@/modules/Roles/Roles.types';
import { CashflowAction } from '@/modules/BankingTransactions/types/BankingTransactions.types';
import { PlaidItemDto } from './dtos/PlaidItem.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('banking/plaid')
@ApiTags('Banking Plaid')
@UseGuards(AuthorizationGuard, PermissionGuard)
export class BankingPlaidController {
  constructor(
    private readonly plaidApplication: PlaidApplication,
    private readonly plaidDataExport: PlaidDataExportService,
  ) {}

  @Post('link-token')
  @ApiOperation({ summary: 'Get Plaid link token' })
  getLinkToken() {
    return this.plaidApplication.getLinkToken();
  }

  @Get('investments')
  @ApiOperation({
    summary: 'Get read-only investment holdings for this tenant.',
  })
  getInvestmentSnapshots() {
    return this.plaidApplication.getInvestmentSnapshots();
  }

  @Get('export/manifest')
  @RequirePermission(CashflowAction.View, AbilitySubject.Cashflow)
  @ApiOperation({
    summary: 'Describe the tenant-stored Plaid snapshot without secrets.',
  })
  async getExportManifest(@Res({ passthrough: true }) res: Response) {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    return this.plaidDataExport.manifest();
  }

  @Get('export')
  @RequirePermission(CashflowAction.View, AbilitySubject.Cashflow)
  @ApiOperation({
    summary: 'Download tenant-stored Plaid bank-feed data as JSON or CSV.',
  })
  async exportStoredPlaidData(
    @Query('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    if (format !== 'json' && format !== 'csv') {
      throw new BadRequestException('Choose json or csv format.');
    }

    const manifest = await this.plaidDataExport.manifest();
    const date = manifest.generatedAt.slice(0, 10);
    res.set('Cache-Control', 'private, no-store');
    res.set('Pragma', 'no-cache');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set(
      'Content-Disposition',
      'attachment; filename="freebooks-plaid-stored-' +
        date +
        '.' +
        format +
        '"',
    );
    res.set(
      'Content-Type',
      format === 'json'
        ? 'application/json; charset=utf-8'
        : 'text/csv; charset=utf-8',
    );

    const write = async (chunk: string) => {
      if (res.destroyed) return false;
      if (!res.write(chunk)) {
        await Promise.race([once(res, 'drain'), once(res, 'close')]);
      }
      return !res.destroyed;
    };

    try {
      if (format === 'json') {
        const prefix = JSON.stringify({ ...manifest, transactions: [] });
        if (!(await write(prefix.slice(0, -2)))) return;
        let first = true;
        for await (const row of this.plaidDataExport.transactions()) {
          if (!(await write((first ? '' : ',') + JSON.stringify(row)))) return;
          first = false;
        }
        await write(']}');
      } else {
        if (
          !(await write(
            'exported_at,environment,record_id,account_id,plaid_transaction_id,date,amount_stored,currency_code,payee,description,reference_no,pending,categorized,excluded_at,recorded_at,updated_at\r\n',
          ))
        )
          return;
        for await (const row of this.plaidDataExport.transactions()) {
          const fields: Array<[unknown, boolean]> = [
            [manifest.generatedAt, true],
            [manifest.environment, true],
            [row.id, false],
            [row.accountId, false],
            [row.plaidTransactionId, true],
            [row.date, true],
            [row.amount, false],
            [row.currencyCode, true],
            [row.payee, true],
            [row.description, true],
            [row.referenceNo, true],
            [row.pending, false],
            [row.categorized, false],
            [row.excludedAt, true],
            [row.createdAt, true],
            [row.updatedAt, true],
          ];
          const line =
            fields.map(([value, guard]) => csvCell(value, guard)).join(',') +
            '\r\n';
          if (!(await write(line))) return;
        }
      }
      res.end();
    } catch (error) {
      res.destroy(error instanceof Error ? error : undefined);
    }
  }

  @Post('exchange-token')
  @ApiOperation({ summary: 'Exchange Plaid access token' })
  exchangeToken(@Body() itemDTO: PlaidItemDto) {
    return this.plaidApplication.exchangeToken(itemDTO);
  }
}

function csvCell(value: unknown, guardFormula: boolean): string {
  const raw =
    value == null
      ? ''
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  const safe = guardFormula && /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

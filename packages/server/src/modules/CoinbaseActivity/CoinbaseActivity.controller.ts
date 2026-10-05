import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import * as Multer from 'multer';
import { AuthorizationGuard } from '../Roles/Authorization.guard';
import { PermissionGuard } from '../Roles/Permission.guard';
import { RequirePermission } from '../Roles/RequirePermission.decorator';
import { AbilitySubject } from '../Roles/Roles.types';
import { CashflowAction } from '../BankingTransactions/types/BankingTransactions.types';
import { CoinbaseActivityService } from './CoinbaseActivity.service';

@Controller('coinbase-activity')
@ApiTags('Coinbase activity')
@UseGuards(AuthorizationGuard, PermissionGuard)
export class CoinbaseActivityController {
  constructor(private readonly activity: CoinbaseActivityService) {}

  @Get()
  @RequirePermission(CashflowAction.View, AbilitySubject.Cashflow)
  list(@Query('page') page?: string) {
    return this.activity.list(page);
  }

  @Post('import')
  @HttpCode(200)
  @RequirePermission(CashflowAction.Create, AbilitySubject.Cashflow)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: Multer.memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  import(@UploadedFile() file?: Express.Multer.File) {
    if (!file || !/\.csv$/i.test(file.originalname)) {
      throw new BadRequestException('Select a Coinbase CSV export.');
    }
    return this.activity.importCsv(file.buffer);
  }
}

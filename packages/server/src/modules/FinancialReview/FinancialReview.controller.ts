import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { AuthorizationGuard } from '../Roles/Authorization.guard';
import { PermissionGuard } from '../Roles/Permission.guard';
import { RequirePermission } from '../Roles/RequirePermission.decorator';
import { AbilitySubject } from '../Roles/Roles.types';
import { CashflowAction } from '../BankingTransactions/types/BankingTransactions.types';
import { FinancialReviewService } from './FinancialReview.service';
import { AutoOrganizeService } from './AutoOrganize.service';

@Controller('financial-review')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard, PermissionGuard)
export class FinancialReviewController {
  constructor(
    private readonly review: FinancialReviewService,
    private readonly autoOrganize: AutoOrganizeService,
  ) {}

  @Get('auto-organize/policy')
  @RequirePermission(CashflowAction.View, AbilitySubject.Cashflow)
  getAutoOrganizePolicy() {
    return this.autoOrganize.getPolicy();
  }

  @Patch('auto-organize/policy')
  @RequirePermission(CashflowAction.Create, AbilitySubject.Cashflow)
  updateAutoOrganizePolicy(@Body() body: Record<string, unknown>) {
    return this.autoOrganize.updatePolicy(body);
  }

  @Patch('items/:id/classification')
  @RequirePermission(CashflowAction.Create, AbilitySubject.Cashflow)
  overrideClassification(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.autoOrganize.override(id, body);
  }

  @Get('overview')
  @RequirePermission(CashflowAction.View, AbilitySubject.Cashflow)
  overview() {
    return this.review.overview();
  }

  @Get('items')
  @RequirePermission(CashflowAction.View, AbilitySubject.Cashflow)
  items(
    @Query('bucket') bucket?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
  ) {
    return this.review.list({ bucket, page, pageSize, q });
  }
}

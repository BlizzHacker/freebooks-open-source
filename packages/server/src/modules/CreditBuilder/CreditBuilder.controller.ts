import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { AuthorizationGuard } from '../Roles/Authorization.guard';
import { CreditBuilderService } from './CreditBuilder.service';

@Controller('credit-builder')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard)
export class CreditBuilderController {
  constructor(private readonly service: CreditBuilderService) {}

  @Get('overview')
  getOverview() {
    return this.service.getOverview();
  }

  @Post('plans')
  createPlan(@Body() body: Record<string, any>) {
    return this.service.createPlan(body);
  }

  @Post('bill-reports')
  recordBillReport(@Body() body: Record<string, any>) {
    return this.service.recordBillReport(body);
  }

  @Post('scan-bank')
  scanBank() {
    return this.service.scanBankForRentAndUtilities();
  }
}

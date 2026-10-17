import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { AuthorizationGuard } from '../Roles/Authorization.guard';
import { CreditHealthService, CreditSimulationInput } from './CreditHealth.service';

@Controller('credit-health')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard)
export class CreditHealthController {
  constructor(private readonly service: CreditHealthService) {}

  @Get('overview')
  getOverview() {
    return this.service.getOverview();
  }

  @Post('simulate')
  simulate(@Body() body: CreditSimulationInput) {
    return this.service.simulateScore(body);
  }

  @Post('tradelines')
  addTradeline(@Body() body: Record<string, any>) {
    return this.service.addTradeline(body);
  }

  @Delete('tradelines/:id')
  deleteTradeline(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteTradeline(id);
  }

  @Post('dispute-letter')
  generateDisputeLetter(
    @Body()
    body: {
      bureau?: string;
      lenderName: string;
      accountNumberMasked?: string;
      disputeReason: string;
      consumerName?: string;
    },
  ) {
    return this.service.generateDisputeLetter(body);
  }
}

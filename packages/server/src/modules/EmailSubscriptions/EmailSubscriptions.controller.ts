import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { AuthorizationGuard } from '../Roles/Authorization.guard';
import { EmailSubscriptionsService } from './EmailSubscriptions.service';

@Controller('email-subscriptions')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard)
export class EmailSubscriptionsController {
  constructor(private readonly service: EmailSubscriptionsService) {}

  @Get('presets')
  getPresets() {
    return this.service.getPresets();
  }

  @Get('inboxes')
  listInboxes() {
    return this.service.listInboxes();
  }

  @Post('inboxes')
  connectInbox(@Body() body: Record<string, any>) {
    return this.service.connectInbox(body);
  }

  @Post('inboxes/:id/scan')
  scanInbox(@Param('id', ParseIntPipe) id: number) {
    return this.service.scanInbox(id);
  }

  @Delete('inboxes/:id')
  disconnectInbox(@Param('id', ParseIntPipe) id: number) {
    return this.service.disconnectInbox(id);
  }

  @Post('scan-bank')
  scanBank() {
    return this.service.scanBankTransactionsForSubscriptions();
  }

  @Post('parse-raw')
  parseRaw(@Body() body: { rawText?: string; messages?: any[] }) {
    return this.service.parseUploadedEmails(body);
  }

  @Get()
  listSubscriptions() {
    return this.service.listSubscriptions();
  }

  @Patch(':id')
  updateSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, any>,
  ) {
    return this.service.updateSubscription(id, body);
  }
}

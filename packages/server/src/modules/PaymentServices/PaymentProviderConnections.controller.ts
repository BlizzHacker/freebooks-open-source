import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentProviderConnectDto } from './dtos/PaymentProviderConnect.dto';
import {
  PaymentProviderConnectionsService,
  PaymentProvider,
} from './PaymentProviderConnections.service';

@Controller('payment-services/providers')
@ApiTags('Payment Providers')
export class PaymentProviderConnectionsController {
  constructor(private readonly providers: PaymentProviderConnectionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List configured provider accounts without credentials.',
  })
  list() {
    return this.providers.list();
  }

  @Post('/:provider/accounts')
  @ApiOperation({ summary: 'Validate and connect one merchant account.' })
  @ApiBody({ type: PaymentProviderConnectDto })
  connect(
    @Param('provider') provider: PaymentProvider,
    @Body() body: PaymentProviderConnectDto,
  ) {
    return this.providers.connect(provider, body.name || '', body.credentials);
  }

  @Post('/:integrationId/refresh')
  @ApiOperation({
    summary: 'Recheck checkout capabilities for stored credentials.',
  })
  refresh(@Param('integrationId', ParseIntPipe) integrationId: number) {
    return this.providers.refresh(integrationId);
  }

  @Delete('/:integrationId')
  @ApiOperation({ summary: 'Disconnect a merchant account.' })
  disconnect(@Param('integrationId', ParseIntPipe) integrationId: number) {
    return this.providers.disconnect(integrationId);
  }
}

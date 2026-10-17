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
import { UniversalBankingService } from './UniversalBanking.service';

@Controller('universal-banking')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard)
export class UniversalBankingController {
  constructor(private readonly service: UniversalBankingService) {}

  @Get('providers')
  getProviders() {
    return this.service.getProvidersCatalog();
  }

  @Get('connections')
  listConnections() {
    return this.service.listConnections();
  }

  @Post('connections')
  connectProvider(@Body() body: Record<string, any>) {
    return this.service.connectProvider(body);
  }

  @Post('connections/:id/sync')
  syncConnection(@Param('id', ParseIntPipe) id: number) {
    return this.service.syncConnection(id);
  }

  @Delete('connections/:id')
  deleteConnection(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteConnection(id);
  }

  @Post('import-file')
  importFile(
    @Body() body: { filename: string; content: string; accountId?: number },
  ) {
    return this.service.importStatementFile(body);
  }
}

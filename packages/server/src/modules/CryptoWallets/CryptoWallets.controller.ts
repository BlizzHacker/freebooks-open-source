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
import { AuthorizationGuard } from '../Roles/Authorization.guard';
import { PermissionGuard } from '../Roles/Permission.guard';
import { RequirePermission } from '../Roles/RequirePermission.decorator';
import { AbilitySubject } from '../Roles/Roles.types';
import { CashflowAction } from '../BankingTransactions/types/BankingTransactions.types';
import { CryptoWalletsService } from './CryptoWallets.service';

@Controller('crypto-wallets')
@UseGuards(AuthorizationGuard, PermissionGuard)
export class CryptoWalletsController {
  constructor(private readonly wallets: CryptoWalletsService) {}

  @Get()
  @RequirePermission(CashflowAction.View, AbilitySubject.Cashflow)
  list() {
    return this.wallets.list();
  }

  @Post()
  @RequirePermission(CashflowAction.Create, AbilitySubject.Cashflow)
  add(@Body() body: { label?: string; address?: string; provider?: string }) {
    return this.wallets.add(body.label, body.address, body.provider);
  }

  @Post(':id/refresh')
  @RequirePermission(CashflowAction.View, AbilitySubject.Cashflow)
  refresh(@Param('id', ParseIntPipe) id: number) {
    return this.wallets.refresh(id);
  }

  @Delete(':id')
  @RequirePermission(CashflowAction.Delete, AbilitySubject.Cashflow)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.wallets.remove(id);
  }
}

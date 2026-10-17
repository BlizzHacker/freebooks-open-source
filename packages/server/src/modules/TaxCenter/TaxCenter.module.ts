import { Module } from '@nestjs/common';
import { RolesModule } from '../Roles/Roles.module';
import { BankingTransactionsModule } from '../BankingTransactions/BankingTransactions.module';
import { TaxCenterController } from './TaxCenter.controller';
import { TaxCenterService } from './TaxCenter.service';

@Module({
  imports: [RolesModule, BankingTransactionsModule],
  controllers: [TaxCenterController],
  providers: [TaxCenterService],
  exports: [TaxCenterService],
})
export class TaxCenterModule {}

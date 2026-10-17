import { Module } from '@nestjs/common';
import { RolesModule } from '../Roles/Roles.module';
import { BankingTransactionsModule } from '../BankingTransactions/BankingTransactions.module';
import { UniversalBankingController } from './UniversalBanking.controller';
import { UniversalBankingService } from './UniversalBanking.service';

@Module({
  imports: [RolesModule, BankingTransactionsModule],
  controllers: [UniversalBankingController],
  providers: [UniversalBankingService],
  exports: [UniversalBankingService],
})
export class UniversalBankingModule {}

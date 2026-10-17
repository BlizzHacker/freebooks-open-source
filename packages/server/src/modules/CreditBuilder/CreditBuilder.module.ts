import { Module } from '@nestjs/common';
import { RolesModule } from '../Roles/Roles.module';
import { BankingTransactionsModule } from '../BankingTransactions/BankingTransactions.module';
import { CreditBuilderController } from './CreditBuilder.controller';
import { CreditBuilderService } from './CreditBuilder.service';

@Module({
  imports: [RolesModule, BankingTransactionsModule],
  controllers: [CreditBuilderController],
  providers: [CreditBuilderService],
  exports: [CreditBuilderService],
})
export class CreditBuilderModule {}

import { Module } from '@nestjs/common';
import { RolesModule } from '../Roles/Roles.module';
import { BankingTransactionsModule } from '../BankingTransactions/BankingTransactions.module';
import { EmailSubscriptionsController } from './EmailSubscriptions.controller';
import { EmailSubscriptionsService } from './EmailSubscriptions.service';

@Module({
  imports: [RolesModule, BankingTransactionsModule],
  controllers: [EmailSubscriptionsController],
  providers: [EmailSubscriptionsService],
  exports: [EmailSubscriptionsService],
})
export class EmailSubscriptionsModule {}

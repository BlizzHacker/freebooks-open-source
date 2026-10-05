import { Module } from '@nestjs/common';
import { BankingTransactionsModule } from '../BankingTransactions/BankingTransactions.module';
import { AttachmentsModule } from '../Attachments/Attachment.module';
import { FinancialReviewController } from './FinancialReview.controller';
import { FinancialReviewService } from './FinancialReview.service';
import { AutoOrganizeService } from './AutoOrganize.service';

@Module({
  imports: [BankingTransactionsModule, AttachmentsModule],
  controllers: [FinancialReviewController],
  providers: [FinancialReviewService, AutoOrganizeService],
})
export class FinancialReviewModule {}

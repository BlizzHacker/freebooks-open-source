import { Module } from '@nestjs/common';
import { RolesModule } from '../Roles/Roles.module';
import { AccountsModule } from '../Accounts/Accounts.module';
import { CreditHealthController } from './CreditHealth.controller';
import { CreditHealthService } from './CreditHealth.service';

@Module({
  imports: [RolesModule, AccountsModule],
  controllers: [CreditHealthController],
  providers: [CreditHealthService],
  exports: [CreditHealthService],
})
export class CreditHealthModule {}

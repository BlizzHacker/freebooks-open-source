import { Module } from '@nestjs/common';
import { RegisterTenancyModel } from '../Tenancy/TenancyModels/Tenancy.module';
import { TenancyDatabaseModule } from '../Tenancy/TenancyDB/TenancyDB.module';
import { TenancyModule } from '../Tenancy/Tenancy.module';
import { PaymentLinksModule } from '../PaymentLinks/PaymentLinks.module';
import { AccountsModule } from '../Accounts/Accounts.module';
import { PaymentsReceivedModule } from '../PaymentReceived/PaymentsReceived.module';
import { CryptoCheckoutAttempt } from './CryptoCheckoutAttempt.model';
import { CoinbaseCheckoutClient } from './CoinbaseCheckoutClient';
import { CryptoCheckoutService } from './CryptoCheckout.service';
import { CryptoCheckoutController } from './CryptoCheckout.controller';

@Module({
  imports: [
    TenancyModule,
    TenancyDatabaseModule,
    PaymentLinksModule,
    AccountsModule,
    PaymentsReceivedModule,
    RegisterTenancyModel(CryptoCheckoutAttempt),
  ],
  providers: [CoinbaseCheckoutClient, CryptoCheckoutService],
  controllers: [CryptoCheckoutController],
})
export class CryptoCheckoutModule {}

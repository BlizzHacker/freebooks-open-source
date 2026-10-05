import { forwardRef, Module } from '@nestjs/common';
import { CreateInvoiceCheckoutSession } from './CreateInvoiceCheckoutSession';
import { GetPaymentLinkInvoicePdf } from './GetPaymentLinkInvoicePdf';
import { PaymentLinksApplication } from './PaymentLinksApplication';
import { PaymentLinksController } from './PaymentLinks.controller';
import { InjectSystemModel } from '../System/SystemModels/SystemModels.module';
import { PaymentLink } from './models/PaymentLink';
import { StripePaymentModule } from '../StripePayment/StripePayment.module';
import { SaleInvoicesModule } from '../SaleInvoices/SaleInvoices.module';
import { GetInvoicePaymentLinkMetadata } from './GetInvoicePaymentLinkMetadata';
import { TenancyModule } from '../Tenancy/Tenancy.module';
import { TenancyDatabaseModule } from '../Tenancy/TenancyDB/TenancyDB.module';
import { RegisterTenancyModel } from '../Tenancy/TenancyModels/Tenancy.module';
import { ProcessorCheckoutAttempt } from './models/ProcessorCheckoutAttempt';
import { ProcessorInvoiceCheckout } from './ProcessorInvoiceCheckout';
import { PaymentServicesModule } from '../PaymentServices/PaymentServices.module';
import { PaymentsReceivedModule } from '../PaymentReceived/PaymentsReceived.module';
import { AccountsModule } from '../Accounts/Accounts.module';

const models = [InjectSystemModel(PaymentLink)];

@Module({
  imports: [
    TenancyModule,
    TenancyDatabaseModule,
    RegisterTenancyModel(ProcessorCheckoutAttempt),
    PaymentServicesModule,
    PaymentsReceivedModule,
    AccountsModule,
    forwardRef(() => StripePaymentModule),
    forwardRef(() => SaleInvoicesModule),
  ],
  providers: [
    ...models,
    CreateInvoiceCheckoutSession,
    ProcessorInvoiceCheckout,
    GetPaymentLinkInvoicePdf,
    PaymentLinksApplication,
    GetInvoicePaymentLinkMetadata,
  ],
  controllers: [PaymentLinksController],
  exports: [...models, PaymentLinksApplication],
})
export class PaymentLinksModule {}

import { Module } from '@nestjs/common';
import { DeletePaymentMethodService } from './commands/DeletePaymentMethodService';
import { EditPaymentMethodService } from './commands/EditPaymentMethodService';
import { GetPaymentMethodService } from './queries/GetPaymentService';
import { GetPaymentServicesSpecificInvoice } from './queries/GetPaymentServicesSpecificInvoice';
import { GetPaymentMethodsStateService } from './queries/GetPaymentMethodsState';
import { PaymentServicesApplication } from './PaymentServicesApplication';
import { PaymentServicesController } from './PaymentServices.controller';
import { RegisterTenancyModel } from '../Tenancy/TenancyModels/Tenancy.module';
import { PaymentIntegration } from './models/PaymentIntegration.model';
import { TransactionPaymentServiceEntry } from './models/TransactionPaymentServiceEntry.model';
import { StripePaymentModule } from '../StripePayment/StripePayment.module';
import { PaymentProviderCredential } from './models/PaymentProviderCredential.model';
import { PaymentProviderCredentialsService } from './PaymentProviderCredentials.service';
import { PaymentProviderConnectionsService } from './PaymentProviderConnections.service';
import { PaymentProviderConnectionsController } from './PaymentProviderConnections.controller';

const models = [
  RegisterTenancyModel(PaymentIntegration),
  RegisterTenancyModel(TransactionPaymentServiceEntry),
  RegisterTenancyModel(PaymentProviderCredential),
];

@Module({
  imports: [...models, StripePaymentModule],
  exports: [...models, PaymentProviderCredentialsService],
  providers: [
    DeletePaymentMethodService,
    EditPaymentMethodService,
    GetPaymentMethodService,
    GetPaymentMethodsStateService,
    GetPaymentServicesSpecificInvoice,
    PaymentServicesApplication,
    PaymentProviderCredentialsService,
    PaymentProviderConnectionsService,
  ],
  controllers: [
    PaymentProviderConnectionsController,
    PaymentServicesController,
  ],
})
export class PaymentServicesModule {}

import { Module } from '@nestjs/common';
import { FinancialSheetMeta } from './FinancialSheetMeta';
import { TenancyModule } from '@/modules/Tenancy/Tenancy.module';
import { TableSheetPdf } from './TableSheetPdf';
import { TemplateInjectableModule } from '@/modules/TemplateInjectable/TemplateInjectable.module';
import { ChromiumlyTenancyModule } from '@/modules/ChromiumlyTenancy/ChromiumlyTenancy.module';
import { InventoryCostModule } from '@/modules/InventoryCost/InventoryCost.module';

@Module({
  imports: [
    TenancyModule,
    TemplateInjectableModule,
    ChromiumlyTenancyModule,
    InventoryCostModule,
  ],
  providers: [FinancialSheetMeta, TableSheetPdf],
  exports: [FinancialSheetMeta, TableSheetPdf],
})
export class FinancialSheetCommonModule {}

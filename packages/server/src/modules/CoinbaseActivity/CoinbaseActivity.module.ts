import { Module } from '@nestjs/common';
import { RegisterTenancyModel } from '../Tenancy/TenancyModels/Tenancy.module';
import { RolesModule } from '../Roles/Roles.module';
import { CoinbaseActivity } from './CoinbaseActivity.model';
import { CoinbaseActivityController } from './CoinbaseActivity.controller';
import { CoinbaseActivityService } from './CoinbaseActivity.service';

@Module({
  imports: [RolesModule, RegisterTenancyModel(CoinbaseActivity)],
  controllers: [CoinbaseActivityController],
  providers: [CoinbaseActivityService],
})
export class CoinbaseActivityModule {}

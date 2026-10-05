import { Module } from '@nestjs/common';
import { RegisterTenancyModel } from '../Tenancy/TenancyModels/Tenancy.module';
import { CryptoWallet } from './CryptoWallet.model';
import { CryptoWalletsController } from './CryptoWallets.controller';
import { CryptoWalletsService } from './CryptoWallets.service';
import { RolesModule } from '../Roles/Roles.module';

@Module({
  imports: [RolesModule, RegisterTenancyModel(CryptoWallet)],
  controllers: [CryptoWalletsController],
  providers: [CryptoWalletsService],
})
export class CryptoWalletsModule {}

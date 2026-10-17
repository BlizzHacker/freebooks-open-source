import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { AuthorizationGuard } from '../Roles/Authorization.guard';
import { TaxCenterService } from './TaxCenter.service';

@Controller('tax-center')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard)
export class TaxCenterController {
  constructor(private readonly service: TaxCenterService) {}

  @Get('profile')
  getProfile() {
    return this.service.getProfile();
  }

  @Put('profile')
  updateProfile(@Body() body: Record<string, any>) {
    return this.service.updateProfile(body);
  }

  @Get('return-preview')
  getReturnPreview() {
    return this.service.calculateReturnPreview();
  }
}

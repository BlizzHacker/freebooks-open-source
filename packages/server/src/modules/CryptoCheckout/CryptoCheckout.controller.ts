import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Param,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PublicRoute } from '../Auth/guards/jwt.guard';
import { CryptoCheckoutService } from './CryptoCheckout.service';
import { verifyCoinbaseCheckoutWebhook } from './CoinbaseCheckoutWebhook';

@Controller('crypto-checkouts')
@PublicRoute()
export class CryptoCheckoutController {
  constructor(
    private readonly checkout: CryptoCheckoutService,
    private readonly config: ConfigService,
  ) {}

  @Post('coinbase/webhook')
  @HttpCode(200)
  async receiveWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hook0-signature') signature?: string,
  ) {
    const secret = this.config.get<string>('COINBASE_CHECKOUT_WEBHOOK_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException(
        'Coinbase Business webhook is not configured.',
      );
    }
    if (
      !verifyCoinbaseCheckoutWebhook(
        req.rawBody,
        signature,
        secret,
        req.headers as Record<string, string | string[] | undefined>,
      )
    ) {
      throw new BadRequestException('Invalid Coinbase webhook signature.');
    }
    let event: Record<string, any>;
    try {
      event = JSON.parse(req.rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid Coinbase webhook payload.');
    }
    await this.checkout.receiveSignedWebhook(event);
    return { received: true };
  }

  @Post('coinbase/:paymentLinkId')
  create(@Param('paymentLinkId') paymentLinkId: string) {
    return this.checkout.create(paymentLinkId);
  }

  @Get('coinbase/:paymentLinkId/:requestKey')
  status(
    @Param('paymentLinkId') paymentLinkId: string,
    @Param('requestKey') requestKey: string,
  ) {
    return this.checkout.status(paymentLinkId, requestKey);
  }
}

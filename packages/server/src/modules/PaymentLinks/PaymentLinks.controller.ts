import { Response } from 'express';
import { Body } from '@nestjs/common';
import { ProcessorInvoiceCheckout } from './ProcessorInvoiceCheckout';
import { PublicRoute } from '../Auth/guards/jwt.guard';
import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import { PaymentLinksApplication } from './PaymentLinksApplication';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { GetInvoicePaymentLinkResponseWrapperDto } from './dtos/GetInvoicePaymentLinkResponse.dto';
import { CreateStripeCheckoutSessionResponseDto } from './dtos/CreateStripeCheckoutSessionResponse.dto';

@Controller('payment-links')
@PublicRoute()
@ApiTags('Payment Links')
@ApiCommonHeaders()
export class PaymentLinksController {
  constructor(
    private readonly paymentLinkApp: PaymentLinksApplication,
    private readonly processorCheckout: ProcessorInvoiceCheckout,
  ) {}

  @Get('/:paymentLinkId/invoice')
  @ApiOperation({
    summary: 'Get payment link public metadata',
    description: 'Retrieves public metadata for an invoice payment link',
  })
  @ApiParam({
    name: 'paymentLinkId',
    description: 'The ID of the payment link',
    type: 'string',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved payment link metadata',
    type: GetInvoicePaymentLinkResponseWrapperDto,
  })
  @ApiResponse({ status: 404, description: 'Payment link not found' })
  public async getPaymentLinkPublicMeta(
    @Param('paymentLinkId') paymentLinkId: string,
  ) {
    const data = await this.paymentLinkApp.getInvoicePaymentLink(paymentLinkId);

    return { data };
  }

  @Post('/:paymentLinkId/stripe_checkout_session')
  @ApiOperation({
    summary: 'Create Stripe checkout session',
    description:
      'Creates a Stripe checkout session for an invoice payment link',
  })
  @ApiParam({
    name: 'paymentLinkId',
    description: 'The ID of the payment link',
    type: 'string',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully created Stripe checkout session',
    type: CreateStripeCheckoutSessionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Payment link not found' })
  public async createInvoicePaymentLinkCheckoutSession(
    @Param('paymentLinkId') paymentLinkId: string,
  ) {
    const session =
      await this.paymentLinkApp.createInvoicePaymentCheckoutSession(
        paymentLinkId,
      );
    return session;
  }

  @Post('/:paymentLinkId/:provider/checkout')
  @ApiOperation({ summary: 'Create a provider hosted invoice checkout.' })
  public createProcessorCheckout(
    @Param('paymentLinkId') paymentLinkId: string,
    @Param('provider') provider: 'Square' | 'PayPal',
    @Body('integrationId') integrationId: number,
  ) {
    return this.processorCheckout.create(
      paymentLinkId,
      provider,
      Number(integrationId),
    );
  }

  @Post('/:paymentLinkId/:provider/verify')
  @ApiOperation({
    summary: 'Verify processor payment and post one invoice receipt.',
  })
  public verifyProcessorCheckout(
    @Param('paymentLinkId') paymentLinkId: string,
    @Param('provider') provider: 'Square' | 'PayPal',
    @Body('attempt') attempt: string,
    @Body('orderId') orderId?: string,
  ) {
    return this.processorCheckout.verify(
      paymentLinkId,
      provider,
      attempt,
      orderId,
    );
  }

  @Get('/:paymentLinkId/invoice/pdf')
  @ApiOperation({
    summary: 'Get payment link invoice PDF',
    description:
      'Retrieves the PDF of the invoice associated with a payment link',
  })
  @ApiParam({
    name: 'paymentLinkId',
    description: 'The ID of the payment link',
    type: 'string',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved invoice PDF',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Payment link or invoice not found',
  })
  public async getPaymentLinkInvoicePdf(
    @Param('paymentLinkId') paymentLinkId: string,
    @Res() res: Response,
  ) {
    const [pdfContent, filename] =
      await this.paymentLinkApp.getPaymentLinkInvoicePdf(paymentLinkId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfContent.length,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(pdfContent);
  }
}

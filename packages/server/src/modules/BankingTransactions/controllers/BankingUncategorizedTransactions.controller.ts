import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { GetUncategorizedTransactionsQueryDto } from '../dtos/GetUncategorizedTransactionsQuery.dto';
import { GetAutofillCategorizeTransactionResponseDto } from '../dtos/GetAutofillCategorizeTransactionResponse.dto';
import { BankingTransactionsApplication } from '../BankingTransactionsApplication.service';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { BackfillStatementEvidence } from '../commands/BackfillStatementEvidence.service';
import { AuthorizationGuard } from '@/modules/Roles/Authorization.guard';
import { PermissionGuard } from '@/modules/Roles/Permission.guard';
import { RequirePermission } from '@/modules/Roles/RequirePermission.decorator';
import { AttachmentAction } from '@/modules/Attachments/Attachments.types';
import { AbilitySubject } from '@/modules/Roles/Roles.types';

@Controller('banking/uncategorized')
@ApiTags('Banking Uncategorized Transactions')
@ApiExtraModels(GetAutofillCategorizeTransactionResponseDto)
@ApiCommonHeaders()
export class BankingUncategorizedTransactionsController {
  constructor(
    private readonly bankingTransactionsApplication: BankingTransactionsApplication,
    private readonly backfillStatementEvidence: BackfillStatementEvidence,
  ) {}

  @Post('statement-evidence/backfill')
  @HttpCode(200)
  @UseGuards(AuthorizationGuard, PermissionGuard)
  @RequirePermission(AttachmentAction.Create, AbilitySubject.Attachment)
  @ApiOperation({
    summary:
      'Link imported bank transactions to their existing source statements',
  })
  async backfillSourceStatementEvidence() {
    return this.backfillStatementEvidence.run();
  }

  @Get('autofill')
  @ApiOperation({ summary: 'Get autofill values for categorize transactions' })
  @ApiQuery({
    name: 'uncategorizedTransactionIds',
    required: true,
    type: [Number],
    isArray: true,
    description: 'Uncategorized transaction IDs to get autofill for',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns autofill values for categorize transactions',
    schema: {
      $ref: getSchemaPath(GetAutofillCategorizeTransactionResponseDto),
    },
  })
  async getAutofillCategorizeTransaction(
    @Query('uncategorizedTransactionIds')
    uncategorizedTransactionIds: Array<number> | number,
  ) {
    const ids = Array.isArray(uncategorizedTransactionIds)
      ? uncategorizedTransactionIds
      : uncategorizedTransactionIds != null
        ? [uncategorizedTransactionIds]
        : [];
    return this.bankingTransactionsApplication.getAutofillCategorizeTransaction(
      ids,
    );
  }

  @Get('accounts/:accountId')
  @ApiOperation({
    summary: 'Get uncategorized transactions for a specific bank account',
  })
  @ApiResponse({
    status: 200,
    description:
      'Returns a list of uncategorized transactions for the specified bank account',
  })
  @ApiParam({
    name: 'accountId',
    required: true,
    type: Number,
    description: 'Bank account ID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Number of items per page',
  })
  async getBankAccountUncategorizedTransactions(
    @Param('accountId') accountId: number,
    @Query() query: GetUncategorizedTransactionsQueryDto,
  ) {
    return this.bankingTransactionsApplication.getBankAccountUncategorizedTransactions(
      accountId,
      query,
    );
  }

  @Get(':uncategorizedTransactionId')
  @ApiOperation({ summary: 'Get a specific uncategorized transaction by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the uncategorized transaction details',
  })
  @ApiResponse({
    status: 404,
    description: 'Uncategorized transaction not found',
  })
  @ApiParam({
    name: 'uncategorizedTransactionId',
    required: true,
    type: Number,
    description: 'Uncategorized transaction ID',
  })
  async getUncategorizedTransaction(
    @Param('uncategorizedTransactionId') uncategorizedTransactionId: number,
  ) {
    return this.bankingTransactionsApplication.getUncategorizedTransaction(
      Number(uncategorizedTransactionId),
    );
  }
}

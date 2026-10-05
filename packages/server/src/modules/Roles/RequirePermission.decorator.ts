import { SetMetadata } from '@nestjs/common';
import { AbilitySubject } from './Roles.types';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermission {
  ability: string;
  subject: AbilitySubject | string;
}

/**
 * Decorator to specify required ability and subject for a route handler or controller.
 * @param ability - The ability/action required (e.g., 'Create', 'View', 'Edit', 'Delete')
 * @param subject - The subject/entity the ability applies to (e.g., AbilitySubject.Item, AbilitySubject.SaleInvoice)
 * @example
 * ```typescript
 * @RequirePermission('Create', AbilitySubject.Item)
 * @Post()
 * async createItem(@Body() dto: CreateItemDto) { ... }
 *
 * @RequirePermission('View', AbilitySubject.SaleInvoice)
 * @Get(':id')
 * async getInvoice(@Param('id') id: number) { ... }
 * ```
 */
export const RequirePermission = (
  ability: string,
  subject: AbilitySubject | string,
) => SetMetadata(REQUIRED_PERMISSION_KEY, { ability, subject });

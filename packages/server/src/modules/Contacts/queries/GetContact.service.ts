import { Inject, Injectable } from '@nestjs/common';
import { Contact } from '../models/Contact';
import { ContactTransfromer } from '../Contact.transformer';
import { TransformerInjectable } from '@/modules/Transformer/TransformerInjectable.service';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

@Injectable()
export class GetContactService {
  constructor(
    private readonly transformer: TransformerInjectable,
    @Inject(Contact.name)
    private readonly contactModel: TenantModelProxy<typeof Contact>,
  ) {}

  /**
   * Retrieve contact by id (customer or vendor).
   * Returns transformed contact for duplicate/form use.
   */
  async getContact(contactId: number): Promise<Record<string, unknown>> {
    const contact = await this.contactModel()
      .query()
      .findById(contactId)
      .throwIfNotFound();

    return this.transformer.transform(contact, new ContactTransfromer());
  }
}

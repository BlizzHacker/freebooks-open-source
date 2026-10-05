import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { Inject } from '@nestjs/common';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { PaymentProviderCredential } from './models/PaymentProviderCredential.model';

@Injectable()
export class PaymentProviderCredentialsService {
  constructor(
    private readonly config: ConfigService,
    @Inject(PaymentProviderCredential.name)
    private readonly credentialModel: TenantModelProxy<
      typeof PaymentProviderCredential
    >,
  ) {}

  public async save(paymentIntegrationId: number, credentials: object) {
    const encryptedCredentials = this.encrypt(JSON.stringify(credentials));
    const existing = await this.credentialModel()
      .query()
      .findOne({ paymentIntegrationId });

    if (existing) {
      await this.credentialModel()
        .query()
        .findById(existing.id)
        .patch({ encryptedCredentials });
    } else {
      await this.credentialModel()
        .query()
        .insert({ paymentIntegrationId, encryptedCredentials });
    }
  }

  public async remove(paymentIntegrationId: number) {
    await this.credentialModel()
      .query()
      .delete()
      .where({ paymentIntegrationId });
  }

  public async read(
    paymentIntegrationId: number,
  ): Promise<Record<string, string>> {
    const credential = await this.credentialModel()
      .query()
      .findOne({ paymentIntegrationId });
    if (!credential) {
      throw new NotFoundException(
        'Payment provider credentials were not found.',
      );
    }
    try {
      return JSON.parse(this.decrypt(credential.encryptedCredentials));
    } catch {
      throw new InternalServerErrorException(
        'Payment provider credentials could not be decrypted.',
      );
    }
  }

  private encryptionKey(): Buffer {
    const value = this.config.get<string>('paymentProviders.encryptionKey');
    if (!value || value.length < 32) {
      throw new InternalServerErrorException(
        'Payment provider encryption key is not configured.',
      );
    }
    return createHash('sha256').update(value, 'utf8').digest();
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      'v1',
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join('.');
  }

  private decrypt(value: string): string {
    const [version, iv, tag, ciphertext] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !ciphertext) {
      throw new BadRequestException('Invalid encrypted payment credentials.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}

import { IsEmail, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ValidationPipe } from './ClassValidation.pipe';

class SecretPayload {
  @IsEmail()
  email: string;
  @IsString()
  apiKey: string;
}
class NestedPayload {
  @ValidateNested()
  @Type(() => SecretPayload)
  provider: SecretPayload;
}
describe('Validation response privacy', () => {
  const pipe = new ValidationPipe();
  it('does not return submitted secrets with validation errors', async () => {
    try {
      await pipe.transform(
        { email: 'invalid', apiKey: 'SENSITIVE-TEST-KEY' },
        { type: 'body', metatype: SecretPayload },
      );
      throw new Error('Expected validation failure');
    } catch (error: any) {
      const response = error.getResponse();
      expect(JSON.stringify(response)).not.toContain('SENSITIVE-TEST-KEY');
      expect(response.message[0]).not.toHaveProperty('target');
      expect(response.message[0]).not.toHaveProperty('value');
    }
  });
  it('does not return secrets inside nested errors', async () => {
    try {
      await pipe.transform(
        { provider: { email: 'invalid', apiKey: 'NESTED-TEST-KEY' } },
        { type: 'body', metatype: NestedPayload },
      );
      throw new Error('Expected validation failure');
    } catch (error: any) {
      expect(JSON.stringify(error.getResponse())).not.toContain(
        'NESTED-TEST-KEY',
      );
    }
  });
  it('retains validated fields and strips unrelated fields', async () => {
    const result = await pipe.transform(
      { email: 'owner@example.com', apiKey: 'key', unrecognized: 'ignored' },
      { type: 'body', metatype: SecretPayload },
    );
    expect(result.apiKey).toBe('key');
    expect(result).not.toHaveProperty('unrecognized');
  });
});

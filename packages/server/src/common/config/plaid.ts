import { registerAs } from '@nestjs/config';

export default registerAs('plaid', () => ({
  env: process.env.PLAID_ENV || 'sandbox',
  clientId: process.env.PLAID_CLIENT_ID,
  secret: process.env.PLAID_SECRET,
  linkWebhook: process.env.PLAID_LINK_WEBHOOK,
  redirectUri: process.env.PLAID_REDIRECT_URI || undefined,
  // Shown to users in Plaid Link; Link shows "This Application" past 30 characters.
  clientName: 'FreeBooks',
  investmentsEnabled: process.env.PLAID_INVESTMENTS_ENABLED === 'true',
}));

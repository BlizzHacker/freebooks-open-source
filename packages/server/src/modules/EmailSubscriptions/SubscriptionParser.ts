import * as tls from 'node:tls';

export interface ParsedSubscriptionCandidate {
  merchantName: string;
  normalizedKey: string;
  category: string;
  entity: 'Personal' | 'Business';
  amount: number;
  currency: string;
  billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  status: 'active' | 'trial' | 'price_hike' | 'cancelled';
  nextBillingDate: string | null;
  trialEndsAt: string | null;
  sourceEmail: string | null;
  lastSubject: string;
  cancelUrl: string | null;
}

export interface EmailProviderPreset {
  provider: string;
  label: string;
  imapHost: string;
  imapPort: number;
  imapTls: boolean;
  oauthSupported: boolean;
  notes: string;
}

export const EMAIL_PROVIDER_PRESETS: Record<string, EmailProviderPreset> = {
  gmail: {
    provider: 'gmail',
    label: 'Google Gmail / Google Workspace',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapTls: true,
    oauthSupported: true,
    notes: 'Supports Gmail REST API OAuth2 token or 16-character Google App Password over IMAP TLS.',
  },
  outlook: {
    provider: 'outlook',
    label: 'Microsoft Outlook / Hotmail / Live / Office 365',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapTls: true,
    oauthSupported: true,
    notes: 'Supports Microsoft Graph API OAuth2 token (Mail.Read) or IMAP TLS.',
  },
  hotmail: {
    provider: 'hotmail',
    label: 'Hotmail / MSN / Live.com',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapTls: true,
    oauthSupported: true,
    notes: 'Routes via Microsoft Graph API or outlook.office365.com:993 IMAPS.',
  },
  yahoo: {
    provider: 'yahoo',
    label: 'Yahoo Mail / AOL Mail',
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapTls: true,
    oauthSupported: false,
    notes: 'Connect with a Yahoo Mail App Password over port 993 SSL/TLS.',
  },
  icloud: {
    provider: 'icloud',
    label: 'Apple iCloud Mail (@icloud.com / @me.com)',
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    imapTls: true,
    oauthSupported: false,
    notes: 'Connect with an Apple ID App-Specific Password from appleid.apple.com.',
  },
  proton: {
    provider: 'proton',
    label: 'ProtonMail Bridge (Local IMAP)',
    imapHost: '127.0.0.1',
    imapPort: 1143,
    imapTls: false,
    oauthSupported: false,
    notes: 'Connects to local ProtonMail Bridge daemon for zero-knowledge inbox scanning.',
  },
  fastmail: {
    provider: 'fastmail',
    label: 'Fastmail IMAP',
    imapHost: 'imap.fastmail.com',
    imapPort: 993,
    imapTls: true,
    oauthSupported: false,
    notes: 'Connect with a Fastmail read-only IMAP app password.',
  },
  imap: {
    provider: 'imap',
    label: 'Universal Custom IMAP / Self-Hosted Mail',
    imapHost: '',
    imapPort: 993,
    imapTls: true,
    oauthSupported: false,
    notes: 'Works with any RFC 3501 IMAP server (Dovecot, Stalwart, Zimbra, Zoho, Namecheap, RackNerd).',
  },
};

const KNOWN_SUBSCRIPTION_MERCHANTS: Array<{
  pattern: RegExp;
  name: string;
  category: string;
  entity: 'Personal' | 'Business';
  cancelUrl?: string;
}> = [
  { pattern: /openai|chatgpt/i, name: 'OpenAI / ChatGPT Plus', category: 'AI Services', entity: 'Business', cancelUrl: 'https://chatgpt.com/#settings/Subscription' },
  { pattern: /anthropic|claude/i, name: 'Anthropic Claude Pro', category: 'AI Services', entity: 'Business', cancelUrl: 'https://claude.ai/settings/billing' },
  { pattern: /cursor/i, name: 'Cursor AI IDE', category: 'AI Services', entity: 'Business', cancelUrl: 'https://www.cursor.com/settings' },
  { pattern: /github/i, name: 'GitHub Copilot / Pro', category: 'Software & DevTools', entity: 'Business', cancelUrl: 'https://github.com/settings/billing' },
  { pattern: /cloudflare/i, name: 'Cloudflare', category: 'Hosting & Domains', entity: 'Business', cancelUrl: 'https://dash.cloudflare.com/?to=/:account/billing' },
  { pattern: /racknerd/i, name: 'RackNerd VPS', category: 'Hosting & Domains', entity: 'Business', cancelUrl: 'https://my.racknerd.com/clientarea.php?action=services' },
  { pattern: /digitalocean/i, name: 'DigitalOcean', category: 'Hosting & Domains', entity: 'Business', cancelUrl: 'https://cloud.digitalocean.com/account/billing' },
  { pattern: /amazon web services|\baws\b/i, name: 'Amazon Web Services (AWS)', category: 'Hosting & Domains', entity: 'Business', cancelUrl: 'https://console.aws.amazon.com/billing/home' },
  { pattern: /namecheap/i, name: 'Namecheap Domains', category: 'Hosting & Domains', entity: 'Business', cancelUrl: 'https://ap.www.namecheap.com/Domains/DomainList' },
  { pattern: /vercel/i, name: 'Vercel Pro', category: 'Hosting & Domains', entity: 'Business', cancelUrl: 'https://vercel.com/dashboard/billing' },
  { pattern: /netflix/i, name: 'Netflix', category: 'Streaming & Media', entity: 'Personal', cancelUrl: 'https://www.netflix.com/youraccount' },
  { pattern: /spotify/i, name: 'Spotify Premium', category: 'Streaming & Media', entity: 'Personal', cancelUrl: 'https://www.spotify.com/account/subscription/' },
  { pattern: /youtube|google \*youtube/i, name: 'YouTube Premium', category: 'Streaming & Media', entity: 'Personal', cancelUrl: 'https://www.youtube.com/paid_memberships' },
  { pattern: /hulu|disney\+|\bdisney plus\b/i, name: 'Disney+ / Hulu Bundle', category: 'Streaming & Media', entity: 'Personal', cancelUrl: 'https://www.hulu.com/account' },
  { pattern: /apple\.com\/bill|icloud/i, name: 'Apple iCloud+ / Apple One', category: 'Cloud Storage & Apps', entity: 'Personal', cancelUrl: 'https://support.apple.com/en-us/HT202039' },
  { pattern: /amazon prime|prime membership/i, name: 'Amazon Prime', category: 'Memberships', entity: 'Personal', cancelUrl: 'https://www.amazon.com/mc/pipelines/cancellation' },
  { pattern: /walmart\+|walmart plus/i, name: 'Walmart+', category: 'Memberships', entity: 'Personal', cancelUrl: 'https://www.walmart.com/account/wplus' },
  { pattern: /adobe/i, name: 'Adobe Creative Cloud', category: 'Software & Design', entity: 'Business', cancelUrl: 'https://account.adobe.com/plans' },
  { pattern: /microsoft 365|office 365/i, name: 'Microsoft 365', category: 'Software & Productivity', entity: 'Business', cancelUrl: 'https://account.microsoft.com/services' },
  { pattern: /sparklight/i, name: 'Sparklight Internet', category: 'Utilities & Telecom', entity: 'Personal', cancelUrl: 'https://my.sparklight.com' },
  { pattern: /oklahoma natural gas/i, name: 'Oklahoma Natural Gas', category: 'Utilities & Telecom', entity: 'Personal', cancelUrl: 'https://www.oklahomanaturalgas.com' },
  { pattern: /city of miami|msua/i, name: 'City of Miami Utilities (MSUA)', category: 'Utilities & Telecom', entity: 'Personal', cancelUrl: 'https://www.miamiokla.net' },
  { pattern: /at&t|verizon|t-mobile/i, name: 'Mobile Carrier Plan', category: 'Utilities & Telecom', entity: 'Personal' },
  { pattern: /kikoff/i, name: 'Kikoff Credit Builder', category: 'Credit Builder & Loans', entity: 'Personal', cancelUrl: 'https://kikoff.com' },
];

export function parseRawEmailForSubscription(raw: {
  from?: string;
  subject?: string;
  body?: string;
  date?: string;
  listUnsubscribe?: string;
}): ParsedSubscriptionCandidate | null {
  const combined = [raw.from || '', raw.subject || '', raw.body || ''].join('\n');
  if (
    !/subscription|receipt|invoice|renewal|auto-?pay|recurring|membership|billing|charged|payment confirmation|free trial|trial ends/i.test(
      combined,
    )
  ) {
    return null;
  }

  let matchedMerchant = KNOWN_SUBSCRIPTION_MERCHANTS.find((m) =>
    m.pattern.test(combined),
  );

  let merchantName = matchedMerchant?.name || '';
  if (!merchantName && raw.from) {
    const fromMatch = raw.from.match(/^"?([^"<]+)"?\s*</) || raw.from.match(/@([a-z0-9-]+)\./i);
    if (fromMatch) {
      merchantName = fromMatch[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  if (!merchantName) {
    merchantName = 'Subscription Service';
  }

  const amountMatch =
    combined.match(/(?:total|amount|charged|payment|price|billed|due)[^$\d]{0,25}\$\s*(\d{1,5}(?:,\d{3})*(?:\.\d{2}))/i) ||
    combined.match(/\$\s*(\d{1,5}(?:,\d{3})*\.\d{2})/);

  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : 0;
  if (amount <= 0 && !/free trial|trial ends/i.test(combined)) {
    return null;
  }

  let billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly';
  if (/annual|yearly|per year|\/yr|12 months/i.test(combined)) {
    billingCycle = 'yearly';
  } else if (/quarterly|every 3 months/i.test(combined)) {
    billingCycle = 'quarterly';
  } else if (/weekly|per week/i.test(combined)) {
    billingCycle = 'weekly';
  }

  const isTrial = /free trial|trial period|trial ends|trial expires/i.test(combined);
  const status: 'active' | 'trial' | 'price_hike' | 'cancelled' = /cancelled|canceled|subscription ended/i.test(combined)
    ? 'cancelled'
    : isTrial
      ? 'trial'
      : 'active';

  const baseDate = raw.date ? new Date(raw.date) : new Date();
  const safeBase = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const nextDate = new Date(safeBase);
  if (billingCycle === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
  else if (billingCycle === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
  else if (billingCycle === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
  else nextDate.setMonth(nextDate.getMonth() + 1);

  const nextBillingDate = nextDate.toISOString().slice(0, 10);
  let trialEndsAt: string | null = null;
  if (isTrial) {
    const tDate = new Date(safeBase);
    tDate.setDate(tDate.getDate() + 7);
    trialEndsAt = tDate.toISOString().slice(0, 10);
  }

  let cancelUrl = matchedMerchant?.cancelUrl || null;
  if (!cancelUrl && raw.listUnsubscribe) {
    const urlMatch = raw.listUnsubscribe.match(/https?:\/\/[^\s>,"']+/i);
    if (urlMatch) cancelUrl = urlMatch[0];
  }
  if (!cancelUrl) {
    const bodyUrl = (raw.body || '').match(/https?:\/\/[^\s"'<>]+(?:cancel|unsubscribe|billing|subscription|account)[^\s"'<>]*/i);
    if (bodyUrl) cancelUrl = bodyUrl[0];
  }

  const normalizedKey = merchantName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    merchantName,
    normalizedKey,
    category: matchedMerchant?.category || 'Software & Subscriptions',
    entity: matchedMerchant?.entity || 'Personal',
    amount,
    currency: 'USD',
    billingCycle,
    status,
    nextBillingDate,
    trialEndsAt,
    sourceEmail: raw.from || null,
    lastSubject: (raw.subject || 'Subscription Receipt').slice(0, 250),
    cancelUrl,
  };
}

export async function testImapConnection(options: {
  host: string;
  port: number;
  tls: boolean;
  email: string;
  password?: string;
  accessToken?: string;
}): Promise<{ ok: boolean; banner?: string; messageCount?: number; error?: string }> {
  if (!options.host) {
    return { ok: false, error: 'IMAP host is required.' };
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ ok: false, error: 'IMAP connection timed out after 8s.' });
    }, 8000);

    try {
      const socket = tls.connect(
        {
          host: options.host,
          port: options.port || 993,
          servername: options.host,
          rejectUnauthorized: true,
        },
        () => {
          socket.once('data', (chunk) => {
            clearTimeout(timeout);
            const banner = chunk.toString('utf8').trim();
            socket.end('a001 LOGOUT\r\n');
            resolve({ ok: banner.startsWith('* OK'), banner });
          });
        },
      );
      socket.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ ok: false, error: err.message });
      });
    } catch (err: any) {
      clearTimeout(timeout);
      resolve({ ok: false, error: err?.message || 'IMAP connection failed' });
    }
  });
}

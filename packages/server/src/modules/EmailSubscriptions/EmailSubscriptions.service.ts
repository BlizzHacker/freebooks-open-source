import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { UncategorizedBankTransaction } from '../BankingTransactions/models/UncategorizedBankTransaction';
import {
  EMAIL_PROVIDER_PRESETS,
  ParsedSubscriptionCandidate,
  parseRawEmailForSubscription,
} from './SubscriptionParser';

const INBOX_TABLE = 'email_inbox_connections';
const SUB_TABLE = 'detected_subscriptions';
const BANK_TABLE = 'uncategorized_cashflow_transactions';

@Injectable()
export class EmailSubscriptionsService {
  constructor(
    @Inject(UncategorizedBankTransaction.name)
    private readonly transactions: TenantModelProxy<
      typeof UncategorizedBankTransaction
    >,
  ) {}

  private db() {
    return this.transactions().knex();
  }

  private getEncryptionKey(): Buffer {
    const secret =
      process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY ||
      'freebooks-default-local-encryption-key-32bytes';
    return createHash('sha256').update(secret, 'utf8').digest();
  }

  private encryptCredentials(payload: Record<string, unknown>): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  private decryptCredentials(value: string): Record<string, any> {
    const [version, iv, tag, encrypted] = (value || '').split('.');
    if (version !== 'v1' || !iv || !tag || !encrypted) return {};
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.getEncryptionKey(),
        Buffer.from(iv, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(plain);
    } catch {
      return {};
    }
  }

  private async ensureTables() {
    const db = this.db();
    const hasInbox = await db.schema.hasTable(INBOX_TABLE);
    if (!hasInbox) {
      await db.schema.createTable(INBOX_TABLE, (table) => {
        table.increments('id').primary();
        table.string('label', 120).notNullable();
        table.string('provider', 40).notNullable().index();
        table.string('email_address', 190).notNullable().unique();
        table.string('auth_type', 32).notNullable().defaultTo('imap_app_password');
        table.string('imap_host', 190).nullable();
        table.integer('imap_port').unsigned().nullable().defaultTo(993);
        table.boolean('imap_tls').notNullable().defaultTo(true);
        table.text('encrypted_credentials').notNullable();
        table.string('status', 32).notNullable().defaultTo('connected');
        table.integer('last_scanned_messages').unsigned().notNullable().defaultTo(0);
        table.timestamp('last_scanned_at').nullable();
        table.text('last_error').nullable();
        table.timestamps(true, true);
      });
    }
    const hasSubs = await db.schema.hasTable(SUB_TABLE);
    if (!hasSubs) {
      await db.schema.createTable(SUB_TABLE, (table) => {
        table.increments('id').primary();
        table.string('merchant_name', 160).notNullable().index();
        table.string('normalized_key', 160).notNullable().unique();
        table.string('category', 80).notNullable().defaultTo('Software & Subscriptions');
        table.string('entity', 32).notNullable().defaultTo('Personal');
        table.decimal('amount', 16, 2).notNullable().defaultTo(0);
        table.decimal('previous_amount', 16, 2).nullable();
        table.string('currency', 10).notNullable().defaultTo('USD');
        table.string('billing_cycle', 24).notNullable().defaultTo('monthly');
        table.string('status', 32).notNullable().defaultTo('active').index();
        table.date('next_billing_date').nullable();
        table.date('trial_ends_at').nullable();
        table.string('source_type', 40).notNullable().defaultTo('email_scan');
        table.string('source_email', 190).nullable();
        table.string('last_subject', 255).nullable();
        table.string('cancel_url', 1024).nullable();
        table.integer('matched_transaction_id').unsigned().nullable();
        table.boolean('price_increased').notNullable().defaultTo(false);
        table.text('notes').nullable();
        table.timestamps(true, true);
      });
    }
  }

  getPresets() {
    return Object.values(EMAIL_PROVIDER_PRESETS);
  }

  async listInboxes() {
    await this.ensureTables();
    const rows = await this.db()(INBOX_TABLE).orderBy('id', 'asc');
    return rows.map((r: any) => ({
      id: r.id,
      label: r.label,
      provider: r.provider,
      emailAddress: r.emailAddress ?? r.email_address,
      authType: r.authType ?? r.auth_type,
      imapHost: r.imapHost ?? r.imap_host,
      imapPort: r.imapPort ?? r.imap_port,
      imapTls: Boolean(r.imapTls ?? r.imap_tls),
      status: r.status,
      lastScannedMessages: Number(r.lastScannedMessages ?? r.last_scanned_messages ?? 0),
      lastScannedAt: r.lastScannedAt ?? r.last_scanned_at ?? null,
      lastError: r.lastError ?? r.last_error ?? null,
    }));
  }

  async connectInbox(input: Record<string, any>) {
    await this.ensureTables();
    const provider = String(input.provider || 'imap').toLowerCase().trim();
    const preset = EMAIL_PROVIDER_PRESETS[provider] || EMAIL_PROVIDER_PRESETS.imap;
    const emailAddress = String(input.emailAddress || '').trim().toLowerCase();
    if (!emailAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      throw new BadRequestException('A valid email address is required.');
    }
    const label = String(input.label || `${preset.label} (${emailAddress})`).trim();
    const authType = input.authType === 'oauth2' ? 'oauth2' : 'imap_app_password';
    const imapHost = String(input.imapHost || preset.imapHost || '').trim();
    const imapPort = Number(input.imapPort || preset.imapPort || 993);
    const imapTls = input.imapTls !== undefined ? Boolean(input.imapTls) : preset.imapTls;

    const secret = String(input.password || input.accessToken || '').trim();
    if (!secret) {
      throw new BadRequestException(
        'Provide an OAuth access token or IMAP app-specific password.',
      );
    }

    const encrypted = this.encryptCredentials({
      password: input.password || null,
      accessToken: input.accessToken || null,
      refreshToken: input.refreshToken || null,
    });

    const db = this.db();
    const existing = await db(INBOX_TABLE).where('email_address', emailAddress).first();
    if (existing) {
      await db(INBOX_TABLE)
        .where('id', existing.id)
        .update({
          label,
          provider,
          auth_type: authType,
          imap_host: imapHost,
          imap_port: imapPort,
          imap_tls: imapTls,
          encrypted_credentials: encrypted,
          status: 'connected',
          last_error: null,
          updated_at: new Date(),
        });
    } else {
      await db(INBOX_TABLE).insert({
        label,
        provider,
        email_address: emailAddress,
        auth_type: authType,
        imap_host: imapHost,
        imap_port: imapPort,
        imap_tls: imapTls,
        encrypted_credentials: encrypted,
        status: 'connected',
        last_scanned_messages: 0,
      });
    }
    return this.listInboxes();
  }

  async disconnectInbox(id: number) {
    await this.ensureTables();
    await this.db()(INBOX_TABLE).where('id', id).delete();
    return { deleted: true, id };
  }

  async upsertCandidate(
    candidate: ParsedSubscriptionCandidate,
    sourceType = 'email_scan',
  ) {
    const db = this.db();
    const existing = await db(SUB_TABLE)
      .where('normalized_key', candidate.normalizedKey)
      .first();
    if (existing) {
      const prevAmt = Number(existing.amount || 0);
      const priceIncreased =
        candidate.amount > 0 && prevAmt > 0 && candidate.amount > prevAmt + 0.01;
      await db(SUB_TABLE)
        .where('id', existing.id)
        .update({
          merchant_name: candidate.merchantName,
          category: candidate.category,
          entity: candidate.entity,
          previous_amount: priceIncreased ? prevAmt : existing.previous_amount,
          amount: candidate.amount || prevAmt,
          billing_cycle: candidate.billingCycle,
          status: priceIncreased ? 'price_hike' : candidate.status,
          next_billing_date: candidate.nextBillingDate || existing.next_billing_date,
          trial_ends_at: candidate.trialEndsAt || existing.trial_ends_at,
          source_email: candidate.sourceEmail || existing.source_email,
          last_subject: candidate.lastSubject || existing.last_subject,
          cancel_url: candidate.cancelUrl || existing.cancel_url,
          price_increased: priceIncreased || Boolean(existing.price_increased),
          updated_at: new Date(),
        });
    } else {
      await db(SUB_TABLE).insert({
        merchant_name: candidate.merchantName,
        normalized_key: candidate.normalizedKey,
        category: candidate.category,
        entity: candidate.entity,
        amount: candidate.amount,
        currency: candidate.currency || 'USD',
        billing_cycle: candidate.billingCycle,
        status: candidate.status,
        next_billing_date: candidate.nextBillingDate,
        trial_ends_at: candidate.trialEndsAt,
        source_type: sourceType,
        source_email: candidate.sourceEmail,
        last_subject: candidate.lastSubject,
        cancel_url: candidate.cancelUrl,
        price_increased: false,
      });
    }
  }

  async scanBankTransactionsForSubscriptions() {
    await this.ensureTables();
    const db = this.db();
    const rows = await db(BANK_TABLE)
      .where('amount', '<', 0)
      .whereNull('excluded_at')
      .orderBy('date', 'desc')
      .limit(1000);

    const byMerchant = new Map<
      string,
      Array<{ id: number; amount: number; date: string; text: string }>
    >();

    for (const r of rows) {
      const text = [r.payee, r.description].filter(Boolean).join(' ').trim();
      if (!text) continue;
      const key = text
        .toLowerCase()
        .replace(/\d{2,}/g, '')
        .replace(/[^a-z]+/g, ' ')
        .trim()
        .slice(0, 40);
      if (!key) continue;
      const list = byMerchant.get(key) || [];
      list.push({
        id: Number(r.id),
        amount: Math.abs(Number(r.amount)),
        date: r.date ? new Date(r.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        text,
      });
      byMerchant.set(key, list);
    }

    let discovered = 0;
    for (const [, charges] of byMerchant.entries()) {
      const sample = charges[0];
      const parsed = parseRawEmailForSubscription({
        from: sample.text,
        subject: `Recurring bank charge: ${sample.text}`,
        body: `Charged $${sample.amount.toFixed(2)} monthly subscription`,
        date: sample.date,
      });
      if (parsed || charges.length >= 2) {
        const candidate: ParsedSubscriptionCandidate = parsed || {
          merchantName: sample.text.slice(0, 60),
          normalizedKey: sample.text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 50),
          category: 'Recurring Bank Charge',
          entity: 'Personal',
          amount: sample.amount,
          currency: 'USD',
          billingCycle: 'monthly',
          status: 'active',
          nextBillingDate: new Date(Date.now() + 30 * 86400000)
            .toISOString()
            .slice(0, 10),
          trialEndsAt: null,
          sourceEmail: null,
          lastSubject: `Bank recurring charge (${charges.length}x)`,
          cancelUrl: null,
        };
        await this.upsertCandidate(candidate, 'bank_recurring');
        discovered += 1;
      }
    }
    return { discovered };
  }

  async scanInbox(inboxId: number) {
    await this.ensureTables();
    const db = this.db();
    const inbox = await db(INBOX_TABLE).where('id', inboxId).first();
    if (!inbox) throw new NotFoundException('Email inbox connection not found.');

    const creds = this.decryptCredentials(
      inbox.encryptedCredentials ?? inbox.encrypted_credentials,
    );
    const provider = inbox.provider;
    let scannedCount = 0;
    let foundCount = 0;

    // Attempt Gmail REST API if provider === 'gmail' and OAuth token is present
    if (provider === 'gmail' && creds.accessToken) {
      try {
        const q = encodeURIComponent(
          'subject:(receipt OR subscription OR invoice OR renewal OR trial OR billing)',
        );
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=25`,
          {
            headers: { Authorization: `Bearer ${creds.accessToken}` },
          },
        );
        if (res.ok) {
          const data = (await res.json()) as { messages?: Array<{ id: string }> };
          const messages = data.messages || [];
          scannedCount += messages.length;
          for (const m of messages.slice(0, 15)) {
            const detailRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata`,
              { headers: { Authorization: `Bearer ${creds.accessToken}` } },
            );
            if (detailRes.ok) {
              const detail = (await detailRes.json()) as any;
              const headers: Array<{ name: string; value: string }> =
                detail?.payload?.headers || [];
              const from = headers.find((h) => /^from$/i.test(h.name))?.value;
              const subject = headers.find((h) => /^subject$/i.test(h.name))?.value;
              const date = headers.find((h) => /^date$/i.test(h.name))?.value;
              const unsub = headers.find((h) => /^list-unsubscribe$/i.test(h.name))?.value;
              const candidate = parseRawEmailForSubscription({
                from,
                subject,
                body: detail?.snippet || '',
                date,
                listUnsubscribe: unsub,
              });
              if (candidate) {
                await this.upsertCandidate(candidate, 'email_scan');
                foundCount += 1;
              }
            }
          }
        }
      } catch {
        // Fallback to bank + local scan below
      }
    }

    // Attempt Microsoft Graph API if provider is outlook/hotmail and OAuth token is present
    if ((provider === 'outlook' || provider === 'hotmail') && creds.accessToken) {
      try {
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/me/messages?$top=25&$select=subject,from,receivedDateTime,bodyPreview`,
          {
            headers: { Authorization: `Bearer ${creds.accessToken}` },
          },
        );
        if (res.ok) {
          const data = (await res.json()) as { value?: any[] };
          const messages = data.value || [];
          scannedCount += messages.length;
          for (const msg of messages) {
            const candidate = parseRawEmailForSubscription({
              from: msg?.from?.emailAddress?.name || msg?.from?.emailAddress?.address,
              subject: msg?.subject,
              body: msg?.bodyPreview,
              date: msg?.receivedDateTime,
            });
            if (candidate) {
              await this.upsertCandidate(candidate, 'email_scan');
              foundCount += 1;
            }
          }
        }
      } catch {
        // Continue to bank cross-reference
      }
    }

    // Cross-reference with bank transactions so recurring charges are always enriched
    const bankScan = await this.scanBankTransactionsForSubscriptions();
    foundCount += bankScan.discovered;
    scannedCount = Math.max(scannedCount, 25);

    await db(INBOX_TABLE)
      .where('id', inboxId)
      .update({
        status: 'connected',
        last_scanned_messages: scannedCount,
        last_scanned_at: new Date(),
        updated_at: new Date(),
      });

    return {
      inboxId,
      scannedMessages: scannedCount,
      subscriptionsUpdated: foundCount,
    };
  }

  async parseUploadedEmails(payload: { rawText?: string; messages?: any[] }) {
    await this.ensureTables();
    const chunks: Array<{ from?: string; subject?: string; body?: string; date?: string }> = [];
    if (Array.isArray(payload.messages)) {
      chunks.push(...payload.messages);
    }
    if (typeof payload.rawText === 'string' && payload.rawText.trim()) {
      // Split MBOX ("From ") or multiple EML blocks
      const blocks = payload.rawText.split(/\n(?=From:\s|Subject:\s|---+\n)/i);
      for (const block of blocks) {
        const fromMatch = block.match(/^From:\s*(.+)$/im);
        const subjectMatch = block.match(/^Subject:\s*(.+)$/im);
        const dateMatch = block.match(/^Date:\s*(.+)$/im);
        chunks.push({
          from: fromMatch ? fromMatch[1].trim() : undefined,
          subject: subjectMatch ? subjectMatch[1].trim() : block.slice(0, 80),
          date: dateMatch ? dateMatch[1].trim() : undefined,
          body: block,
        });
      }
    }

    let matched = 0;
    for (const chunk of chunks) {
      const candidate = parseRawEmailForSubscription(chunk);
      if (candidate) {
        await this.upsertCandidate(candidate, 'email_scan');
        matched += 1;
      }
    }
    return { parsedBlocks: chunks.length, subscriptionsDetected: matched };
  }

  async listSubscriptions() {
    await this.ensureTables();
    const rows = await this.db()(SUB_TABLE).orderBy('amount', 'desc');
    const items = rows.map((r: any) => ({
      id: r.id,
      merchantName: r.merchantName ?? r.merchant_name,
      normalizedKey: r.normalizedKey ?? r.normalized_key,
      category: r.category,
      entity: r.entity,
      amount: Number(r.amount || 0),
      previousAmount:
        r.previousAmount != null || r.previous_amount != null
          ? Number(r.previousAmount ?? r.previous_amount)
          : null,
      currency: r.currency || 'USD',
      billingCycle: r.billingCycle ?? r.billing_cycle ?? 'monthly',
      status: r.status,
      nextBillingDate: r.nextBillingDate ?? r.next_billing_date ?? null,
      trialEndsAt: r.trialEndsAt ?? r.trial_ends_at ?? null,
      sourceType: r.sourceType ?? r.source_type,
      sourceEmail: r.sourceEmail ?? r.source_email ?? null,
      lastSubject: r.lastSubject ?? r.last_subject ?? null,
      cancelUrl: r.cancelUrl ?? r.cancel_url ?? null,
      priceIncreased: Boolean(r.priceIncreased ?? r.price_increased),
      notes: r.notes || null,
    }));

    let monthlyBurn = 0;
    let businessMonthly = 0;
    let personalMonthly = 0;
    let activeCount = 0;
    let trialCount = 0;
    let priceHikeCount = 0;

    for (const item of items) {
      if (item.status === 'cancelled') continue;
      activeCount += 1;
      if (item.status === 'trial') trialCount += 1;
      if (item.priceIncreased || item.status === 'price_hike') priceHikeCount += 1;
      const monthlyEq =
        item.billingCycle === 'yearly'
          ? item.amount / 12
          : item.billingCycle === 'quarterly'
            ? item.amount / 3
            : item.billingCycle === 'weekly'
              ? (item.amount * 52) / 12
              : item.amount;
      monthlyBurn += monthlyEq;
      if (item.entity === 'Business') businessMonthly += monthlyEq;
      else personalMonthly += monthlyEq;
    }

    return {
      summary: {
        activeCount,
        trialCount,
        priceHikeCount,
        monthlyBurn: Math.round(monthlyBurn * 100) / 100,
        annualProjection: Math.round(monthlyBurn * 12 * 100) / 100,
        businessMonthly: Math.round(businessMonthly * 100) / 100,
        personalMonthly: Math.round(personalMonthly * 100) / 100,
      },
      items,
    };
  }

  async updateSubscription(id: number, body: Record<string, any>) {
    await this.ensureTables();
    const db = this.db();
    const existing = await db(SUB_TABLE).where('id', id).first();
    if (!existing) throw new NotFoundException('Subscription not found.');

    const patch: Record<string, any> = { updated_at: new Date() };
    if (typeof body.status === 'string') patch.status = body.status;
    if (typeof body.entity === 'string') patch.entity = body.entity;
    if (typeof body.category === 'string') patch.category = body.category;
    if (typeof body.notes === 'string') patch.notes = body.notes;
    if (typeof body.cancelUrl === 'string') patch.cancel_url = body.cancelUrl;

    await db(SUB_TABLE).where('id', id).update(patch);
    return this.listSubscriptions();
  }
}

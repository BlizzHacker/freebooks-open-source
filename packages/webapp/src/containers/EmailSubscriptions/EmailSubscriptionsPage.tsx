import {
  Button,
  Callout,
  Card,
  HTMLSelect,
  InputGroup,
  Intent,
  Spinner,
  Tag,
  TextArea,
} from '@blueprintjs/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { DashboardInsider } from '@/components';
import { DashboardPageContent } from '@/components/Dashboard/DashboardPageContent';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';

export function EmailSubscriptionsPage() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState('gmail');
  const [emailAddress, setEmailAddress] = useState('');
  const [authType, setAuthType] = useState('imap_app_password');
  const [secret, setSecret] = useState('');
  const [imapHost, setImapHost] = useState('imap.gmail.com');
  const [imapPort, setImapPort] = useState('993');
  const [rawEmailText, setRawEmailText] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const headers = {
    Authorization: 'Bearer ' + token,
    'organization-id': organizationId || '',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const inboxesQuery = useQuery({
    queryKey: ['email-subscriptions-inboxes'],
    enabled: Boolean(token && organizationId),
    queryFn: async () => {
      const res = await fetch('/api/email-subscriptions/inboxes', { headers });
      if (!res.ok) throw new Error('Failed to load connected inboxes.');
      return res.json();
    },
  });

  const subsQuery = useQuery({
    queryKey: ['email-subscriptions-list'],
    enabled: Boolean(token && organizationId),
    queryFn: async () => {
      const res = await fetch('/api/email-subscriptions', { headers });
      if (!res.ok) throw new Error('Failed to load subscriptions.');
      return res.json();
    },
  });

  const handleProviderChange = (next: string) => {
    setProvider(next);
    const defaultHosts: Record<string, string> = {
      gmail: 'imap.gmail.com',
      outlook: 'outlook.office365.com',
      hotmail: 'outlook.office365.com',
      yahoo: 'imap.mail.yahoo.com',
      icloud: 'imap.mail.me.com',
      proton: '127.0.0.1',
      fastmail: 'imap.fastmail.com',
      imap: '',
    };
    setImapHost(defaultHosts[next] ?? '');
    setImapPort(next === 'proton' ? '1143' : '993');
  };

  const connectInbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await fetch('/api/email-subscriptions/inboxes', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider,
          emailAddress,
          authType,
          imapHost,
          imapPort: Number(imapPort || 993),
          password: authType === 'imap_app_password' ? secret : undefined,
          accessToken: authType === 'oauth2' ? secret : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Could not connect inbox.');
      }
      setEmailAddress('');
      setSecret('');
      setStatusMsg('Inbox connected and encrypted with AES-256-GCM.');
      await queryClient.invalidateQueries({ queryKey: ['email-subscriptions-inboxes'] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failed.');
    } finally {
      setBusy(false);
    }
  };

  const scanInbox = async (id: number) => {
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/email-subscriptions/inboxes/${id}/scan`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      setStatusMsg(
        `Scanned ${data.scannedMessages || 0} messages; updated ${data.subscriptionsUpdated || 0} subscriptions.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['email-subscriptions-inboxes'] });
      await queryClient.invalidateQueries({ queryKey: ['email-subscriptions-list'] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Scan failed.');
    } finally {
      setBusy(false);
    }
  };

  const scanBankFeed = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/email-subscriptions/scan-bank', {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      setStatusMsg(
        `Scanned bank transactions and discovered ${data.discovered || 0} recurring subscriptions.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['email-subscriptions-list'] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Bank scan failed.');
    } finally {
      setBusy(false);
    }
  };

  const parseRawReceipts = async () => {
    if (!rawEmailText.trim()) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/email-subscriptions/parse-raw', {
        method: 'POST',
        headers,
        body: JSON.stringify({ rawText: rawEmailText }),
      });
      const data = await res.json();
      setStatusMsg(
        `Parsed ${data.parsedBlocks || 0} email block(s); detected ${data.subscriptionsDetected || 0} subscription(s).`,
      );
      setRawEmailText('');
      await queryClient.invalidateQueries({ queryKey: ['email-subscriptions-list'] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Receipt parse failed.');
    } finally {
      setBusy(false);
    }
  };

  const updateSubStatus = async (id: number, status: string) => {
    await fetch(`/api/email-subscriptions/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    await queryClient.invalidateQueries({ queryKey: ['email-subscriptions-list'] });
  };

  const summary = subsQuery.data?.summary || {
    activeCount: 0,
    trialCount: 0,
    priceHikeCount: 0,
    monthlyBurn: 0,
    annualProjection: 0,
    businessMonthly: 0,
    personalMonthly: 0,
  };
  const items = subsQuery.data?.items || [];
  const inboxes = inboxesQuery.data || [];

  return (
    <DashboardInsider name="email-subscriptions">
      <DashboardPageContent>
        <main className="freebooks-connections">
          <section className="freebooks-connections__hero">
            <div>
              <span className="freebooks-eyebrow">
                UNIVERSAL INBOX &amp; RECURRING SCANNER
              </span>
              <h2>Email &amp; Subscription Radar</h2>
              <p>
                Scan Gmail, Hotmail/Outlook, Yahoo, iCloud, ProtonMail Bridge,
                and any RFC 3501 IMAP inbox alongside your bank feeds to catch
                every subscription, free trial, and price increase.
              </p>
            </div>
            <Button
              intent={Intent.PRIMARY}
              large
              loading={busy}
              onClick={scanBankFeed}
            >
              Scan Bank Feeds for Subscriptions
            </Button>
          </section>

          {statusMsg && (
            <Callout intent={Intent.SUCCESS} style={{ marginTop: 18 }}>
              {statusMsg}
            </Callout>
          )}
          {errorMsg && (
            <Callout intent={Intent.DANGER} style={{ marginTop: 18 }}>
              {errorMsg}
            </Callout>
          )}

          <div
             className="freebooks-connections__grid"
            style={{ marginTop: 24 }}
          >
            <Card>
              <span className="freebooks-eyebrow">MONTHLY RECURRING BURN</span>
              <h3 style={{ fontSize: 28, margin: '8px 0' }}>
                ${Number(summary.monthlyBurn).toFixed(2)}/mo
              </h3>
              <p>
                Projected Annual: ${Number(summary.annualProjection).toFixed(2)}/yr
              </p>
            </Card>
            <Card>
              <span className="freebooks-eyebrow">BUSINESS VS PERSONAL</span>
              <h3 style={{ fontSize: 22, margin: '8px 0' }}>
                Business: ${Number(summary.businessMonthly).toFixed(2)}/mo
              </h3>
              <p>
                Personal Household: ${Number(summary.personalMonthly).toFixed(2)}/mo
              </p>
            </Card>
            <Card>
              <span className="freebooks-eyebrow">ALERTS &amp; TRIALS</span>
              <h3 style={{ fontSize: 22, margin: '8px 0' }}>
                {summary.activeCount} Active · {summary.trialCount} Trials
              </h3>
              <p>{summary.priceHikeCount} Price Hike(s) Flagged</p>
            </Card>
          </div>

          <section className="freebooks-connections__section">
            <div className="freebooks-section-heading">
              <div>
                <span className="freebooks-eyebrow">01 / CONNECT INBOXES</span>
                <h2>Connect Gmail, Hotmail/Outlook, or Universal IMAP</h2>
                <p>
                  Credentials are encrypted at rest with AES-256-GCM. Use OAuth2
                  tokens or provider App Passwords.
                </p>
              </div>
            </div>
            <div className="freebooks-connections__grid">
              <Card>
                <h3>Add Email Account</h3>
                <form onSubmit={connectInbox} style={{ display: 'grid', gap: 10 }}>
                  <label>
                    Provider
                    <HTMLSelect
                      fill
                      value={provider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      options={[
                        { value: 'gmail', label: 'Gmail / Google Workspace' },
                        { value: 'outlook', label: 'Outlook / Office 365' },
                        { value: 'hotmail', label: 'Hotmail / Live / MSN' },
                        { value: 'yahoo', label: 'Yahoo Mail / AOL' },
                        { value: 'icloud', label: 'Apple iCloud Mail' },
                        { value: 'proton', label: 'ProtonMail Bridge (Local)' },
                        { value: 'fastmail', label: 'Fastmail IMAP' },
                        { value: 'imap', label: 'Custom IMAP / Self-Hosted' },
                      ]}
                    />
                  </label>
                  <label>
                    Email Address
                    <InputGroup
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      placeholder="you@gmail.com or you@hotmail.com"
                      required
                    />
                  </label>
                  <label>
                    Authentication Method
                    <HTMLSelect
                      fill
                      value={authType}
                      onChange={(e) => setAuthType(e.target.value)}
                      options={[
                        {
                          value: 'imap_app_password',
                          label: 'IMAP App Password / Bridge Password',
                        },
                        {
                          value: 'oauth2',
                          label: 'OAuth2 Bearer Token (Gmail API / MS Graph)',
                        },
                      ]}
                    />
                  </label>
                  <label>
                    IMAP Host &amp; Port
                    <div style={{ display: 'flex', gap: 8 }}>
                      <InputGroup
                        fill
                        value={imapHost}
                        onChange={(e) => setImapHost(e.target.value)}
                        placeholder="imap.gmail.com"
                      />
                      <InputGroup
                        style={{ width: 90 }}
                        value={imapPort}
                        onChange={(e) => setImapPort(e.target.value)}
                        placeholder="993"
                      />
                    </div>
                  </label>
                  <label>
                    {authType === 'oauth2'
                      ? 'OAuth2 Access Token'
                      : 'App-Specific Password'}
                    <InputGroup
                      type="password"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      placeholder="xxxx xxxx xxxx xxxx"
                      required
                    />
                  </label>
                  <Button type="submit" intent={Intent.PRIMARY} loading={busy}>
                    Connect &amp; Save Inbox
                  </Button>
                </form>
              </Card>

              <Card>
                <h3>Connected Inboxes ({inboxes.length})</h3>
                {inboxesQuery.isLoading ? (
                  <Spinner size={24} />
                ) : inboxes.length === 0 ? (
                  <p>No inboxes connected yet. Add Gmail, Hotmail, or IMAP on the left.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {inboxes.map((ib: any) => (
                      <div
                        key={ib.id}
                        style={{
                          padding: 12,
                          border: '1px solid var(--fb-border)',
                          borderRadius: 10,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <strong>{ib.emailAddress}</strong>
                          <Tag intent={Intent.SUCCESS} minimal>
                            {ib.provider.toUpperCase()}
                          </Tag>
                        </div>
                        <small style={{ display: 'block', margin: '6px 0' }}>
                          Host: {ib.imapHost || 'REST API'}:{ib.imapPort} · Scanned:{' '}
                          {ib.lastScannedMessages} msgs
                        </small>
                        <Button
                          small
                          intent={Intent.PRIMARY}
                          loading={busy}
                          onClick={() => scanInbox(ib.id)}
                        >
                          Scan Now
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h3>Paste or Parse Raw .EML / .MBOX Receipt</h3>
                <p>
                  Paste raw email headers/body or forwarded billing receipts to
                  extract recurring charges offline.
                </p>
                <TextArea
                  fill
                  rows={5}
                  value={rawEmailText}
                  onChange={(e) => setRawEmailText(e.target.value)}
                  placeholder={
                    'From: OpenAI <noreply@tm.openai.com>\nSubject: Your ChatGPT Plus subscription receipt\nAmount charged: $20.00 monthly'
                  }
                />
                <Button
                  style={{ marginTop: 10 }}
                  intent={Intent.PRIMARY}
                  onClick={parseRawReceipts}
                  loading={busy}
                >
                  Extract Subscriptions
                </Button>
              </Card>
            </div>
          </section>

          <section className="freebooks-connections__section">
            <div className="freebooks-section-heading">
              <div>
                <span className="freebooks-eyebrow">02 / DETECTED RECURRING</span>
                <h2>Active Subscriptions, Trials &amp; Bills ({items.length})</h2>
              </div>
            </div>
            {subsQuery.isLoading ? (
              <Spinner size={28} />
            ) : items.length === 0 ? (
              <Card>
                No subscriptions detected yet. Click &ldquo;Scan Bank Feeds for
                Subscriptions&rdquo; or connect an inbox above.
              </Card>
            ) : (
              <div className="freebooks-connections__grid">
                {items.map((sub: any) => (
                  <Card key={sub.id}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div>
                        <h3 style={{ margin: 0 }}>{sub.merchantName}</h3>
                        <small>{sub.category}</small>
                      </div>
                      <Tag
                        intent={
                          sub.status === 'price_hike'
                            ? Intent.DANGER
                            : sub.status === 'trial'
                              ? Intent.WARNING
                              : sub.status === 'cancelled'
                                ? Intent.NONE
                                : Intent.SUCCESS
                        }
                      >
                        {sub.status.toUpperCase()}
                      </Tag>
                    </div>
                    <div style={{ margin: '14px 0' }}>
                      <strong style={{ fontSize: 22 }}>
                        ${Number(sub.amount).toFixed(2)}
                      </strong>{' '}
                      <span>/ {sub.billingCycle}</span>
                      {sub.previousAmount && (
                        <div style={{ color: '#c23030', fontSize: 12 }}>
                          Increased from ${Number(sub.previousAmount).toFixed(2)}
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: 12, margin: '4px 0 12px' }}>
                      Entity: <strong>{sub.entity}</strong> · Next renewal:{' '}
                      {sub.nextBillingDate || 'TBD'}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {sub.cancelUrl && (
                        <a
                          className="bp4-button bp4-small bp4-intent-warning"
                          href={sub.cancelUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Manage / Cancel ↗
                        </a>
                      )}
                      {sub.status !== 'cancelled' ? (
                        <Button
                          small
                           onClick={() => updateSubStatus(sub.id, 'cancelled')}
                        >
                          Mark Cancelled
                        </Button>
                      ) : (
                        <Button
                          small
                          onClick={() => updateSubStatus(sub.id, 'active')}
                        >
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </main>
      </DashboardPageContent>
    </DashboardInsider>
  );
}

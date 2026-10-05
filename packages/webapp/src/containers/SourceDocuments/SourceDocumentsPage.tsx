import {
  Button,
  Callout,
  Card,
  HTMLSelect,
  InputGroup,
  Intent,
  Spinner,
  Tag,
} from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useRef, useState } from 'react';
import { DashboardInsider } from '@/components';
import { DashboardPageContent } from '@/components/Dashboard/DashboardPageContent';
import { useAccounts } from '@/hooks/query';
import { useAuthOrganizationId, useAuthToken } from '@/hooks/state';
import { downloadFile } from '@/hooks/useDownloadFile';
import { transformToCamelCase } from '@/utils';
import { AccountEvidenceLinker } from './AccountEvidenceLinker';
import type { EvidenceAccount } from './evidenceSuggestions';

interface VaultDocumentLink {
  modelRef: string;
  modelId: number;
}
interface VaultDocument {
  id: number;
  filename: string;
  mimeType: string;
  size: number;
  sourceType?: string;
  sourceName?: string;
  documentDate?: string;
  sha256?: string;
  createdAt?: string;
  reviewStatus: 'linked' | 'needs_review';
  links: VaultDocumentLink[];
}
interface VaultListResponse {
  data: VaultDocument[];
  pagination: { total: number; page: number; pageSize: number };
}
interface Filters {
  q: string;
  sourceType: string;
  sourceName: string;
  status: string;
  documentFrom: string;
  documentTo: string;
  page: number;
  pageSize: number;
}
const emptyFilters: Filters = {
  q: '',
  sourceType: '',
  sourceName: '',
  status: '',
  documentFrom: '',
  documentTo: '',
  page: 1,
  pageSize: 25,
};

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function formatDate(value?: string) {
  if (!value) return 'Date not provided';
  const isoCalendarDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = isoCalendarDate
    ? new Date(
        Number(isoCalendarDate[1]),
        Number(isoCalendarDate[2]) - 1,
        Number(isoCalendarDate[3]),
      )
    : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function SourceDocumentsPage() {
  const token = useAuthToken();
  const organizationId = useAuthOrganizationId();
  const accountIdFromUrl = new URLSearchParams(window.location.search).get(
    'account_id',
  );
  const evidenceAccountId =
    accountIdFromUrl && /^[1-9]\d*$/.test(accountIdFromUrl)
      ? accountIdFromUrl
      : null;
  const captureRequested =
    new URLSearchParams(window.location.search).get('capture') === '1';
  const [filters, setFilters] = useState(emptyFilters);
  const [queryDraft, setQueryDraft] = useState('');
  const [sourceDraft, setSourceDraft] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState('');
  const [pendingReceipt, setPendingReceipt] = useState<File | null>(null);
  const [pendingSourceName, setPendingSourceName] = useState('');
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(
    null,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: accounts = [] } = useAccounts({
    structure: 'flat',
    pageSize: 1000,
  });

  React.useEffect(() => {
    if (!captureRequested) return;
    window.requestAnimationFrame(() => {
      document.getElementById('source-documents-camera-action')?.focus();
    });
  }, [captureRequested]);

  React.useEffect(() => {
    if (!pendingReceipt || !pendingReceipt.type.startsWith('image/')) {
      setReceiptPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(pendingReceipt);
    setReceiptPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pendingReceipt]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({
        ...current,
        q: queryDraft.trim(),
        sourceName: sourceDraft.trim(),
        page: 1,
      }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [queryDraft, sourceDraft]);

  const params = useMemo(() => {
    const query = new URLSearchParams();
    if (filters.q) query.set('q', filters.q);
    if (evidenceAccountId) {
      query.set('model_ref', 'Account');
      query.set('model_id', evidenceAccountId);
    }
    if (filters.sourceType) query.set('source_type', filters.sourceType);
    if (filters.sourceName) query.set('source_name', filters.sourceName);
    if (filters.status) query.set('status', filters.status);
    if (filters.documentFrom) query.set('document_from', filters.documentFrom);
    if (filters.documentTo) query.set('document_to', filters.documentTo);
    query.set('page', String(filters.page));
    query.set('page_size', String(filters.pageSize));
    return query.toString();
  }, [filters, evidenceAccountId]);

  const documentsQuery = useQuery({
    queryKey: ['source-document-vault', params],
    enabled: Boolean(token && organizationId),
    queryFn: async (): Promise<VaultListResponse> => {
      const response = await fetch('/api/attachments/vault?' + params, {
        headers: {
          Authorization: 'Bearer ' + token,
          'organization-id': organizationId!,
          Accept: 'application/json',
        },
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Could not load source documents.');
      return transformToCamelCase(await response.json()) as VaultListResponse;
    },
  });

  const updateFilters = (patch: Partial<Filters>) =>
    setFilters((current) => ({ ...current, ...patch, page: 1 }));

  const handleDownload = async (document: VaultDocument) => {
    if (!token || !organizationId) return;
    setDownloadingId(document.id);
    try {
      const response = await fetch(
        '/api/attachments/vault/' + document.id + '/download',
        {
          headers: {
            Authorization: 'Bearer ' + token,
            'organization-id': organizationId,
          },
          credentials: 'same-origin',
        },
      );
      if (!response.ok) throw new Error('Download failed.');
      const blob = await response.blob();
      downloadFile(blob, document.filename, document.mimeType);
    } catch {
      window.alert(
        'The source document could not be downloaded. Please retry.',
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const stageReceipt = (file: File | undefined, sourceName: string) => {
    if (!file) return;
    const allowedTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf',
    ]);
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = new Set([
      'jpg',
      'jpeg',
      'png',
      'webp',
      'heic',
      'heif',
      'pdf',
    ]);
    const typeIsKnown = allowedTypes.has(file.type);
    const typeIsUnspecified =
      file.type === '' || file.type === 'application/octet-stream';
    if (
      !extension ||
      !allowedExtensions.has(extension) ||
      (!typeIsKnown && !typeIsUnspecified)
    ) {
      setReceiptMessage('Choose a JPG, PNG, WebP, HEIC, HEIF, or PDF receipt.');
      return;
    }
    if (file.size === 0 || file.size > 25 * 1024 * 1024) {
      setReceiptMessage('The receipt must be between 1 byte and 25 MB.');
      return;
    }
    setPendingReceipt(file);
    setPendingSourceName(sourceName);
    setReceiptMessage('');
  };

  const handleReceiptFile = async () => {
    const file = pendingReceipt;
    if (!file || !token || !organizationId) return;
    setReceiptUploading(true);
    setReceiptMessage('');
    try {
      const bytes = await file.arrayBuffer();
      const digest = await window.crypto.subtle.digest('SHA-256', bytes);
      const sha256 = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      const body = new FormData();
      body.append('file', file);
      body.append('sourceType', 'receipt');
      body.append('sourceName', pendingSourceName.trim() || 'Receipt upload');
      body.append('sha256', sha256);
      const response = await fetch('/api/attachments/vault/receipt', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'organization-id': organizationId,
        },
        body,
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('The receipt could not be saved.');
      setPendingReceipt(null);
      setPendingSourceName('');
      setReceiptMessage(
        'Receipt saved privately. Review and link it to the matching expense or transaction.',
      );
      setFilters((current) => ({ ...current, sourceType: 'receipt', page: 1 }));
      await documentsQuery.refetch();
    } catch {
      setReceiptMessage('The receipt could not be saved. Please retry.');
    } finally {
      setReceiptUploading(false);
    }
  };

  const documents = documentsQuery.data?.data ?? [];
  const pagination = documentsQuery.data?.pagination;
  const activeFilterCount = [
    sourceDraft.trim(),
    filters.sourceType,
    filters.status,
    filters.documentFrom,
    filters.documentTo,
  ].filter(Boolean).length;
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;
  const accountNameById = useMemo(() => {
    const names = new Map<number, string>();
    (accounts as any[]).forEach((account) => {
      const id = Number(account.accountId ?? account.id);
      if (Number.isFinite(id))
        names.set(id, account.name || account.accountName || 'Account ' + id);
    });
    return names;
  }, [accounts]);
  const evidenceAccounts = useMemo<EvidenceAccount[]>(
    () =>
      (accounts as any[])
        .map((account) => ({
          id: Number(account.accountId ?? account.id),
          name: String(account.name || account.accountName || ''),
          accountType: String(account.accountType || ''),
          accountMask: account.accountMask || null,
        }))
        .filter(
          (account) =>
            Number.isSafeInteger(account.id) && account.id > 0 && account.name,
        ),
    [accounts],
  );

  return (
    <DashboardInsider name="source-documents">
      <DashboardPageContent>
        <main className="source-documents-page">
          <header className="source-documents-page__header">
            <div>
              <span className="source-documents-page__eyebrow">
                Private records
              </span>
              <h1>Source Documents</h1>
              <p>
                Search and review statements, receipts, and files in your
                financial audit trail.
              </p>
            </div>
            <Tag intent={Intent.PRIMARY} minimal>
              Authenticated downloads
            </Tag>
          </header>

          <Card className="source-documents-page__receipt-upload">
            <div className="source-documents-page__receipt-intro">
              <span className="source-documents-page__eyebrow">
                Scan from your phone
              </span>
              <h2>Add a receipt</h2>
              <p>
                Photograph a receipt or choose a saved image or PDF. Review it
                here before saving it to your private documents.
              </p>
              {captureRequested && (
                <p className="source-documents-page__capture-hint">
                  Tap Take photo to open your camera.
                </p>
              )}
            </div>
            <div className="source-documents-page__receipt-actions">
              <input
                ref={cameraInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                hidden
                aria-label="Take a receipt photo"
                onChange={(event) => {
                  stageReceipt(event.currentTarget.files?.[0], 'Mobile camera');
                  event.currentTarget.value = '';
                }}
              />
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf"
                hidden
                aria-label="Choose a receipt file"
                onChange={(event) => {
                  stageReceipt(
                    event.currentTarget.files?.[0],
                    'Receipt upload',
                  );
                  event.currentTarget.value = '';
                }}
              />
              <Button
                id="source-documents-camera-action"
                icon="camera"
                intent={Intent.PRIMARY}
                large
                disabled={receiptUploading}
                onClick={() => cameraInput.current?.click()}
              >
                Take photo
              </Button>
              <Button
                icon="upload"
                large
                disabled={receiptUploading}
                onClick={() => fileInput.current?.click()}
              >
                Choose file
              </Button>
            </div>
            {pendingReceipt && (
              <div className="source-documents-page__receipt-review">
                <div className="source-documents-page__receipt-preview">
                  {receiptPreviewUrl ? (
                    <img src={receiptPreviewUrl} alt="Receipt to upload" />
                  ) : (
                    <span>
                      {pendingReceipt.type === 'application/pdf'
                        ? 'PDF'
                        : 'FILE'}
                    </span>
                  )}
                </div>
                <div className="source-documents-page__receipt-review-details">
                  <strong>Ready to save</strong>
                  <span className="source-documents-page__receipt-filename">
                    {pendingReceipt.name}
                  </span>
                  <small>{formatSize(pendingReceipt.size)} · 25 MB limit</small>
                  <label htmlFor="receipt-source-name">
                    Source or merchant
                  </label>
                  <input
                    id="receipt-source-name"
                    type="text"
                    maxLength={120}
                    value={pendingSourceName}
                    onChange={(event) =>
                      setPendingSourceName(event.currentTarget.value)
                    }
                    disabled={receiptUploading}
                  />
                  <div className="source-documents-page__receipt-review-actions">
                    <Button
                      intent={Intent.PRIMARY}
                      icon="cloud-upload"
                      loading={receiptUploading}
                      onClick={() => void handleReceiptFile()}
                    >
                      Save privately
                    </Button>
                    <Button
                      minimal
                      disabled={receiptUploading}
                      onClick={() => {
                        setPendingReceipt(null);
                        setReceiptMessage('');
                      }}
                    >
                      Discard
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {receiptMessage && (
              <p
                role="status"
                className="source-documents-page__receipt-message"
              >
                {receiptMessage}
              </p>
            )}
          </Card>

          <Callout
            className="source-documents-page__privacy"
            icon="lock"
            intent={Intent.PRIMARY}
            title="Documents stay private to this account"
          >
            Files are listed through FreeBooks and downloaded through the
            authenticated API. Direct object-storage links are not exposed.
          </Callout>

          {evidenceAccountId && (
            <Callout intent={Intent.PRIMARY} title="Account evidence">
              Showing documents linked to account #{evidenceAccountId}.{' '}
              <Button
                minimal
                onClick={() => window.location.assign('/source-documents')}
              >
                Show all documents
              </Button>
            </Callout>
          )}

          <Card className="source-documents-page__filters">
            <div className="source-documents-page__quick-search">
              <InputGroup
                leftIcon="search"
                placeholder="Search documents"
                value={queryDraft}
                onChange={(event) => setQueryDraft(event.currentTarget.value)}
                aria-label="Search source documents"
              />
              <Button
                icon="filter"
                active={filtersOpen}
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                aria-controls="source-document-advanced-filters"
              >
                Filters{activeFilterCount ? ' (' + activeFilterCount + ')' : ''}
              </Button>
            </div>
            <div
              id="source-document-advanced-filters"
              className={
                'source-documents-page__advanced-filters' +
                (filtersOpen ? ' is-open' : '')
              }
            >
              <div className="source-documents-page__search-row">
                <InputGroup
                  placeholder="Source name"
                  value={sourceDraft}
                  onChange={(event) =>
                    setSourceDraft(event.currentTarget.value)
                  }
                  aria-label="Filter by source name"
                />
                <InputGroup
                  placeholder="Source type"
                  value={filters.sourceType}
                  onChange={(event) =>
                    updateFilters({ sourceType: event.currentTarget.value })
                  }
                  aria-label="Filter by source type"
                />
                <HTMLSelect
                  value={filters.status}
                  onChange={(event) =>
                    updateFilters({ status: event.currentTarget.value })
                  }
                  aria-label="Filter by link status"
                >
                  <option value="">All link statuses</option>
                  <option value="unlinked">Needs review</option>
                  <option value="linked">Linked to a record</option>
                </HTMLSelect>
              </div>
              <div className="source-documents-page__filter-row">
                <label>
                  Document date from
                  <input
                    type="date"
                    value={filters.documentFrom}
                    onChange={(event) =>
                      updateFilters({ documentFrom: event.currentTarget.value })
                    }
                  />
                </label>
                <label>
                  to
                  <input
                    type="date"
                    value={filters.documentTo}
                    onChange={(event) =>
                      updateFilters({ documentTo: event.currentTarget.value })
                    }
                  />
                </label>
                <label>
                  Page size
                  <HTMLSelect
                    value={filters.pageSize}
                    onChange={(event) =>
                      updateFilters({
                        pageSize: Number(event.currentTarget.value),
                      })
                    }
                  >
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </HTMLSelect>
                </label>
                <Button
                  minimal
                  icon="reset"
                  onClick={() => {
                    if (evidenceAccountId) {
                      window.location.assign('/source-documents');
                      return;
                    }
                    setFilters(emptyFilters);
                    setQueryDraft('');
                    setSourceDraft('');
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          </Card>

          {documentsQuery.isLoading ? (
            <div className="source-documents-page__loading">
              <Spinner size={32} />
              <span>Loading private documents…</span>
            </div>
          ) : documentsQuery.isError ? (
            <Callout intent={Intent.DANGER} title="Documents could not load">
              {documentsQuery.error.message}
              <Button
                minimal
                onClick={() => documentsQuery.refetch()}
                style={{ marginLeft: 8 }}
              >
                Retry
              </Button>
            </Callout>
          ) : documents.length === 0 ? (
            <Card className="source-documents-page__empty">
              <h2>No source documents found</h2>
              <p>
                Adjust the filters or import statements and receipts to build
                your private audit trail.
              </p>
            </Card>
          ) : (
            <div className="source-documents-page__list">
              {documents.map((document) => (
                <Card key={document.id} className="source-document-card">
                  <div className="source-document-card__main">
                    <div
                      className="source-document-card__icon"
                      aria-hidden="true"
                    >
                      {document.mimeType === 'application/pdf' ? 'PDF' : 'FILE'}
                    </div>
                    <div className="source-document-card__details">
                      <h2 title={document.filename}>{document.filename}</h2>
                      <p className="source-document-card__metadata">
                        <span>{document.sourceName || 'Unknown source'}</span>
                        {document.sourceType && (
                          <span>{document.sourceType}</span>
                        )}
                        <span>{formatDate(document.documentDate)}</span>
                        <span>{formatSize(document.size)}</span>
                      </p>
                      {document.sha256 && (
                        <small title={document.sha256}>
                          SHA-256 / {document.sha256.slice(0, 16)}...
                        </small>
                      )}
                    </div>
                    <Tag
                      intent={
                        document.reviewStatus === 'linked'
                          ? Intent.SUCCESS
                          : Intent.WARNING
                      }
                    >
                      {document.reviewStatus === 'linked'
                        ? 'Linked'
                        : 'Needs review'}
                    </Tag>
                    <Button
                      icon="download"
                      intent={Intent.PRIMARY}
                      loading={downloadingId === document.id}
                      disabled={
                        downloadingId !== null && downloadingId !== document.id
                      }
                      onClick={() => handleDownload(document)}
                      aria-label={'Download ' + document.filename}
                    >
                      Download
                    </Button>
                  </div>
                  <div className="source-document-card__links">
                    <strong>Linked records</strong>
                    {document.links?.length ? (
                      document.links.map((link) => {
                        const accountName = /account|cashflow|bank/i.test(
                          link.modelRef,
                        )
                          ? accountNameById.get(Number(link.modelId))
                          : undefined;
                        return (
                          <Tag key={link.modelRef + '-' + link.modelId} minimal>
                            {accountName || link.modelRef + ' #' + link.modelId}
                          </Tag>
                        );
                      })
                    ) : (
                      <span>Not linked yet</span>
                    )}
                  </div>
                  <AccountEvidenceLinker
                    document={document}
                    accounts={evidenceAccounts}
                    token={token}
                    organizationId={organizationId}
                    onLinked={() => documentsQuery.refetch()}
                  />
                </Card>
              ))}
            </div>
          )}

          {pagination && (
            <footer className="source-documents-page__pagination">
              <span>
                {pagination.total.toLocaleString()} documents / page{' '}
                {pagination.page} of {totalPages}
              </span>
              <div>
                <Button
                  minimal
                  icon="chevron-left"
                  disabled={filters.page <= 1}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: current.page - 1,
                    }))
                  }
                >
                  Previous
                </Button>
                <Button
                  minimal
                  rightIcon="chevron-right"
                  disabled={filters.page >= totalPages}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: current.page + 1,
                    }))
                  }
                >
                  Next
                </Button>
              </div>
            </footer>
          )}
        </main>
      </DashboardPageContent>
    </DashboardInsider>
  );
}

import { Button, HTMLSelect } from '@blueprintjs/core';
import React, { useMemo, useState } from 'react';
import {
  EvidenceAccount,
  EvidenceDocument,
  suggestEvidenceAccounts,
} from './evidenceSuggestions';
import './SourceDocumentEvidence.scss';

interface AccountEvidenceLinkerProps {
  document: EvidenceDocument & {
    id: number;
    mimeType: string;
    links: Array<{ modelRef: string; modelId: number }>;
  };
  accounts: EvidenceAccount[];
  token?: string | null;
  organizationId?: string | null;
  onLinked: () => Promise<unknown>;
}

export function AccountEvidenceLinker({
  document,
  accounts,
  token,
  organizationId,
  onLinked,
}: AccountEvidenceLinkerProps) {
  const [selectedId, setSelectedId] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [message, setMessage] = useState('');

  const eligibleAccounts = useMemo(
    () =>
      accounts
        .filter((account) =>
          ['bank', 'credit-card', 'long-term-liability'].includes(
            account.accountType,
          ),
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    [accounts],
  );
  const suggestions = useMemo(
    () => suggestEvidenceAccounts(document, eligibleAccounts),
    [document, eligibleAccounts],
  );
  const suggestedIds = new Set(suggestions.map((account) => account.id));
  const remainingAccounts = eligibleAccounts.filter(
    (account) => !suggestedIds.has(account.id),
  );

  if (
    document.mimeType !== 'application/pdf' ||
    document.links?.some((link) => link.modelRef === 'Account')
  ) {
    return null;
  }

  const linkAccount = async () => {
    const accountId = Number(selectedId);
    if (
      !token ||
      !organizationId ||
      !Number.isSafeInteger(accountId) ||
      accountId < 1
    ) {
      return;
    }
    setIsLinking(true);
    setMessage('');
    try {
      const response = await fetch(
        '/api/attachments/vault/' + document.id + '/link',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'organization-id': organizationId,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({ modelRef: 'Account', modelId: accountId }),
        },
      );
      if (!response.ok) throw new Error('Account link failed.');
      await onLinked();
      setSelectedId('');
      setMessage(
        'Account link saved. Confirm transactions and statement dates separately.',
      );
    } catch {
      setMessage('The account link could not be saved. Please retry.');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="freebooks-evidence-linker">
      <div>
        <strong>Match this statement to an account</strong>
        <p>
          Suggestions use the filename and source label only. Open the PDF and
          verify the account before linking. This does not import or reconcile
          transactions.
        </p>
      </div>
      {eligibleAccounts.length === 0 ? (
        <p>Add a bank, card, or loan account before linking this statement.</p>
      ) : (
        <div className="freebooks-evidence-linker__controls">
          <HTMLSelect
            value={selectedId}
            onChange={(event) => setSelectedId(event.currentTarget.value)}
            aria-label={'Choose account for ' + document.filename}
          >
            <option value="">Choose a verified account</option>
            {suggestions.length > 0 && (
              <optgroup label="Possible matches from file details">
                {suggestions.map((account) => (
                  <option value={account.id} key={account.id}>
                    {account.name}
                    {account.accountMask
                      ? ' · ending ' + account.accountMask
                      : ''}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Other accounts">
              {remainingAccounts.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.name}
                  {account.accountMask
                    ? ' · ending ' + account.accountMask
                    : ''}
                </option>
              ))}
            </optgroup>
          </HTMLSelect>
          <Button
            icon="link"
            disabled={!selectedId || !token || !organizationId}
            loading={isLinking}
            onClick={linkAccount}
          >
            Link after review
          </Button>
        </div>
      )}
      {message && (
        <p className="freebooks-evidence-linker__message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

import { FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { transformToCamelCase } from '@/utils';

export interface ReviewPolicy {
  personalBranchId: number | null;
  businessBranchId: number | null;
  w2BranchId: number | null;
  enabled: boolean;
  businessName: string;
  defaultUnknownToPersonal: boolean;
  reviewThreshold: number;
}

export function ReviewPolicySettings({
  policy,
  token,
  organizationId,
  onSaved,
}: {
  policy?: ReviewPolicy;
  token: string | null | undefined;
  organizationId: string | null | undefined;
  onSaved: () => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<ReviewPolicy | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (policy) setDraft(policy);
  }, [policy]);
  const branches = useQuery({
    queryKey: ['review-policy-branches', organizationId],
    enabled: Boolean(token && organizationId),
    queryFn: async (): Promise<Array<{ id: number; name: string }>> => {
      const response = await fetch('/api/branches', {
        credentials: 'same-origin',
        headers: {
          Authorization: 'Bearer ' + token,
          'organization-id': organizationId!,
        },
      });
      if (!response.ok)
        throw new Error('Workspace assignments could not load.');
      return transformToCamelCase(await response.json()) as Array<{
        id: number;
        name: string;
      }>;
    },
  });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || !token || !organizationId) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(
        '/api/financial-review/auto-organize/policy',
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: {
            Authorization: 'Bearer ' + token,
            'organization-id': organizationId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(draft),
        },
      );
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(
          typeof failure.message === 'string'
            ? failure.message
            : 'Rules could not be saved. Check the assignments.',
        );
      }
      await onSaved();
      setMessage(
        'Rules saved. Automatic labels refresh using these assignments. Your reviewed labels are preserved.',
      );
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : 'Please retry.');
    } finally {
      setSaving(false);
    }
  };
  const assignment = (
    key: 'personalBranchId' | 'businessBranchId' | 'w2BranchId',
    label: string,
  ) => (
    <label key={key}>
      {label}
      <select
        value={draft?.[key] ?? ''}
        onChange={(event) =>
          setDraft(
            draft
              ? {
                  ...draft,
                  [key]: event.target.value ? Number(event.target.value) : null,
                }
              : null,
          )
        }
      >
        <option value="">Choose workspace branch</option>
        {branches.data?.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <details className="financial-review-page__policy" open={!policy?.enabled}>
      <summary>
        Automatic organization settings{' '}
        {policy?.enabled ? '· enabled' : '· setup required'}
      </summary>
      {!draft ? (
        <p>Loading your settings…</p>
      ) : (
        <form onSubmit={save}>
          <p>
            Choose your own assignments. Branch labels organize records inside
            one set of books; separate legal entities should use separate
            organizations.
          </p>
          <label className="financial-review-page__policy-check">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) =>
                setDraft({ ...draft, enabled: event.target.checked })
              }
            />
            Enable household food and business technology rules
          </label>
          <div className="financial-review-page__policy-grid">
            <label>
              Business display name
              <input
                maxLength={80}
                required
                value={draft.businessName}
                onChange={(event) =>
                  setDraft({ ...draft, businessName: event.target.value })
                }
              />
            </label>
            <label>
              Review amounts over
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={draft.reviewThreshold}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    reviewThreshold: Number(event.target.value),
                  })
                }
              />
            </label>
            {assignment('personalBranchId', 'Household / personal')}
            {assignment('businessBranchId', 'Business')}
            {assignment('w2BranchId', 'Employment income (optional)')}
          </div>
          <label className="financial-review-page__policy-check">
            <input
              type="checkbox"
              checked={draft.defaultUnknownToPersonal}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  defaultUnknownToPersonal: event.target.checked,
                })
              }
            />
            Provisionally label other small purchases as personal until evidence
            refines them
          </label>
          {branches.isError && (
            <p role="alert">
              Workspace branches could not load. Retry the page.
            </p>
          )}
          <p>
            Mixed stores await receipts; transfers and unexplained deposits
            await evidence. Automatic labels remain advisory.
          </p>
          <div className="financial-review-page__item-actions">
            <button disabled={saving} type="submit">
              {saving ? 'Saving…' : 'Save my rules'}
            </button>{' '}
            <Link to="/preferences/branches">Manage branches</Link>
          </div>
          {message && <p role="status">{message}</p>}
        </form>
      )}
    </details>
  );
}

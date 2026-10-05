export interface EvidenceAccount {
  id: number;
  name: string;
  accountType: string;
  accountMask?: string | null;
}

export interface EvidenceDocument {
  filename: string;
  sourceName?: string;
}

const eligibleTypes = new Set(['bank', 'credit-card', 'long-term-liability']);

const ignoredWords = new Set([
  'account',
  'bank',
  'card',
  'credit',
  'statement',
  'document',
  'pdf',
  'monthly',
]);

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function words(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
    (word) => word.length > 2 && !ignoredWords.has(word),
  );
}

/**
 * These are ordering hints from visible metadata, never verified matches.
 * The document contents, account numbers, dates, and amounts still need review.
 */
export function suggestEvidenceAccounts(
  document: EvidenceDocument,
  accounts: EvidenceAccount[],
): EvidenceAccount[] {
  const metadata = (
    document.filename +
    ' ' +
    (document.sourceName || '')
  ).toLowerCase();
  const metadataWords = new Set(words(metadata));
  const compactMetadata = compact(metadata);

  return accounts
    .filter((account) => eligibleTypes.has(account.accountType))
    .map((account) => {
      const accountWords = words(account.name);
      const matchingWords = accountWords.filter((word) =>
        metadataWords.has(word),
      );
      const accountCompact = compact(account.name);
      const institutionCompact = compact(accountWords.slice(0, 2).join(''));
      const condensedNameMatch =
        accountCompact.length >= 8 && compactMetadata.includes(accountCompact);
      const condensedInstitutionMatch =
        institutionCompact.length >= 7 &&
        compactMetadata.includes(institutionCompact);
      const mask = account.accountMask?.trim();
      // A bare four-digit year is not evidence of an account mask.
      const hasLabeledMask =
        !!mask &&
        /^[0-9]{4}$/.test(mask) &&
        new RegExp(
          '(?:ending|ends? in|account|acct|a/c|x{2,}|\\*{2,})\\s*[#:\\-]?\\s*' +
            mask +
            '(?![0-9])',
        ).test(metadata);
      const score =
        Math.max(
          matchingWords.length,
          condensedNameMatch ? 3 : 0,
          condensedInstitutionMatch ? 2 : 0,
        ) + (hasLabeledMask ? 4 : 0);
      return { account, score };
    })
    .filter(({ score }) => score >= 2)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.account.name.localeCompare(right.account.name),
    )
    .slice(0, 5)
    .map(({ account }) => account);
}

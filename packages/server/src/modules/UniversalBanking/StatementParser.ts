import { createHash } from 'node:crypto';

export interface NormalizedBankTransaction {
  externalId: string;
  date: string; // YYYY-MM-DD
  amount: number; // positive = deposit/inflow, negative = outflow/charge
  payee: string;
  description: string;
  category?: string;
}

function normalizeDateString(raw: string): string {
  const clean = (raw || '').trim();
  // OFX format: YYYYMMDD or YYYYMMDDHHMMSS
  const ofxMatch = clean.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofxMatch) {
    return `${ofxMatch[1]}-${ofxMatch[2]}-${ofxMatch[3]}`;
  }
  // MM/DD/YYYY or MM/DD/YY
  const usMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (usMatch) {
    const year =
      usMatch[3].length === 2 ? `20${usMatch[3]}` : usMatch[3];
    return `${year}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  }
  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export function parseOfxOrQfx(content: string): NormalizedBankTransaction[] {
  const results: NormalizedBankTransaction[] = [];
  const blocks = content.split(/<STMTTRN>/i).slice(1);
  for (const block of blocks) {
    const endIdx = block.search(/<\/STMTTRN>/i);
    const segment = endIdx !== -1 ? block.slice(0, endIdx) : block;
    const tag = (name: string) => {
      const m = segment.match(new RegExp(`<${name}>([^<\\r\\n]+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const dtPosted = tag('DTPOSTED');
    const trnAmt = Number(tag('TRNAMT').replace(/,/g, ''));
    if (!Number.isFinite(trnAmt)) continue;
    const name = tag('NAME') || tag('PAYEE') || 'Bank Transaction';
    const memo = tag('MEMO') || tag('TRNTYPE') || '';
    const date = normalizeDateString(dtPosted);
    const fitId =
      tag('FITID') ||
      createHash('sha256')
        .update(`${date}|${trnAmt}|${name}|${memo}`)
        .digest('hex')
        .slice(0, 24);
    results.push({
      externalId: fitId,
      date,
      amount: trnAmt,
      payee: name,
      description: memo ? `${name} - ${memo}` : name,
    });
  }
  return results;
}

export function parseQif(content: string): NormalizedBankTransaction[] {
  const results: NormalizedBankTransaction[] = [];
  const records = content.split(/^\^/m);
  for (const rec of records) {
    const lines = rec.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let dateRaw = '';
    let amountRaw = '';
    let payee = '';
    let memo = '';
    for (const line of lines) {
      const code = line[0];
      const val = line.slice(1).trim();
      if (code === 'D') dateRaw = val;
      else if (code === 'T' || code === 'U') amountRaw = val;
      else if (code === 'P') payee = val;
      else if (code === 'M') memo = val;
    }
    const amount = Number(amountRaw.replace(/,/g, ''));
    if (!dateRaw || !Number.isFinite(amount)) continue;
    const date = normalizeDateString(dateRaw);
    const externalId = createHash('sha256')
      .update(`qif|${date}|${amount}|${payee}|${memo}`)
      .digest('hex')
      .slice(0, 24);
    results.push({
      externalId,
      date,
      amount,
      payee: payee || memo || 'QIF Transaction',
      description: [payee, memo].filter(Boolean).join(' - '),
    });
  }
  return results;
}

export function parseCamt053Xml(content: string): NormalizedBankTransaction[] {
  const results: NormalizedBankTransaction[] = [];
  const entries = content.split(/<Ntry>/i).slice(1);
  for (const rawEntry of entries) {
    const entry = rawEntry.split(/<\/Ntry>/i)[0] || rawEntry;
    const amtMatch = entry.match(/<Amt[^>]*>([\d.,]+)<\/Amt>/i);
    const indMatch = entry.match(/<CdtDbtInd>(CRDT|DBIT)<\/CdtDbtInd>/i);
    const dtMatch = entry.match(/<(?:BookgDt|ValDt)>[\s\S]*?<Dt>([^<]+)<\/Dt>/i);
    const infoMatch = entry.match(/<Ustrd>([^<]+)<\/Ustrd>/i);
    if (!amtMatch) continue;
    const rawNum = Number(amtMatch[1].replace(/,/g, ''));
    if (!Number.isFinite(rawNum)) continue;
    const isDebit = indMatch && indMatch[1].toUpperCase() === 'DBIT';
    const amount = isDebit ? -Math.abs(rawNum) : Math.abs(rawNum);
    const date = normalizeDateString(dtMatch ? dtMatch[1] : '');
    const desc = infoMatch ? infoMatch[1].trim() : 'ISO 20022 Entry';
    const externalId = createHash('sha256')
      .update(`camt|${date}|${amount}|${desc}`)
      .digest('hex')
      .slice(0, 24);
    results.push({
      externalId,
      date,
      amount,
      payee: desc.slice(0, 80),
      description: desc,
    });
  }
  return results;
}

export function parseUniversalCsv(content: string): NormalizedBankTransaction[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const splitRow = (row: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i += 1) {
      const ch = row[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = splitRow(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = headers.findIndex((h) => /date|posted|time|timestamp/.test(h));
  const descIdx = headers.findIndex((h) =>
    /description|payee|merchant|name|memo|narrative|details/.test(h),
  );
  const amountIdx = headers.findIndex((h) => /^amount$|^total$|^net$|^value$/.test(h));
  const debitIdx = headers.findIndex((h) => /debit|withdrawal|outflow|charge/.test(h));
  const creditIdx = headers.findIndex((h) => /credit|deposit|inflow|payment/.test(h));

  const results: NormalizedBankTransaction[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitRow(lines[i]);
    if (cols.length < 2) continue;
    const rawDate = dateIdx >= 0 ? cols[dateIdx] : cols[0];
    const payee = descIdx >= 0 ? cols[descIdx] : cols[1] || 'CSV Transaction';
    let amount = NaN;
    if (amountIdx >= 0 && cols[amountIdx]) {
      amount = Number(cols[amountIdx].replace(/[$,\s]/g, ''));
    } else if (debitIdx >= 0 || creditIdx >= 0) {
      const debit = debitIdx >= 0 ? Number((cols[debitIdx] || '0').replace(/[$,\s]/g, '')) : 0;
      const credit = creditIdx >= 0 ? Number((cols[creditIdx] || '0').replace(/[$,\s]/g, '')) : 0;
      amount = (Number.isFinite(credit) ? Math.abs(credit) : 0) - (Number.isFinite(debit) ? Math.abs(debit) : 0);
    } else if (cols[2]) {
      amount = Number(cols[2].replace(/[$,\s]/g, ''));
    }
    if (!Number.isFinite(amount) || amount === 0) continue;
    const date = normalizeDateString(rawDate);
    const externalId = createHash('sha256')
      .update(`csv|${i}|${date}|${amount}|${payee}`)
      .digest('hex')
      .slice(0, 24);
    results.push({
      externalId,
      date,
      amount,
      payee: payee.slice(0, 120),
      description: payee,
    });
  }
  return results;
}

export function parseAnyFinancialStatement(
  filename: string,
  content: string,
): NormalizedBankTransaction[] {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.ofx') || lower.endsWith('.qfx') || /<OFX>/i.test(content)) {
    return parseOfxOrQfx(content);
  }
  if (lower.endsWith('.qif') || /^!Type:/i.test(content.trim())) {
    return parseQif(content);
  }
  if (lower.endsWith('.xml') || /<BkToCstmrStmt>/i.test(content)) {
    return parseCamt053Xml(content);
  }
  return parseUniversalCsv(content);
}

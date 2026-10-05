import { BadRequestException } from '@nestjs/common';

export interface CoinbaseRow {
  sourceId: string;
  occurredAtUtc: string;
  transactionType: string;
  asset: string;
  quantity: string;
  priceCurrency: string;
  priceAtTransaction: string | null;
  subtotal: string | null;
  totalInclusive: string | null;
  feesOrSpread: string | null;
  notes: string | null;
  senderAddress: string | null;
  recipientAddress: string | null;
}

const HEADERS = [
  'ID',
  'Timestamp',
  'Transaction Type',
  'Asset',
  'Quantity Transacted',
  'Price Currency',
  'Price at Transaction',
  'Subtotal',
  'Total (inclusive of fees and/or spread)',
  'Fees and/or Spread',
  'Notes',
  'Sender Address',
  'Recipient Address',
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;

  const finishField = () => {
    if (field.length > 4096) {
      throw new BadRequestException(
        'Coinbase CSV contains an oversized field.',
      );
    }
    row.push(field);
    field = '';
    closedQuote = false;
  };
  const finishRow = () => {
    finishField();
    rows.push(row);
    if (rows.length > 10010) {
      throw new BadRequestException('Coinbase CSV has too many rows.');
    }
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += char;
      }
    } else if (char === ',') {
      finishField();
    } else if (char === '\n' || char === '\r') {
      finishRow();
      if (char === '\r' && text[index + 1] === '\n') index += 1;
    } else if (char === '"' && !field && !closedQuote) {
      quoted = true;
    } else if (char === '"' || closedQuote) {
      throw new BadRequestException('Coinbase CSV has malformed quoting.');
    } else {
      field += char;
    }
  }
  if (quoted)
    throw new BadRequestException('Coinbase CSV has an unclosed quote.');
  if (field || row.length || closedQuote) finishRow();
  return rows;
}

function bounded(value: string, name: string, max: number, required = false) {
  const clean = value.trim();
  if ((required && !clean) || clean.length > max) {
    throw new BadRequestException('Invalid Coinbase ' + name + '.');
  }
  return clean || null;
}

function decimal(value: string, name: string, required = false) {
  const clean = value.trim().replace(/[$,]/g, '');
  if (!clean && !required) return null;
  if (!/^-?(?:\d+)(?:\.\d+)?$/.test(clean) || clean.length > 80) {
    throw new BadRequestException('Invalid Coinbase ' + name + '.');
  }
  return clean;
}

function utcTimestamp(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC$/.exec(
    value.trim(),
  );
  if (!match) throw new BadRequestException('Invalid Coinbase timestamp.');
  const iso = match.slice(1).join('');
  const date = new Date(
    match[1] +
      '-' +
      match[2] +
      '-' +
      match[3] +
      'T' +
      match[4] +
      ':' +
      match[5] +
      ':' +
      match[6] +
      'Z',
  );
  if (
    Number.isNaN(date.getTime()) ||
    date
      .toISOString()
      .replace(/[-:TZ]/g, '')
      .slice(0, 14) !== iso
  ) {
    throw new BadRequestException('Invalid Coinbase timestamp.');
  }
  return date.toISOString().slice(0, 19) + 'Z';
}

export function parseCoinbaseCsv(buffer: Buffer): CoinbaseRow[] {
  if (!buffer?.length || buffer.length > 2 * 1024 * 1024) {
    throw new BadRequestException('Coinbase CSV must be 2 MB or smaller.');
  }
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (text.includes('\u0000') || text.includes('\uFFFD')) {
    throw new BadRequestException('Coinbase CSV must be UTF-8 text.');
  }
  const records = parseCsv(text);
  const headerIndex = records.findIndex(
    (row) => row[0] === 'ID' && row[1] === 'Timestamp',
  );
  if (headerIndex < 0 || headerIndex > 5) {
    throw new BadRequestException('Coinbase transaction header was not found.');
  }
  if (
    records[headerIndex].length !== HEADERS.length ||
    !HEADERS.every((header, index) => records[headerIndex][index] === header)
  ) {
    throw new BadRequestException('Coinbase transaction columns do not match.');
  }

  const seen = new Set<string>();
  const rows: CoinbaseRow[] = [];
  for (const [offset, record] of records.slice(headerIndex + 1).entries()) {
    if (record.every((value) => !value.trim())) continue;
    if (record.length !== HEADERS.length) {
      throw new BadRequestException(
        'Invalid Coinbase row ' + (offset + headerIndex + 2) + '.',
      );
    }
    const sourceId = bounded(record[0], 'ID', 80, true)!;
    if (seen.has(sourceId)) {
      throw new BadRequestException('Duplicate Coinbase ID in uploaded CSV.');
    }
    seen.add(sourceId);
    const transactionType = bounded(record[2], 'transaction type', 80, true)!;
    const asset = bounded(record[3], 'asset', 20, true)!;
    const priceCurrency = bounded(record[5], 'price currency', 20, true)!;
    if (
      !/^[A-Z0-9]{2,20}$/.test(asset) ||
      !/^[A-Z0-9]{2,20}$/.test(priceCurrency)
    ) {
      throw new BadRequestException('Invalid Coinbase asset or currency.');
    }
    rows.push({
      sourceId,
      occurredAtUtc: utcTimestamp(record[1]),
      transactionType,
      asset,
      quantity: decimal(record[4], 'quantity', true)!,
      priceCurrency,
      priceAtTransaction: decimal(record[6], 'price'),
      subtotal: decimal(record[7], 'subtotal'),
      totalInclusive: decimal(record[8], 'total'),
      feesOrSpread: decimal(record[9], 'fees or spread'),
      notes: bounded(record[10], 'notes', 4096),
      senderAddress: bounded(record[11], 'sender address', 255),
      recipientAddress: bounded(record[12], 'recipient address', 255),
    });
  }
  if (!rows.length)
    throw new BadRequestException('Coinbase CSV has no transactions.');
  return rows;
}

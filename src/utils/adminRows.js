import { COUNTRIES, ENGLISH_PROFICIENCY, LANGUAGES, labelFor } from '../data/options';
import { AID_TYPES } from '../validation/schemas';

/**
 * Flattens a stored submission into the columns an admin actually scans.
 *
 * The table and the CSV export both read from `toRow`, so what you see on screen
 * and what you get in the file are the same by construction.
 */

export const COLUMNS = [
  { key: 'reference', label: 'Reference' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'country', label: 'Country' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'english', label: 'English' },
  { key: 'language', label: 'Language' },
  { key: 'visa', label: 'Visa' },
  { key: 'aid', label: 'Financial aid' },
  { key: 'submitted', label: 'Submitted' },
];

function visaCell(a) {
  if (a.needsVisa !== 'yes') return 'No';
  return a.needsVisaLetter === 'yes' ? 'Yes + letter' : 'Yes';
}

function aidCell(a) {
  if (a.needsFinancialAid !== 'yes') return 'No';
  const kinds = (a.aidTypes || []).map((t) => labelFor(AID_TYPES, t));
  return kinds.length ? `Yes — ${kinds.join(', ')}` : 'Yes';
}

export function toRow(receipt) {
  const a = receipt.answers || {};
  return {
    reference: receipt.reference,
    name: `${a.firstName || ''} ${a.lastName || ''}`.trim() || '—',
    email: a.email || '—',
    country: labelFor(COUNTRIES, a.country) || '—',
    nationality: labelFor(COUNTRIES, a.nationality) || '—',
    english: labelFor(ENGLISH_PROFICIENCY, a.englishProficiency) || '—',
    language: labelFor(LANGUAGES, a.preferredLanguage) || '—',
    visa: visaCell(a),
    aid: aidCell(a),
    submitted: receipt.submittedAt
      ? new Date(receipt.submittedAt).toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '—',
    // Flags used for the counts above the table, not rendered as columns.
    _needsLetter: a.needsVisa === 'yes' && a.needsVisaLetter === 'yes',
    _needsAid: a.needsFinancialAid === 'yes',
  };
}

/**
 * Escapes one CSV field.
 *
 * Two separate problems are handled here. The ordinary one is quoting: anything
 * containing a comma, quote or newline must be wrapped and its quotes doubled,
 * and the free-text financial-aid box will certainly contain commas.
 *
 * The less obvious one is **CSV injection**. A field beginning with =, +, - or @
 * is interpreted as a formula by Excel and Google Sheets, so an applicant could
 * type `=HYPERLINK(...)` into a text box and have it execute when an
 * administrator opens the export. Prefixing those with a tab neutralises it while
 * leaving the text readable. The data here is typed by the public, so this is a
 * real path, not a theoretical one.
 */
export function escapeCsvField(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `\t${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(receipts) {
  const header = COLUMNS.map((c) => escapeCsvField(c.label)).join(',');
  const lines = receipts.map((r) => {
    const row = toRow(r);
    return COLUMNS.map((c) => escapeCsvField(row[c.key])).join(',');
  });
  // CRLF is what RFC 4180 specifies and what Excel expects.
  return [header, ...lines].join('\r\n');
}

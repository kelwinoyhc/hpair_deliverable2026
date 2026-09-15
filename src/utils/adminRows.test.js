import { toRow, toCsv, escapeCsvField, COLUMNS } from './adminRows';

const receipt = (answers = {}) => ({
  reference: 'HPAIR-TEST-0001',
  submittedAt: '2026-03-14T09:30:00.000Z',
  attachment: { filename: 'ada-cv.pdf', sizeBytes: 1024, contentType: 'application/pdf' },
  answers: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    country: 'GB',
    nationality: 'GB',
    preferredLanguage: 'en',
    englishProficiency: 'fluent',
    needsVisa: 'no',
    needsFinancialAid: 'no',
    ...answers,
  },
});

describe('toRow', () => {
  it('resolves ISO codes to readable names', () => {
    const row = toRow(receipt({ country: 'JP', nationality: 'BR' }));
    expect(row.country).toBe('Japan');
    expect(row.nationality).toBe('Brazil');
  });

  it('collapses the nested visa answers into one cell', () => {
    expect(toRow(receipt({ needsVisa: 'no' })).visa).toBe('No');
    expect(toRow(receipt({ needsVisa: 'yes', needsVisaLetter: 'no' })).visa).toBe('Yes');
    expect(toRow(receipt({ needsVisa: 'yes', needsVisaLetter: 'yes' })).visa).toBe('Yes + letter');
  });

  it('lists what aid was requested', () => {
    expect(toRow(receipt({ needsFinancialAid: 'no' })).aid).toBe('No');
    const row = toRow(
      receipt({ needsFinancialAid: 'yes', aidTypes: ['travel', 'accommodation'] })
    );
    expect(row.aid).toBe('Yes — Travel / airfare, Accommodation');
  });

  it('exposes flags for the counts above the table', () => {
    const r = toRow(receipt({ needsVisa: 'yes', needsVisaLetter: 'yes', needsFinancialAid: 'yes' }));
    expect(r._needsLetter).toBe(true);
    expect(r._needsAid).toBe(true);
  });

  it('never renders undefined for a missing answer', () => {
    const row = toRow({ reference: 'X', submittedAt: null, answers: {} });
    Object.entries(row)
      .filter(([k]) => !k.startsWith('_'))
      .forEach(([, v]) => {
        expect(v).not.toBeUndefined();
        expect(String(v)).not.toMatch(/undefined/);
      });
  });
});

describe('escapeCsvField', () => {
  it('quotes fields containing commas, quotes or newlines', () => {
    expect(escapeCsvField('Cambridge, MA')).toBe('"Cambridge, MA"');
    expect(escapeCsvField('she said "hi"')).toBe('"she said ""hi"""');
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeCsvField('Ada Lovelace')).toBe('Ada Lovelace');
  });

  it('handles null and undefined as empty', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  /**
   * The important one. A field starting with =, +, - or @ is treated as a formula
   * by Excel and Sheets. Since applicants type free text into this form, an
   * export could otherwise execute what someone typed when an admin opens it.
   */
  describe('CSV injection', () => {
    it.each([
      '=1+1',
      '=HYPERLINK("http://evil.example","click")',
      '+1234',
      '-1+1',
      '@SUM(A1:A9)',
    ])('neutralises %s by prefixing a tab', (payload) => {
      const out = escapeCsvField(payload);
      expect(out.startsWith('\t') || out.startsWith('"\t')).toBe(true);
      // The original text is still legible to a human reader.
      expect(out).toContain(payload.replace(/"/g, '""'));
    });

    it('still quotes an injection payload that also contains a comma', () => {
      const out = escapeCsvField('=HYPERLINK("a","b")');
      expect(out.startsWith('"')).toBe(true);
      expect(out).toContain('\t=');
    });
  });
});

describe('toCsv', () => {
  it('writes a header row matching the table columns', () => {
    const csv = toCsv([receipt()]);
    const [header] = csv.split('\r\n');
    expect(header).toBe(COLUMNS.map((c) => c.label).join(','));
  });

  it('writes one line per submission, CRLF separated per RFC 4180', () => {
    const csv = toCsv([receipt(), receipt()]);
    expect(csv.split('\r\n')).toHaveLength(3); // header + 2
  });

  it('produces an empty body for no submissions', () => {
    expect(toCsv([])).toBe(COLUMNS.map((c) => c.label).join(','));
  });

  it('keeps a free-text answer with commas inside one field', () => {
    const csv = toCsv([
      receipt({
        needsFinancialAid: 'yes',
        aidTypes: ['travel', 'registration'],
      }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Yes — Travel / airfare, Registration fee"');
  });
});

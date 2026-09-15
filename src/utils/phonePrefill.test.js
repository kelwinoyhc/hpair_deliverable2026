import { nextPhoneValue, isBareDialCode } from './phonePrefill';
import DIAL_CODES from '../data/dialCodes';
import { COUNTRIES } from '../data/options';

/**
 * The prefill's only real risk is destroying something the user typed, so most of
 * these tests are about when it must do nothing.
 */

describe('dial code data', () => {
  it('has an entry for every country the form offers', () => {
    const missing = COUNTRIES.map((c) => c.value).filter((code) => !DIAL_CODES[code]);
    expect(missing).toEqual([]);
  });

  it('stores codes as digits only, without a plus', () => {
    const malformed = Object.entries(DIAL_CODES).filter(([, code]) => !/^\d{1,4}$/.test(code));
    expect(malformed).toEqual([]);
  });
});

describe('isBareDialCode', () => {
  it.each(['+1', '+44', '+81', '+353', '+998'])('recognises %s', (v) => {
    expect(isBareDialCode(v)).toBe(true);
  });

  it('does not treat a partially typed number as a bare code', () => {
    // +1234 is not any country's dialling code, so it must be someone typing.
    expect(isBareDialCode('+1234')).toBe(false);
  });

  it.each(['1', '+', '', '+14155551234', 'abc'])('rejects %s', (v) => {
    expect(isBareDialCode(v)).toBe(false);
  });
});

describe('nextPhoneValue', () => {
  it('fills an empty field from the country of residence', () => {
    expect(nextPhoneValue({ current: '', country: 'JP', nationality: 'GB' })).toBe('+81');
  });

  it('falls back to nationality when residence is not chosen yet', () => {
    expect(nextPhoneValue({ current: '', country: '', nationality: 'GB' })).toBe('+44');
  });

  it('prefers residence over nationality', () => {
    expect(nextPhoneValue({ current: '', country: 'DE', nationality: 'BR' })).toBe('+49');
  });

  it('replaces a stale prefill when the country changes', () => {
    expect(nextPhoneValue({ current: '+44', country: 'JP', nationality: 'GB' })).toBe('+81');
  });

  it('does nothing when the code is already correct', () => {
    expect(nextPhoneValue({ current: '+81', country: 'JP', nationality: 'JP' })).toBeNull();
  });

  it('never overwrites a number the user typed', () => {
    expect(nextPhoneValue({ current: '+447700900123', country: 'JP', nationality: 'GB' })).toBeNull();
    expect(nextPhoneValue({ current: '+1415', country: 'JP', nationality: 'US' })).toBeNull();
    expect(nextPhoneValue({ current: '07700900123', country: 'JP', nationality: 'GB' })).toBeNull();
  });

  it('does nothing when no country is known', () => {
    expect(nextPhoneValue({ current: '', country: '', nationality: '' })).toBeNull();
  });

  it('handles countries that share a dialling code', () => {
    expect(nextPhoneValue({ current: '', country: 'CA', nationality: '' })).toBe('+1');
    expect(nextPhoneValue({ current: '', country: 'US', nationality: '' })).toBe('+1');
    // +7 is both Russia and Kazakhstan; country -> code is unambiguous even though
    // code -> country is not.
    expect(nextPhoneValue({ current: '', country: 'KZ', nationality: '' })).toBe('+7');
  });
});

import DIAL_CODES, { dialCodeFor } from '../data/dialCodes';

/**
 * Works out whether the phone field should be prefilled with a dialling code.
 *
 * Background: the phone field validates as E.164, which means the user has to
 * type their own country code -- a real cost of that decision. Since the form
 * already knows their nationality and country of residence, it can supply the
 * code and leave them to type only their national number.
 *
 * The whole point is to be *unsurprising*, so this is a pure function with one
 * rule: never touch a number the user actually typed. It returns a new value only
 * when the field is empty, or holds nothing but a bare dialling code that a
 * previous prefill put there.
 */

// Built once at module load rather than on every keystroke.
const KNOWN_CODES = new Set(Object.values(DIAL_CODES));

/**
 * True when the value is only a "+digits" prefix matching some country's dialling
 * code -- i.e. almost certainly ours rather than the user's own typing. Checked
 * against the real code list so a partially typed number like "+1234" is not
 * mistaken for a bare code and silently overwritten.
 */
export function isBareDialCode(value) {
  if (!/^\+\d{1,4}$/.test(value)) return false;
  return KNOWN_CODES.has(value.slice(1));
}

/**
 * @returns {string|null} the value to set, or null to leave the field alone.
 */
export function nextPhoneValue({ current, country, nationality }) {
  // Residence wins over citizenship: a phone number is far more likely to belong
  // to where someone lives than to the passport they hold.
  const dial = dialCodeFor(country || nationality);
  if (!dial) return null;

  const trimmed = (current || '').trim();

  if (trimmed === '') return dial;
  if (trimmed === dial) return null; // already correct
  if (isBareDialCode(trimmed)) return dial; // stale prefill, safe to replace

  return null; // a real number -- leave it alone
}

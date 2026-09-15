/**
 * Reference data for the form's select inputs.
 *
 * Design note: we store only ISO codes and resolve display names at runtime via
 * `Intl.DisplayNames` (built into every browser we target). This keeps the file
 * small, gives us correct localised names for free, and means the value we submit
 * is a stable code ("JP") rather than a display string ("Japan") that would break
 * if we ever localised the UI.
 */

// ISO 3166-1 alpha-2. Used for both country of residence and nationality.
const COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AL', 'AM', 'AO', 'AR', 'AT', 'AU', 'AZ', 'BA', 'BB',
  'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BN', 'BO', 'BR', 'BS', 'BT', 'BW',
  'BY', 'BZ', 'CA', 'CD', 'CF', 'CG', 'CH', 'CI', 'CL', 'CM', 'CN', 'CO', 'CR',
  'CU', 'CV', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG',
  'ER', 'ES', 'ET', 'FI', 'FJ', 'FM', 'FR', 'GA', 'GB', 'GD', 'GE', 'GH', 'GM',
  'GN', 'GQ', 'GR', 'GT', 'GW', 'GY', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL',
  'IN', 'IQ', 'IR', 'IS', 'IT', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM',
  'KN', 'KP', 'KR', 'KW', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT',
  'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN',
  'MR', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NE', 'NG', 'NI', 'NL',
  'NO', 'NP', 'NR', 'NZ', 'OM', 'PA', 'PE', 'PG', 'PH', 'PK', 'PL', 'PT', 'PW',
  'PY', 'QA', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SI',
  'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SY', 'SZ', 'TD', 'TG',
  'TH', 'TJ', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG',
  'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VN', 'VU', 'WS', 'YE', 'ZA', 'ZM', 'ZW',
];

// ISO 639-1. Deliberately a curated subset: a 180-language list is worse UX than
// the languages an international conference audience actually uses.
const LANGUAGE_CODES = [
  'ar', 'bn', 'de', 'en', 'es', 'fa', 'fr', 'he', 'hi', 'id', 'it', 'ja', 'ko',
  'ms', 'nl', 'pl', 'pt', 'ru', 'sv', 'sw', 'ta', 'th', 'tr', 'uk', 'ur', 'vi',
  'zh',
];

/** Resolve a code to a display name, falling back to the code itself. */
function displayName(code, type) {
  try {
    const dn = new Intl.DisplayNames(['en'], { type });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}

function toSortedOptions(codes, type) {
  return codes
    .map((code) => ({ value: code, label: displayName(code, type) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export const COUNTRIES = toSortedOptions(COUNTRY_CODES, 'region');
export const LANGUAGES = toSortedOptions(LANGUAGE_CODES, 'language');

/**
 * Self-assessed English proficiency.
 *
 * Asked alongside preferred language, not instead of it: they answer different
 * questions. Preferred language is what we should *write to you in*; proficiency
 * is whether you can follow a panel held in English. Someone can prefer Japanese
 * correspondence and still debate fluently in English.
 *
 * The conference is conducted in English, so what matters is whether someone can
 * follow a panel and contribute to a discussion -- not which languages they speak.
 * The labels describe situations rather than using CEFR codes (B2, C1), because
 * applicants reliably know how a seminar feels and unreliably know their CEFR
 * band. Ordered strongest first: most applicants to an English-language
 * conference are at the top of this scale, so it is the shortest path for them.
 */
export const ENGLISH_PROFICIENCY = [
  { value: 'native', label: 'Native or bilingual' },
  { value: 'fluent', label: 'Fluent — comfortable presenting and debating' },
  { value: 'advanced', label: 'Advanced — follow academic discussion easily' },
  { value: 'intermediate', label: 'Intermediate — follow with some effort' },
  { value: 'basic', label: 'Basic — need support to participate' },
];

export const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'self-describe', label: 'Prefer to self-describe' },
  { value: 'undisclosed', label: 'Prefer not to say' },
];

/** Look up a label for the review screen / downloaded summary. */
export function labelFor(options, value) {
  const match = options.find((o) => o.value === value);
  return match ? match.label : value;
}

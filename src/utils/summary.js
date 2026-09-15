import { COUNTRIES, ENGLISH_PROFICIENCY, GENDERS, LANGUAGES, labelFor } from '../data/options';
import { AID_TYPES } from '../validation/schemas';

/**
 * Turns raw form values into display-ready sections.
 *
 * Both the review step and the downloadable summary read from this one function,
 * so the file a user downloads always says exactly what the review screen showed
 * them. Duplicating this mapping in two places is how those quietly diverge.
 */

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function genderLabel(values) {
  if (values.gender === 'self-describe') {
    return values.genderSelfDescribed || 'Self-described';
  }
  return labelFor(GENDERS, values.gender);
}

function addressLines(values) {
  return [values.addressLine1, values.addressLine2, values.city, values.region, values.postalCode]
    .filter(Boolean)
    .concat(labelFor(COUNTRIES, values.country) || [])
    .join(', ');
}

function orDash(value) {
  return value && String(value).trim() ? value : '—';
}

/** Renders the nested visa answers as one readable line. */
function visaSummary(values) {
  if (values.needsVisa !== 'yes') return 'No visa needed';
  if (values.needsVisaLetter === 'yes') {
    return `Visa needed — invitation letter requested for ${values.passportName || 'name not given'}`;
  }
  return 'Visa needed — no invitation letter required';
}

function aidSummary(values) {
  if (values.needsFinancialAid !== 'yes') return 'Not requested';
  const kinds = (values.aidTypes || []).map((t) => labelFor(AID_TYPES, t)).join(', ');
  return kinds ? `Requested — ${kinds}` : 'Requested';
}

export function buildSummary(values, { attachment } = {}) {
  const cvLabel = values.cv
    ? values.cv.name
    : attachment
    ? attachment.filename
    : '—';

  return [
    {
      title: 'Personal',
      step: 0,
      items: [
        { label: 'Full name', value: `${values.firstName} ${values.lastName}`.trim() || '—' },
        { label: 'Date of birth', value: formatDate(values.dateOfBirth) },
        { label: 'Gender', value: orDash(genderLabel(values)) },
        { label: 'Nationality', value: orDash(labelFor(COUNTRIES, values.nationality)) },
      ],
    },
    {
      title: 'Contact',
      step: 1,
      items: [
        { label: 'Email', value: orDash(values.email) },
        { label: 'Phone', value: orDash(values.phone) },
        { label: 'Address', value: orDash(addressLines(values)) },
      ],
    },
    {
      title: 'Professional',
      step: 2,
      items: [
        { label: 'Current role', value: orDash(values.currentRole) },
        { label: 'CV', value: cvLabel },
        {
          label: 'LinkedIn',
          value: values.hasLinkedIn === 'yes' ? orDash(values.linkedinUrl) : 'Not provided',
        },
        { label: 'Preferred language', value: orDash(labelFor(LANGUAGES, values.preferredLanguage)) },
        {
          label: 'English',
          value: orDash(labelFor(ENGLISH_PROFICIENCY, values.englishProficiency)),
        },
      ],
    },
    {
      title: 'Travel & support',
      step: 3,
      items: [
        { label: 'Visa', value: visaSummary(values) },
        { label: 'Financial aid', value: aidSummary(values) },
        ...(values.needsFinancialAid === 'yes'
          ? [{ label: 'Circumstances', value: orDash(values.financialAidNotes) }]
          : []),
      ],
    },
  ];
}

/**
 * The downloaded artefact is JSON rather than a PDF: it needs no dependency, it
 * is exactly what a backend would receive, and it stays machine-readable. A
 * print-styled page would look nicer but is a different feature.
 */
export function buildDownloadPayload(receipt) {
  return {
    reference: receipt.reference,
    submittedAt: receipt.submittedAt,
    attachment: receipt.attachment,
    sections: buildSummary(receipt.answers, { attachment: receipt.attachment }).map((section) => ({
      title: section.title,
      fields: section.items.reduce((acc, item) => ({ ...acc, [item.label]: item.value }), {}),
    })),
  };
}

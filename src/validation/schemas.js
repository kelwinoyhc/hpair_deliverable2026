import * as Yup from 'yup';

/**
 * Validation lives here, apart from the components, for two reasons:
 *  1. The step components stay presentational and the rules stay testable
 *     without mounting React (see schemas.test.js).
 *  2. `STEP_SCHEMAS` is indexed by step, so the wizard can validate only the
 *     fields currently on screen -- the user never sees an error for a field
 *     they haven't reached yet.
 *
 * One ordering rule matters throughout: when several checks on one field fail,
 * Yup reports them in the order they were chained and Formik shows the first.
 * So `.required()` is always chained BEFORE `.min()`/`.max()`, and every regex
 * uses `excludeEmptyString` -- otherwise an untouched required field complains
 * "must be at least 2 characters" or "include your country code" instead of
 * simply saying it is required. The tests pin this down.
 */

export const CV_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const CV_ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

// E.164: a leading + and 7-15 digits. Chosen over per-country formatting because
// it is unambiguous, storable as-is, and needs no extra dependency. The trade-off
// is that the user must type their country code, so the label says so.
const E164 = /^\+[1-9]\d{6,14}$/;

// Accepts linkedin.com/in/<slug>, with or without scheme/www/trailing slash.
const LINKEDIN_PROFILE = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]{3,100}\/?$/;

// Deliberately permissive: postal code formats vary enormously by country, so
// this checks shape, not country-specific rules.
const POSTAL_CODE = /^[A-Za-z0-9][A-Za-z0-9\s-]{1,11}$/;

const MIN_AGE = 16;
const MAX_AGE = 120;

function yearsAgo(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

export const personalSchema = Yup.object({
  firstName: Yup.string()
    .trim()
    .required('First name is required.')
    .min(2, 'First name must be at least 2 characters.')
    .max(50, 'First name must be 50 characters or fewer.'),
  lastName: Yup.string()
    .trim()
    .required('Last name is required.')
    .min(2, 'Last name must be at least 2 characters.')
    .max(50, 'Last name must be 50 characters or fewer.'),
  dateOfBirth: Yup.date()
    // An empty date input is the string '', which Yup casts to an Invalid Date --
    // and a failed cast short-circuits every other check, so an untouched field
    // would read "Enter a valid date." instead of "Date of birth is required."
    // Chain order cannot fix this; mapping '' to undefined before the cast can.
    .transform((value, originalValue) => (originalValue === '' ? undefined : value))
    .typeError('Enter a valid date.')
    .required('Date of birth is required.')
    .max(yearsAgo(MIN_AGE), `You must be at least ${MIN_AGE} years old.`)
    .min(yearsAgo(MAX_AGE), 'Please check your date of birth.'),
  gender: Yup.string().required('Please choose an option.'),
  genderSelfDescribed: Yup.string().when('gender', {
    is: 'self-describe',
    then: (schema) =>
      schema
        .trim()
        .required('Please tell us how you identify.')
        .max(60, 'Please use 60 characters or fewer.'),
    otherwise: (schema) => schema.strip(),
  }),
  nationality: Yup.string().required('Nationality is required.'),
});

export const contactSchema = Yup.object({
  email: Yup.string()
    .trim()
    .required('Email is required.')
    .email('Enter a valid email address, e.g. you@example.com.'),
  phone: Yup.string()
    .trim()
    .required('Phone number is required.')
    .matches(E164, {
      // Deliberately different wording from the field's hint: an error that just
      // repeats the hint tells the user nothing they didn't already read.
      message: 'Enter the number in international format, e.g. +14155551234.',
      excludeEmptyString: true,
    }),
  addressLine1: Yup.string()
    .trim()
    .required('Street address is required.')
    .min(5, 'Please enter a fuller street address.')
    .max(120, 'Please use 120 characters or fewer.'),
  addressLine2: Yup.string().trim().max(120, 'Please use 120 characters or fewer.'),
  city: Yup.string().trim().required('City is required.').min(2, 'Enter a valid city.'),
  region: Yup.string().trim().max(80, 'Please use 80 characters or fewer.'),
  postalCode: Yup.string()
    .trim()
    .required('Postal code is required.')
    .matches(POSTAL_CODE, { message: 'Enter a valid postal code.', excludeEmptyString: true }),
  country: Yup.string().required('Country of residence is required.'),
});

export const professionalSchema = Yup.object({
  currentRole: Yup.string().trim().max(100, 'Please use 100 characters or fewer.'),
  hasLinkedIn: Yup.string()
    .required('Please choose an option.')
    .oneOf(['yes', 'no'], 'Please choose an option.'),
  // The conditional question the brief asks for: the URL is only required -- and
  // only validated -- when the user says they have a profile. `.strip()` removes
  // it from the payload entirely when they don't, so we never submit a stale value.
  linkedinUrl: Yup.string().when('hasLinkedIn', {
    is: 'yes',
    then: (schema) =>
      schema
        .trim()
        .required('LinkedIn URL is required.')
        .matches(LINKEDIN_PROFILE, {
          message: 'Enter a profile URL like linkedin.com/in/your-name.',
          excludeEmptyString: true,
        }),
    otherwise: (schema) => schema.strip(),
  }),
  preferredLanguage: Yup.string().required('Preferred language is required.'),
  cv: Yup.mixed()
    .required('Please attach your CV.')
    .test('fileSize', 'That file is larger than 5 MB.', (file) => !file || file.size <= CV_MAX_BYTES)
    .test(
      'fileType',
      'Upload a PDF, DOC, or DOCX file.',
      (file) => !file || Object.keys(CV_ACCEPTED_TYPES).includes(file.type)
    ),
});

export const reviewSchema = Yup.object({
  consent: Yup.boolean().oneOf([true], 'Please confirm before submitting.').required(),
});

/** Indexed by step number, so the wizard validates only what is on screen. */
export const STEP_SCHEMAS = [personalSchema, contactSchema, professionalSchema, reviewSchema];

/** The full form, used as a final gate immediately before submission. */
export const fullSchema = personalSchema
  .concat(contactSchema)
  .concat(professionalSchema)
  .concat(reviewSchema);

export const INITIAL_VALUES = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  genderSelfDescribed: '',
  nationality: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  currentRole: '',
  hasLinkedIn: '',
  linkedinUrl: '',
  preferredLanguage: '',
  cv: null,
  consent: false,
};

/** Field names per step -- used to mark only the current step's fields as touched. */
export const STEP_FIELDS = [
  ['firstName', 'lastName', 'dateOfBirth', 'gender', 'genderSelfDescribed', 'nationality'],
  ['email', 'phone', 'addressLine1', 'addressLine2', 'city', 'region', 'postalCode', 'country'],
  ['currentRole', 'hasLinkedIn', 'linkedinUrl', 'preferredLanguage', 'cv'],
  ['consent'],
];

export const STEP_TITLES = ['Personal', 'Contact', 'Professional', 'Review'];

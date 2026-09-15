import {
  personalSchema,
  contactSchema,
  professionalSchema,
  CV_MAX_BYTES,
} from './schemas';

/**
 * These test the validation rules directly rather than through the UI.
 *
 * The rules are where the actual decisions live (what counts as a phone number,
 * when LinkedIn becomes required), they're pure, and they run in milliseconds --
 * so they're worth testing even in a small project. Rendering tests would need
 * @testing-library, which isn't a dependency here.
 */

/** Yup only reads `size`/`type`/`name` off the file, so a plain object suffices. */
const fakeFile = (overrides = {}) => ({
  name: 'cv.pdf',
  size: 1024,
  type: 'application/pdf',
  ...overrides,
});

const validPersonal = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  dateOfBirth: '1990-05-01',
  gender: 'female',
  nationality: 'GB',
};

const validContact = {
  email: 'ada@example.com',
  phone: '+14155551234',
  addressLine1: '24 Kirkland Street',
  city: 'Cambridge',
  postalCode: '02138',
  country: 'US',
};

const validProfessional = {
  hasLinkedIn: 'no',
  preferredLanguage: 'en',
  cv: fakeFile(),
};

async function errorFor(schema, values, field) {
  try {
    await schema.validate(values, { abortEarly: false });
    return null;
  } catch (err) {
    const issue = err.inner.find((i) => i.path === field);
    return issue ? issue.message : null;
  }
}

describe('personalSchema', () => {
  it('accepts a complete, valid set of answers', async () => {
    await expect(personalSchema.validate(validPersonal)).resolves.toBeTruthy();
  });

  it('requires a first name', async () => {
    expect(await errorFor(personalSchema, { ...validPersonal, firstName: '' }, 'firstName')).toMatch(
      /required/i
    );
  });

  it('rejects an applicant under 16', async () => {
    const tooYoung = new Date();
    tooYoung.setFullYear(tooYoung.getFullYear() - 10);
    expect(
      await errorFor(
        personalSchema,
        { ...validPersonal, dateOfBirth: tooYoung.toISOString().slice(0, 10) },
        'dateOfBirth'
      )
    ).toMatch(/at least 16/i);
  });

  it('asks for a self-description only when gender is self-describe', async () => {
    const withoutText = { ...validPersonal, gender: 'self-describe', genderSelfDescribed: '' };
    expect(await errorFor(personalSchema, withoutText, 'genderSelfDescribed')).toMatch(/required|identify/i);

    const otherGender = { ...validPersonal, gender: 'female', genderSelfDescribed: '' };
    expect(await errorFor(personalSchema, otherGender, 'genderSelfDescribed')).toBeNull();
  });
});

describe('contactSchema', () => {
  it('accepts a complete, valid set of answers', async () => {
    await expect(contactSchema.validate(validContact)).resolves.toBeTruthy();
  });

  it.each([
    ['4155551234', 'no country code'],
    ['+0155551234', 'leading zero after +'],
    ['+1 415 555 1234', 'spaces'],
    ['+123', 'too short'],
  ])('rejects %s (%s)', async (phone) => {
    expect(await errorFor(contactSchema, { ...validContact, phone }, 'phone')).toMatch(
      /international format/i
    );
  });

  it('accepts E.164 numbers from different countries', async () => {
    for (const phone of ['+14155551234', '+442071838750', '+8613800138000']) {
      expect(await errorFor(contactSchema, { ...validContact, phone }, 'phone')).toBeNull();
    }
  });

  it('rejects a malformed email', async () => {
    expect(await errorFor(contactSchema, { ...validContact, email: 'ada@' }, 'email')).toMatch(/valid email/i);
  });

  it('treats region as optional but city as required', async () => {
    expect(await errorFor(contactSchema, { ...validContact, region: '' }, 'region')).toBeNull();
    expect(await errorFor(contactSchema, { ...validContact, city: '' }, 'city')).toMatch(/required/i);
  });
});

describe('professionalSchema', () => {
  it('accepts a complete, valid set of answers', async () => {
    await expect(professionalSchema.validate(validProfessional)).resolves.toBeTruthy();
  });

  describe('the conditional LinkedIn question', () => {
    it('requires a URL when the applicant says they have a profile', async () => {
      const values = { ...validProfessional, hasLinkedIn: 'yes', linkedinUrl: '' };
      expect(await errorFor(professionalSchema, values, 'linkedinUrl')).toMatch(/required/i);
    });

    it('ignores the URL entirely when they say they do not', async () => {
      const values = { ...validProfessional, hasLinkedIn: 'no', linkedinUrl: 'nonsense' };
      expect(await errorFor(professionalSchema, values, 'linkedinUrl')).toBeNull();
    });

    it('accepts profile URLs with or without scheme and www', async () => {
      for (const linkedinUrl of [
        'linkedin.com/in/ada-lovelace',
        'www.linkedin.com/in/ada-lovelace',
        'https://www.linkedin.com/in/ada-lovelace/',
        'http://linkedin.com/in/ada_lovelace',
      ]) {
        const values = { ...validProfessional, hasLinkedIn: 'yes', linkedinUrl };
        expect(await errorFor(professionalSchema, values, 'linkedinUrl')).toBeNull();
      }
    });

    it('rejects a company page or a bare domain', async () => {
      for (const linkedinUrl of ['linkedin.com/company/hpair', 'linkedin.com', 'https://example.com/in/ada']) {
        const values = { ...validProfessional, hasLinkedIn: 'yes', linkedinUrl };
        expect(await errorFor(professionalSchema, values, 'linkedinUrl')).toMatch(/profile url/i);
      }
    });
  });

  describe('CV upload', () => {
    it('requires a file', async () => {
      expect(await errorFor(professionalSchema, { ...validProfessional, cv: null }, 'cv')).toMatch(/attach/i);
    });

    it('rejects a file over 5 MB', async () => {
      const cv = fakeFile({ size: CV_MAX_BYTES + 1 });
      expect(await errorFor(professionalSchema, { ...validProfessional, cv }, 'cv')).toMatch(/larger than 5 MB/i);
    });

    it('accepts a file exactly at the limit', async () => {
      const cv = fakeFile({ size: CV_MAX_BYTES });
      expect(await errorFor(professionalSchema, { ...validProfessional, cv }, 'cv')).toBeNull();
    });

    it('rejects an image', async () => {
      const cv = fakeFile({ name: 'cv.png', type: 'image/png' });
      expect(await errorFor(professionalSchema, { ...validProfessional, cv }, 'cv')).toMatch(/PDF, DOC, or DOCX/i);
    });

    it('accepts doc and docx', async () => {
      for (const type of [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]) {
        const cv = fakeFile({ type });
        expect(await errorFor(professionalSchema, { ...validProfessional, cv }, 'cv')).toBeNull();
      }
    });
  });
});

/**
 * Regression tests for the message-ordering rule described in schemas.js.
 *
 * These exist because the first version of the schema chained `.min(2)` before
 * `.required()`, so an untouched "First name" said "must be at least 2
 * characters" -- technically true, but not what an empty field should say.
 */
describe('an empty required field reports that it is required, not a format rule', () => {
  const cases = [
    ['personal.firstName', personalSchema, validPersonal, 'firstName'],
    ['personal.lastName', personalSchema, validPersonal, 'lastName'],
    ['contact.email', contactSchema, validContact, 'email'],
    ['contact.phone', contactSchema, validContact, 'phone'],
    ['contact.addressLine1', contactSchema, validContact, 'addressLine1'],
    ['contact.city', contactSchema, validContact, 'city'],
    ['contact.postalCode', contactSchema, validContact, 'postalCode'],
  ];

  it.each(cases.map(([name]) => name))('%s', async (name) => {
    const [, schema, valid, field] = cases.find(([n]) => n === name);
    const message = await errorFor(schema, { ...valid, [field]: '' }, field);
    expect(message).toMatch(/required/i);
  });

  it('applies to the conditional LinkedIn field too', async () => {
    const values = { ...validProfessional, hasLinkedIn: 'yes', linkedinUrl: '' };
    expect(await errorFor(professionalSchema, values, 'linkedinUrl')).toMatch(/required/i);
  });
});

describe('date of birth', () => {
  it('reports required, not a format error, when left empty', async () => {
    expect(await errorFor(personalSchema, { ...validPersonal, dateOfBirth: '' }, 'dateOfBirth')).toMatch(
      /required/i
    );
  });

  it('reports a format error for genuine nonsense', async () => {
    expect(
      await errorFor(personalSchema, { ...validPersonal, dateOfBirth: 'not-a-date' }, 'dateOfBirth')
    ).toMatch(/valid date/i);
  });

  it('rejects a date in the future', async () => {
    expect(
      await errorFor(personalSchema, { ...validPersonal, dateOfBirth: '2099-01-01' }, 'dateOfBirth')
    ).toMatch(/at least 16/i);
  });

  it('rejects an implausibly distant past', async () => {
    expect(
      await errorFor(personalSchema, { ...validPersonal, dateOfBirth: '1850-01-01' }, 'dateOfBirth')
    ).toMatch(/check your date of birth/i);
  });
});

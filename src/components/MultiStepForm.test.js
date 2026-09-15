import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultiStepForm from './MultiStepForm';

/**
 * Integration tests for the wizard's behaviour.
 *
 * The schema tests cover what counts as valid. These cover the part that isn't
 * expressible in a schema: that you cannot advance past an invalid step, that
 * errors appear only for the step you are on, that the conditional question
 * appears and disappears, and that submitting shows a loading state and then a
 * confirmation.
 */

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const fillPersonalStep = async (user) => {
  await user.type(screen.getByLabelText(/first name/i), 'Ada');
  await user.type(screen.getByLabelText(/last name/i), 'Lovelace');
  await user.type(screen.getByLabelText(/date of birth/i), '1990-05-01');
  await user.selectOptions(screen.getByLabelText(/gender/i), 'female');
  await user.selectOptions(screen.getByLabelText(/nationality/i), 'GB');
};

const fillContactStep = async (user) => {
  await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
  await user.type(screen.getByLabelText(/phone number/i), '+14155551234');
  await user.type(screen.getByLabelText(/street address/i), '24 Kirkland Street');
  await user.type(screen.getByLabelText(/^city/i), 'Cambridge');
  await user.type(screen.getByLabelText(/postal code/i), '02138');
  await user.selectOptions(screen.getByLabelText(/country of residence/i), 'US');
};

const next = async (user) => {
  await user.click(screen.getByRole('button', { name: /next/i }));
};

describe('step gating', () => {
  it('starts on the first step', () => {
    render(<MultiStepForm />);
    expect(screen.getByRole('heading', { level: 2, name: 'Personal' })).toBeInTheDocument();
  });

  it('refuses to advance from an empty step and shows why', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    await next(user);

    expect(await screen.findByText('First name is required.')).toBeInTheDocument();
    // Still on step one.
    expect(screen.getByRole('heading', { level: 2, name: 'Personal' })).toBeInTheDocument();
  });

  it('does not show errors for steps the user has not reached', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    await next(user);
    await screen.findByText('First name is required.');

    // Email lives on step 2 and must stay silent.
    expect(screen.queryByText('Email is required.')).not.toBeInTheDocument();
  });

  it('advances once the step is valid', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    await fillPersonalStep(user);
    await next(user);

    expect(await screen.findByRole('heading', { level: 2, name: 'Contact' })).toBeInTheDocument();
  });

  it('keeps answers when stepping back', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    await fillPersonalStep(user);
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Contact' });

    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(await screen.findByLabelText(/first name/i)).toHaveValue('Ada');
  });
});

describe('real-time validation', () => {
  it('reports a bad phone number as the user types, then clears it', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    await fillPersonalStep(user);
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Contact' });

    const phone = screen.getByLabelText(/phone number/i);
    await user.type(phone, '4155551234');
    await user.tab();

    // Scoped to this field's own error node by id. Tabbing away necessarily blurs
    // the next field too, so a page-wide alert query would pick up that field's
    // error instead of the one under test.
    const phoneError = () => document.getElementById('phone-error');

    await waitFor(() => expect(phoneError()).toBeInTheDocument());
    // Announced to assistive tech, and actually linked to the input:
    expect(phoneError()).toHaveAttribute('role', 'alert');
    expect(phoneError()).toHaveTextContent(/international format/i);
    expect(phone).toHaveAttribute('aria-describedby', expect.stringContaining('phone-error'));

    await user.clear(phone);
    await user.type(phone, '+14155551234');

    await waitFor(() => expect(phoneError()).not.toBeInTheDocument());
    expect(phone).not.toHaveAttribute('aria-invalid');
  });

  it('marks an invalid field with aria-invalid for assistive tech', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    await next(user);
    await screen.findByText('First name is required.');

    expect(screen.getByLabelText(/first name/i)).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('conditional questions', () => {
  it('asks for a LinkedIn URL only when the applicant says they have one', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    await fillPersonalStep(user);
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Contact' });
    await fillContactStep(user);
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Professional' });

    expect(screen.queryByLabelText(/linkedin url/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^yes$/i }));
    expect(await screen.findByLabelText(/linkedin url/i)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /^no$/i }));
    await waitFor(() => {
      expect(screen.queryByLabelText(/linkedin url/i)).not.toBeInTheDocument();
    });
  });

  it('asks how someone identifies only when they choose to self-describe', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    expect(screen.queryByLabelText(/how do you identify/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/gender/i), 'self-describe');

    expect(await screen.findByLabelText(/how do you identify/i)).toBeInTheDocument();
  });
});

describe('auto-save', () => {
  it('restores answers from a previous visit and offers a way to discard them', async () => {
    window.localStorage.setItem(
      'hpair-form:draft',
      JSON.stringify({
        values: { firstName: 'Grace', lastName: 'Hopper' },
        cvName: 'grace-cv.pdf',
        step: 0,
        savedAt: new Date().toISOString(),
      })
    );

    render(<MultiStepForm />);

    expect(screen.getByLabelText(/first name/i)).toHaveValue('Grace');
    expect(screen.getByText(/restored your answers/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start over/i })).toBeInTheDocument();
  });
});

describe('progress indicator', () => {
  it('marks the current step with aria-current', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    const nav = screen.getByRole('navigation', { name: /form progress/i });
    expect(within(nav).getByRole('button', { current: 'step' })).toHaveTextContent(/personal/i);

    await fillPersonalStep(user);
    await next(user);

    await waitFor(() => {
      expect(within(nav).getByRole('button', { current: 'step' })).toHaveTextContent(/contact/i);
    });
  });
});

describe('submission', () => {
  /** Walks all four steps with valid answers and presses Submit. */
  const completeAndSubmit = async (user, { email = 'ada@example.com' } = {}) => {
    await fillPersonalStep(user);
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Contact' });

    await user.type(screen.getByLabelText(/email/i), email);
    await user.type(screen.getByLabelText(/phone number/i), '+14155551234');
    await user.type(screen.getByLabelText(/street address/i), '24 Kirkland Street');
    await user.type(screen.getByLabelText(/^city/i), 'Cambridge');
    await user.type(screen.getByLabelText(/postal code/i), '02138');
    await user.selectOptions(screen.getByLabelText(/country of residence/i), 'US');
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Professional' });

    const cv = new File(['CV contents'], 'ada-cv.pdf', { type: 'application/pdf' });
    await user.upload(document.getElementById('cv'), cv);
    await screen.findByText('ada-cv.pdf');

    await user.click(screen.getByRole('radio', { name: /^no$/i }));
    await user.selectOptions(screen.getByLabelText(/preferred language/i), 'en');
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Review' });

    await user.click(screen.getByLabelText(/confirm the information above/i));
    await user.click(screen.getByRole('button', { name: /submit application/i }));
  };

  it('shows the answers on the review step before submitting', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    await fillPersonalStep(user);
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Contact' });
    await fillContactStep(user);
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Professional' });

    const cv = new File(['CV contents'], 'ada-cv.pdf', { type: 'application/pdf' });
    await user.upload(document.getElementById('cv'), cv);
    await user.click(screen.getByRole('radio', { name: /^no$/i }));
    await user.selectOptions(screen.getByLabelText(/preferred language/i), 'en');
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Review' });

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('ada-cv.pdf')).toBeInTheDocument();
    // The country code is resolved to a readable name, not left as "GB".
    expect(screen.getByText('United Kingdom')).toBeInTheDocument();
    // LinkedIn was declined, so it reads as not provided rather than being absent.
    expect(screen.getByText('Not provided')).toBeInTheDocument();
  });

  it('blocks submission until consent is given', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    await fillPersonalStep(user);
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Contact' });
    await fillContactStep(user);
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Professional' });

    const cv = new File(['CV contents'], 'ada-cv.pdf', { type: 'application/pdf' });
    await user.upload(document.getElementById('cv'), cv);
    await user.click(screen.getByRole('radio', { name: /^no$/i }));
    await user.selectOptions(screen.getByLabelText(/preferred language/i), 'en');
    await next(user);
    await screen.findByRole('heading', { level: 2, name: 'Review' });

    await user.click(screen.getByRole('button', { name: /submit application/i }));

    expect(await screen.findByText(/please confirm before submitting/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Review' })).toBeInTheDocument();
  });

  it('shows a loading state, then a confirmation with a reference code', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    await completeAndSubmit(user);

    // Loading state while the request is in flight. Asserted via the button's
    // accessible name and disabled state rather than raw text, which is both more
    // robust and closer to what a user actually perceives.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
    });

    const heading = await screen.findByRole('heading', { name: /application is submitted/i }, { timeout: 4000 });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/^HPAIR-/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download a copy/i })).toBeInTheDocument();
  });

  it('shows an error and keeps the user on the form when submission fails', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    // The service fails deterministically for a `fail@` address.
    await completeAndSubmit(user, { email: 'fail@example.com' });

    const error = await screen.findByText(/could not reach the submission service/i, undefined, {
      timeout: 4000,
    });
    expect(error).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Review' })).toBeInTheDocument();
    // The draft survives a failed submission so nothing is lost. Auto-save is
    // debounced and paused while submitting, so this needs a moment to settle.
    await waitFor(() => {
      expect(window.localStorage.getItem('hpair-form:draft')).not.toBeNull();
    });
  });

  it('clears the saved draft after a successful submission', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm />);

    await completeAndSubmit(user);
    await screen.findByRole('heading', { name: /application is submitted/i }, { timeout: 4000 });

    expect(window.localStorage.getItem('hpair-form:draft')).toBeNull();
  });
});

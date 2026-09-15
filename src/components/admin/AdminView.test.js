import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminGate from './AdminGate';
import AdminView from './AdminView';

const STORE_KEY = 'hpair-form:submissions';

const submission = (over = {}) => ({
  reference: over.reference || 'HPAIR-A1',
  submittedAt: over.submittedAt || '2026-03-14T09:30:00.000Z',
  attachment: { filename: 'cv.pdf', sizeBytes: 900, contentType: 'application/pdf' },
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
    ...(over.answers || {}),
  },
});

const seed = (rows) => window.localStorage.setItem(STORE_KEY, JSON.stringify(rows));

beforeEach(() => window.localStorage.clear());

describe('AdminGate', () => {
  it('hides the content until the passcode is entered', async () => {
    const user = userEvent.setup();
    render(
      <AdminGate>
        <p>secret content</p>
      </AdminGate>
    );

    expect(screen.queryByText('secret content')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/passcode/i), 'hpair-admin');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    expect(await screen.findByText('secret content')).toBeInTheDocument();
  });

  it('reports a wrong passcode and stays locked', async () => {
    const user = userEvent.setup();
    render(
      <AdminGate>
        <p>secret content</p>
      </AdminGate>
    );

    await user.type(screen.getByLabelText(/passcode/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not correct/i);
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  /**
   * The gate must say what it is. If this warning is ever removed, someone will
   * eventually mistake it for access control -- which is the exact bug this
   * project found in the starter repo.
   */
  it('states in the UI that it is not security', () => {
    render(
      <AdminGate>
        <p>secret content</p>
      </AdminGate>
    );
    expect(screen.getByText(/not\s+security/i)).toBeInTheDocument();
  });
});

describe('AdminView', () => {
  it('shows an empty state when nothing has been submitted', () => {
    render(<AdminView />);
    expect(screen.getByText(/no submissions in this browser yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled();
  });

  it('lists a submission as a row with the key columns', () => {
    seed([submission({ answers: { country: 'JP' } })]);
    render(<AdminView />);

    const table = screen.getByRole('table');
    expect(within(table).getByText('HPAIR-A1')).toBeInTheDocument();
    expect(within(table).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(table).getByText('Japan')).toBeInTheDocument();
  });

  it('counts the two things that create work for organisers', () => {
    seed([
      submission({ reference: 'A', answers: { needsVisa: 'yes', needsVisaLetter: 'yes' } }),
      submission({ reference: 'B', answers: { needsFinancialAid: 'yes', aidTypes: ['travel'] } }),
      submission({ reference: 'C' }),
    ]);
    render(<AdminView />);

    const letters = screen.getByText(/invitation letters to issue/i).closest('.admin-stat');
    expect(within(letters).getByText('1')).toBeInTheDocument();

    const aid = screen.getByText(/financial aid requests/i).closest('.admin-stat');
    expect(within(aid).getByText('1')).toBeInTheDocument();

    const total = screen.getByText(/^Applications$/i).closest('.admin-stat');
    expect(within(total).getByText('3')).toBeInTheDocument();
  });

  it('expands a row to show every answer', async () => {
    const user = userEvent.setup();
    seed([submission({ answers: { needsVisa: 'yes', needsVisaLetter: 'yes', passportName: 'ADA LOVELACE' } })]);
    render(<AdminView />);

    const view = screen.getByRole('button', { name: /view/i });
    expect(view).toHaveAttribute('aria-expanded', 'false');

    await user.click(view);

    expect(await screen.findByText(/invitation letter requested for ADA LOVELACE/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('orders newest first', () => {
    seed([
      submission({ reference: 'OLD', submittedAt: '2026-01-01T00:00:00.000Z' }),
      submission({ reference: 'NEW', submittedAt: '2026-06-01T00:00:00.000Z' }),
    ]);
    render(<AdminView />);

    const refs = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(refs[0]).toContain('NEW');
    expect(refs[1]).toContain('OLD');
  });

  it('clears all rows after confirmation', async () => {
    const user = userEvent.setup();
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    seed([submission()]);
    render(<AdminView />);

    await user.click(screen.getByRole('button', { name: /clear/i }));

    await waitFor(() => {
      expect(screen.getByText(/no submissions in this browser yet/i)).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(STORE_KEY)).toBeNull();
    confirmSpy.mockRestore();
  });

  it('keeps the rows when the confirmation is declined', async () => {
    const user = userEvent.setup();
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    seed([submission()]);
    render(<AdminView />);

    await user.click(screen.getByRole('button', { name: /clear/i }));

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(window.localStorage.getItem(STORE_KEY)).not.toBeNull();
    confirmSpy.mockRestore();
  });

  it('survives corrupt data in storage rather than crashing', () => {
    window.localStorage.setItem(STORE_KEY, 'not json at all');
    render(<AdminView />);
    expect(screen.getByText(/no submissions in this browser yet/i)).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminGate from './AdminGate';
import AdminView from './AdminView';

/**
 * These run with no Supabase credentials in the environment, so the store falls
 * back to localStorage and the gate falls back to its passcode. That is itself
 * worth testing: a fresh clone with no `.env.local` has to work, or nobody can
 * run this project without being handed secrets first.
 */

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

describe('AdminGate without a database configured', () => {
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
   * The fallback gate must say it is not security. If this warning is ever
   * removed, someone will mistake it for access control -- which is exactly the
   * bug this project found in the starter repo.
   */
  it('states on screen that the passcode is not security', () => {
    render(
      <AdminGate>
        <p>secret content</p>
      </AdminGate>
    );
    expect(screen.getByText(/rather than security/i)).toBeInTheDocument();
  });
});

describe('AdminView', () => {
  it('shows an empty state when nothing has been submitted', async () => {
    render(<AdminView />);
    expect(await screen.findByText(/no submissions yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled();
  });

  it('says where the rows came from', async () => {
    render(<AdminView />);
    await screen.findByText(/no submissions yet/i);
    // No credentials in the test environment, so it must not claim to be live.
    // Scoped to the subtitle: the footnote says something similar.
    expect(document.querySelector('.admin-sub')).toHaveTextContent(/this browser only/i);
    expect(document.querySelector('.admin-sub')).not.toHaveTextContent(/live from the database/i);
  });

  it('lists a submission as a row with the key columns', async () => {
    seed([submission({ answers: { country: 'JP' } })]);
    render(<AdminView />);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('HPAIR-A1')).toBeInTheDocument();
    expect(within(table).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(table).getByText('Japan')).toBeInTheDocument();
  });

  it('counts the two things that create work for organisers', async () => {
    seed([
      submission({ reference: 'A', answers: { needsVisa: 'yes', needsVisaLetter: 'yes' } }),
      submission({ reference: 'B', answers: { needsFinancialAid: 'yes', aidTypes: ['travel'] } }),
      submission({ reference: 'C' }),
    ]);
    render(<AdminView />);
    await screen.findByRole('table');

    const letters = screen.getByText(/invitation letters to issue/i).closest('.admin-stat');
    expect(within(letters).getByText('1')).toBeInTheDocument();

    const aid = screen.getByText(/financial aid requests/i).closest('.admin-stat');
    expect(within(aid).getByText('1')).toBeInTheDocument();

    const total = screen.getByText(/^Applications$/i).closest('.admin-stat');
    expect(within(total).getByText('3')).toBeInTheDocument();
  });

  it('expands a row to show every answer', async () => {
    const user = userEvent.setup();
    seed([
      submission({
        answers: { needsVisa: 'yes', needsVisaLetter: 'yes', passportName: 'ADA LOVELACE' },
      }),
    ]);
    render(<AdminView />);

    const view = await screen.findByRole('button', { name: /view/i });
    expect(view).toHaveAttribute('aria-expanded', 'false');

    await user.click(view);

    expect(
      await screen.findByText(/invitation letter requested for ADA LOVELACE/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('orders newest first', async () => {
    seed([
      submission({ reference: 'OLD', submittedAt: '2026-01-01T00:00:00.000Z' }),
      submission({ reference: 'NEW', submittedAt: '2026-06-01T00:00:00.000Z' }),
    ]);
    render(<AdminView />);
    await screen.findByRole('table');

    const refs = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(refs[0]).toContain('NEW');
    expect(refs[1]).toContain('OLD');
  });

  /**
   * There is no delete policy on the table, so applications cannot be removed
   * from the browser at all. The UI must not offer an action the database will
   * refuse.
   */
  it('offers no way to delete an application', async () => {
    seed([submission()]);
    render(<AdminView />);
    await screen.findByRole('table');

    expect(screen.queryByRole('button', { name: /clear|delete|remove/i })).not.toBeInTheDocument();
  });

  it('survives corrupt data in storage rather than crashing', async () => {
    window.localStorage.setItem(STORE_KEY, 'not json at all');
    render(<AdminView />);
    expect(await screen.findByText(/no submissions yet/i)).toBeInTheDocument();
  });
});

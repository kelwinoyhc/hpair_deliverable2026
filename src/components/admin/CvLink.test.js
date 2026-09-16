import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CvLink from './CvLink';
import { safeObjectName } from '../../services/submissionStore';

describe('safeObjectName', () => {
  /**
   * Storage object keys are URL path segments, so a `/` in a filename would
   * silently create a folder and a `?` or `#` would truncate the path.
   */
  it('strips characters that would break or reshape the object path', () => {
    expect(safeObjectName('my cv/../secret.pdf')).not.toContain('/');
    expect(safeObjectName('cv?x=1#frag.pdf')).not.toMatch(/[?#]/);
    expect(safeObjectName('résumé (final).pdf')).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('keeps an already-safe name intact', () => {
    expect(safeObjectName('ada-cv_2026.pdf')).toBe('ada-cv_2026.pdf');
  });

  it('never returns an empty key', () => {
    expect(safeObjectName('')).toBe('cv');
    expect(safeObjectName('///')).toBe('cv');
    expect(safeObjectName(null)).toBe('cv');
  });

  it('caps the length', () => {
    expect(safeObjectName(`${'a'.repeat(400)}.pdf`).length).toBeLessThanOrEqual(120);
  });
});

describe('CvLink', () => {
  it('says so when there is no attachment at all', () => {
    render(<CvLink attachment={null} />);
    expect(screen.getByText(/no file/i)).toBeInTheDocument();
  });

  /**
   * The row exists but the upload failed, or there was no backend. The filename
   * is still worth showing -- it tells the admin what to ask the applicant for --
   * but it must not look like something clickable.
   */
  it('shows the filename as not stored when there is no storage path', () => {
    render(<CvLink attachment={{ filename: 'ada-cv.pdf', storagePath: null }} />);
    expect(screen.getByText(/ada-cv\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/not stored/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers a button when the file is stored', () => {
    render(
      <CvLink attachment={{ filename: 'ada-cv.pdf', storagePath: 'HPAIR-X/ada-cv.pdf' }} />
    );
    expect(screen.getByRole('button', { name: /ada-cv\.pdf/ })).toBeInTheDocument();
  });

  /**
   * With no Supabase configured, getCvUrl resolves with a null url and no error.
   * The button must report that rather than opening a blank tab.
   */
  it('reports a failure instead of opening nothing', async () => {
    const user = userEvent.setup();
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <CvLink attachment={{ filename: 'ada-cv.pdf', storagePath: 'HPAIR-X/ada-cv.pdf' }} />
    );
    await user.click(screen.getByRole('button', { name: /ada-cv\.pdf/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not create a link/i);
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});

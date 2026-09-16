import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiDownload, FiRefreshCw, FiInbox, FiAlertTriangle, FiDatabase, FiHardDrive } from 'react-icons/fi';
import { listSubmissions, getStats, isSupabaseConfigured } from '../../services/submissionStore';
import { COLUMNS, toRow, toCsv } from '../../utils/adminRows';
import { buildSummary } from '../../utils/summary';

/**
 * Submissions list.
 *
 * Shows the columns an admissions reviewer scans -- who applied, from where, and
 * the two operational answers that create work for the organisers (a visa
 * invitation letter to issue, financial aid to assess). Counts sit above the
 * table because "how many letters do we owe?" is the question you open this to
 * answer, and counting rows by eye is how that gets wrong.
 *
 * The counts come from `getStats`, which asks Postgres to count rather than
 * downloading every application to count them here -- see submissionStore.js.
 * That is why they are fetched separately from the rows instead of derived from
 * them: the number and the page of rows answer different questions.
 */
export default function AdminView() {
  const [receipts, setReceipts] = useState([]);
  const [stats, setStats] = useState({ total: 0, letters: 0, aid: 0, remote: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remote, setRemote] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [listed, counted] = await Promise.all([listSubmissions(), getStats()]);
    setReceipts(listed.rows);
    setStats(counted);
    setRemote(listed.remote);
    setError(listed.error || counted.error || null);
    setLoading(false);
    setExpanded(null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => receipts.map((r) => ({ receipt: r, row: toRow(r) })), [receipts]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(receipts)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hpair-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };


  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <h2>Submissions</h2>
          <p className="admin-sub">
            {remote ? (
              <>
                <FiDatabase aria-hidden="true" /> Live from the database.
              </>
            ) : (
              <>
                <FiHardDrive aria-hidden="true" /> This browser only
                {isSupabaseConfigured ? ' — the database is unreachable.' : ' — no database configured.'}
              </>
            )}
          </p>
        </div>
        <div className="admin-actions">
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            <FiRefreshCw aria-hidden="true" /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportCsv}
            disabled={!rows.length}
          >
            <FiDownload aria-hidden="true" /> Export CSV
          </button>
        </div>
      </div>

      <dl className="admin-stats">
        <div className="admin-stat">
          <dt>Applications</dt>
          <dd>{stats.total}</dd>
        </div>
        <div className="admin-stat">
          <dt>Invitation letters to issue</dt>
          <dd>{stats.letters}</dd>
        </div>
        <div className="admin-stat">
          <dt>Financial aid requests</dt>
          <dd>{stats.aid}</dd>
        </div>
      </dl>

      {error && (
        <div className="submit-message error" role="alert">
          <FiAlertTriangle aria-hidden="true" />
          <span>
            {error} Showing whatever is stored in this browser instead.
          </span>
        </div>
      )}

      {loading ? (
        <p className="admin-checking">Loading submissions…</p>
      ) : !rows.length ? (
        <div className="admin-empty">
          <FiInbox aria-hidden="true" />
          <p>No submissions yet.</p>
          <p className="admin-empty-hint">Submit the form once and it will appear here.</p>
        </div>
      ) : (
        <>
          {/* Wrapped so a wide table scrolls on its own instead of forcing the
              whole page sideways on a phone. */}
          <div className="table-scroll">
            <table className="admin-table">
              <caption className="sr-only">
                Submitted applications, newest first. {stats.total} in total.
              </caption>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col">
                      {c.label}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ receipt, row }) => {
                  const isOpen = expanded === receipt.reference;
                  return (
                    <React.Fragment key={receipt.reference}>
                      <tr className={isOpen ? 'is-open' : undefined}>
                        {COLUMNS.map((c) => (
                          <td key={c.key} data-label={c.label}>
                            {c.key === 'reference' ? <code>{row[c.key]}</code> : row[c.key]}
                          </td>
                        ))}
                        <td>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => setExpanded(isOpen ? null : receipt.reference)}
                            aria-expanded={isOpen}
                            aria-controls={`detail-${receipt.reference}`}
                          >
                            {isOpen ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr id={`detail-${receipt.reference}`} className="admin-detail-row">
                          <td colSpan={COLUMNS.length + 1}>
                            <div className="admin-detail">
                              {buildSummary(receipt.answers, {
                                attachment: receipt.attachment,
                              }).map((section) => (
                                <section key={section.title}>
                                  <h3 className="summary-title">{section.title}</h3>
                                  <dl className="summary-list">
                                    {section.items.map((item) => (
                                      <div className="summary-item" key={item.label}>
                                        <dt className="summary-label">{item.label}</dt>
                                        <dd className="summary-value">{item.value}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </section>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="admin-footnote">
        {remote
          ? 'Reads are permitted by a database policy, not by this page — signing out does not hide rows from someone who was already allowed to see them.'
          : 'These rows are stored in this browser only.'}{' '}
        <a href="#top">Back to the form</a>
      </p>
    </div>
  );
}

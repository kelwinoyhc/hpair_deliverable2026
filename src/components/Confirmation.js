import React, { useEffect, useRef, useState } from 'react';
import { FiCheckCircle, FiDownload, FiPrinter, FiAlertTriangle } from 'react-icons/fi';
import { buildSummary, buildDownloadPayload } from '../utils/summary';

/**
 * Post-submission confirmation.
 *
 * Focus moves to the heading on mount: after an async action replaces the whole
 * view, a keyboard or screen-reader user would otherwise be left with focus on a
 * button that no longer exists.
 *
 * The reference code is shown because "submitted successfully" with nothing to
 * quote is not much use if the applicant later needs to ask about it.
 */
export default function Confirmation({ receipt, onStartAnother }) {
  const headingRef = useRef(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (headingRef.current) headingRef.current.focus();
  }, []);

  const sections = buildSummary(receipt.answers, { attachment: receipt.attachment });

  const download = () => {
    const payload = buildDownloadPayload(receipt);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${receipt.reference}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Without this the blob is held for the lifetime of the document.
    URL.revokeObjectURL(url);
  };

  /**
   * Saving a PDF via the browser's own print pipeline rather than a library.
   *
   * `jspdf` would give a one-click download but costs ~129 kB gzipped -- close to
   * doubling this app's bundle so that one button on one screen can lay out a
   * table. The print stylesheet in index.css costs nothing, and every desktop
   * and mobile browser's print dialog offers "Save as PDF", so the user still
   * gets a PDF. It also produces a better document, because it is styled with
   * CSS rather than hand-positioned in points.
   *
   * The trade-off, honestly: one extra step in the print dialog, and the filename
   * is chosen by the browser rather than by us.
   */
  const printSummary = () => {
    // The answers sit in a <details>. A closed <details> prints closed, so it is
    // opened for the duration of the print and restored afterwards -- rather than
    // being left open on screen, which would undo the collapsing on purpose.
    setPrinting(true);
    window.requestAnimationFrame(() => {
      window.print();
      setPrinting(false);
    });
  };

  const submittedAt = new Date(receipt.submittedAt).toLocaleString('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    <div className="confirmation">
      <FiCheckCircle className="confirmation-icon" aria-hidden="true" />
      <h2 className="confirmation-title" ref={headingRef} tabIndex={-1}>
        Your application is submitted
      </h2>
      <p className="confirmation-lede">
        Thanks, {receipt.answers.firstName}. We&apos;ve recorded your details.
      </p>

      {/*
        A submission that never reached the database is still accepted -- losing
        someone's answers to a network failure is the worse outcome -- but saying
        "submitted" with no qualification would be a lie. This says what actually
        happened and what to do about it.
      */}
      {receipt.delivered === false && (
        <div className="submit-message error confirmation-warning" role="alert">
          <FiAlertTriangle aria-hidden="true" />
          <span>
            Your answers are saved in this browser but could not be delivered to us yet. Please
            download a copy below and email it to us, or submit again later.
          </span>
        </div>
      )}

      <dl className="receipt">
        <div className="receipt-row">
          <dt>Reference</dt>
          <dd>
            <code>{receipt.reference}</code>
          </dd>
        </div>
        <div className="receipt-row">
          <dt>Submitted</dt>
          <dd>{submittedAt}</dd>
        </div>
      </dl>

      <div className="confirmation-actions">
        <button type="button" className="btn btn-primary" onClick={printSummary}>
          <FiPrinter aria-hidden="true" /> Save as PDF
        </button>
        <button type="button" className="btn btn-secondary" onClick={download}>
          <FiDownload aria-hidden="true" /> Download JSON
        </button>
        <button type="button" className="btn btn-secondary" onClick={onStartAnother}>
          Submit another response
        </button>
      </div>

      {/*
        Open by default when printing: a <details> that is closed on screen also
        prints closed, which would produce a PDF containing a reference number and
        nothing else. `open` is forced in the print stylesheet.
      */}
      <details className="confirmation-details" open={printing || undefined}>
        <summary>What you submitted</summary>
        {sections.map((section) => (
          <section className="summary-section" key={section.title}>
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
      </details>
    </div>
  );
}

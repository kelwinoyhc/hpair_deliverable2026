import React, { useEffect, useRef } from 'react';
import { FiCheckCircle, FiDownload } from 'react-icons/fi';
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
        Thanks, {receipt.answers.firstName}. We&apos;ve recorded your details and sent nothing
        anywhere you didn&apos;t ask us to.
      </p>

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
        <button type="button" className="btn btn-primary" onClick={download}>
          <FiDownload aria-hidden="true" /> Download a copy
        </button>
        <button type="button" className="btn btn-secondary" onClick={onStartAnother}>
          Submit another response
        </button>
      </div>

      <details className="confirmation-details">
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

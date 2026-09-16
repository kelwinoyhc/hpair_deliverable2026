import React, { useState } from 'react';
import { FiFileText, FiExternalLink, FiAlertTriangle } from 'react-icons/fi';
import { getCvUrl } from '../../services/submissionStore';

/**
 * Opens one stored CV.
 *
 * The bucket is private, so there is no permanent URL to render into an `href`.
 * A signed URL is minted on click and expires in five minutes -- which is also
 * why this is a button rather than a link: there is nothing to link to until the
 * admin asks for it, and pre-minting one per row would create a page full of
 * live credentials for files nobody opened.
 *
 * Supabase signs an object only if the caller could have read it, so the same
 * admin-email policy that guards the table guards this. An applicant calling
 * `createSignedUrl` gets an error, not a link.
 */
export default function CvLink({ attachment }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!attachment) return <span className="cv-link-none">No file</span>;

  if (!attachment.storagePath) {
    return (
      <span className="cv-link-none">
        {attachment.filename} <em>(not stored)</em>
      </span>
    );
  }

  const open = async () => {
    setBusy(true);
    setError(null);
    const { url, error: urlError } = await getCvUrl(attachment.storagePath);
    setBusy(false);

    if (urlError || !url) {
      setError(urlError || 'Could not create a link.');
      return;
    }
    // noopener so the opened tab cannot reach back into this one via
    // window.opener -- the URL is a credential, brief as it is.
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <span className="cv-link">
      <button type="button" className="link-button" onClick={open} disabled={busy}>
        <FiFileText aria-hidden="true" />
        {attachment.filename}
        {busy ? ' — opening…' : ''}
        {!busy && <FiExternalLink aria-hidden="true" className="cv-link-icon" />}
      </button>
      {error && (
        <span className="form-error" role="alert">
          <FiAlertTriangle className="form-error-icon" aria-hidden="true" />
          <span>{error}</span>
        </span>
      )}
    </span>
  );
}

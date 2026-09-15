import React, { useState } from 'react';
import { FiLock, FiAlertTriangle } from 'react-icons/fi';

/**
 * The passcode prompt in front of the admin view.
 *
 * READ THIS BEFORE TRUSTING IT
 * This is a demo gate, not access control, and the distinction is the whole
 * point. The passcode is compared in the browser, which means it ships inside the
 * JavaScript bundle: anyone can read it in DevTools, and anyone can skip this
 * component entirely by reading localStorage directly. Nothing a browser checks
 * can be trusted, because the browser belongs to the person you are checking.
 *
 * It is here because a submissions list wants *some* friction in a demo, and
 * because the honest version of this component is more instructive than a fake
 * one. Real access control needs a server that holds the data and decides who
 * sees it -- DESIGN.md sets out the Firestore version and the rules it needs.
 *
 * The passcode is read from REACT_APP_ADMIN_PASSCODE so it is at least not
 * hardcoded in source, but note that CRA inlines env vars at build time. This
 * changes who can *casually* find it, not who *can*.
 */

const PASSCODE = process.env.REACT_APP_ADMIN_PASSCODE || 'hpair-admin';

export default function AdminGate({ children }) {
  const [entered, setEntered] = useState('');
  const [error, setError] = useState(null);
  const [unlocked, setUnlocked] = useState(false);

  if (unlocked) return children;

  const submit = (event) => {
    event.preventDefault();
    if (entered === PASSCODE) {
      setUnlocked(true);
      setError(null);
    } else {
      setError('That passcode is not correct.');
    }
  };

  return (
    <div className="admin-gate">
      <FiLock className="admin-gate-icon" aria-hidden="true" />
      <h2>Submissions</h2>
      <p className="admin-gate-lede">Enter the passcode to view submitted applications.</p>

      <form onSubmit={submit} noValidate>
        <div className="form-group">
          <label className="sr-only" htmlFor="passcode">
            Passcode
          </label>
          <input
            id="passcode"
            type="password"
            className={`form-input${error ? ' has-error' : ''}`}
            value={entered}
            onChange={(e) => {
              setEntered(e.target.value);
              setError(null);
            }}
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'passcode-error' : undefined}
            placeholder="Passcode"
          />
          {error && (
            <p className="form-error" id="passcode-error" role="alert">
              <FiAlertTriangle className="form-error-icon" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
        </div>
        <button type="submit" className="btn btn-primary admin-gate-submit">
          Unlock
        </button>
      </form>

      {/* Stated in the UI, not just in a comment: anyone demoing this should know
          what it is before they read anything behind it. */}
      <p className="admin-gate-note">
        <FiAlertTriangle aria-hidden="true" /> This is a demonstration gate, not
        security. The passcode is checked in your browser and ships in the app
        bundle. Real access control requires a server.
      </p>

      <p className="admin-gate-back">
        <a href="#top">Back to the form</a>
      </p>
    </div>
  );
}

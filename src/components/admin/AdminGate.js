import React, { useEffect, useState } from 'react';
import { FiLock, FiAlertTriangle, FiLogOut } from 'react-icons/fi';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';

/**
 * Sign-in for the submissions view.
 *
 * TWO MODES, AND THE DIFFERENCE MATTERS
 *
 * With Supabase configured this is real authentication. The password goes to
 * Supabase, never to this component; what comes back is a JWT; and the reason an
 * applicant cannot read the submissions table is not that this component hides
 * it, but that the Row Level Security policy in supabase/schema.sql matches no
 * rows for them. Deleting this component entirely would not expose a single row.
 *
 * Without Supabase configured it falls back to a passcode compared in the
 * browser, which is NOT access control -- the value ships in the bundle, and the
 * local data is readable straight out of localStorage. That mode exists so the
 * app runs for anyone who clones it without credentials, and it says so on screen.
 *
 * The distinction is the whole lesson of this project: the starter repo had a
 * login and still exposed every applicant's data, because the narrowing to one
 * user happened in the browser. A gate in front of client-side data is
 * decoration. A policy in the database is enforcement.
 */

const FALLBACK_PASSCODE = process.env.REACT_APP_ADMIN_PASSCODE || 'hpair-admin';

function friendlyAuthError(message) {
  if (/invalid login credentials/i.test(message)) {
    return 'That email and password do not match an account.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'That account still needs its email confirmed in the Supabase dashboard.';
  }
  if (/failed to fetch|network/i.test(message)) {
    return 'Could not reach the database. If the project is paused, resume it in the Supabase dashboard.';
  }
  return message;
}

export default function AdminGate({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(isSupabaseConfigured);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [unlockedLocally, setUnlockedLocally] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Restore an existing session so a refresh does not sign the admin out.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  if (isSupabaseConfigured && checking) {
    return <p className="admin-checking">Checking your session…</p>;
  }

  if (isSupabaseConfigured && session) {
    return (
      <>
        <div className="admin-session">
          <span>
            Signed in as <strong>{session.user?.email}</strong>
          </span>
          <button
            type="button"
            className="link-button"
            onClick={() => supabase.auth.signOut()}
          >
            <FiLogOut aria-hidden="true" /> Sign out
          </button>
        </div>
        {children}
      </>
    );
  }

  if (!isSupabaseConfigured && unlockedLocally) return children;

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError(friendlyAuthError(authError.message));
    } catch (e) {
      setError(friendlyAuthError(e?.message || 'Could not sign in.'));
    } finally {
      setBusy(false);
    }
  };

  const unlockLocally = (event) => {
    event.preventDefault();
    if (passcode === FALLBACK_PASSCODE) {
      setUnlockedLocally(true);
      setError(null);
    } else {
      setError('That passcode is not correct.');
    }
  };

  return (
    <div className="admin-gate">
      <FiLock className="admin-gate-icon" aria-hidden="true" />
      <h2>Submissions</h2>
      <p className="admin-gate-lede">
        {isSupabaseConfigured
          ? 'Sign in with your administrator account.'
          : 'Enter the passcode to view submitted applications.'}
      </p>

      {isSupabaseConfigured ? (
        <form onSubmit={signIn} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-email">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              className={`form-input${error ? ' has-error' : ''}`}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              autoComplete="username"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'admin-auth-error' : undefined}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              className={`form-input${error ? ' has-error' : ''}`}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'admin-auth-error' : undefined}
            />
          </div>

          {error && (
            <p className="form-error" id="admin-auth-error" role="alert">
              <FiAlertTriangle className="form-error-icon" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <button type="submit" className="btn btn-primary admin-gate-submit" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" /> Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={unlockLocally} noValidate>
          <div className="form-group">
            <label className="sr-only" htmlFor="passcode">
              Passcode
            </label>
            <input
              id="passcode"
              type="password"
              className={`form-input${error ? ' has-error' : ''}`}
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setError(null);
              }}
              autoComplete="current-password"
              placeholder="Passcode"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'passcode-error' : undefined}
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
      )}

      {!isSupabaseConfigured && (
        <p className="admin-gate-note">
          <FiAlertTriangle aria-hidden="true" /> No database is configured, so this
          is a demonstration gate rather than security — the passcode is checked in
          your browser and ships in the app bundle. With Supabase configured, sign-in
          is real and access is enforced by database policy.
        </p>
      )}

      <p className="admin-gate-back">
        <a href="#top">Back to the form</a>
      </p>
    </div>
  );
}

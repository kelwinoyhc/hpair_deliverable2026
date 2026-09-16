import { createClient } from '@supabase/supabase-js';

/**
 * The Supabase client, or `null` when the project is not configured.
 *
 * Returning null rather than throwing is deliberate: the app is designed to run
 * without a backend at all. A missing config means submissions fall back to
 * localStorage and the admin view says so, which keeps `npm start` working for
 * anyone who clones this without credentials.
 *
 * WHY THIS FILE IS DEFENSIVE
 * `createClient` throws on a malformed URL, and this module is imported at the
 * top of the tree -- so a single mistyped environment variable threw during
 * module evaluation, before React rendered anything, and the app was a blank
 * white page with the real error only visible in the console. A configuration
 * mistake must degrade to "no backend", never to a blank screen. It happened
 * here by pasting the publishable key into the URL variable, which is an easy
 * mistake to make and a terrible one to debug from a white page.
 *
 * ON THE ANON KEY BEING PUBLIC
 * `REACT_APP_*` variables are inlined into the bundle at build time, so this key
 * is visible to anyone who opens DevTools. That is how Supabase is designed to
 * work -- the anon key identifies the project, it does not authorise anything.
 * What stops one applicant reading another's submission is the Row Level
 * Security policy in supabase/schema.sql, enforced by Postgres. If RLS is off,
 * the key alone is enough to read the table.
 *
 * The service_role key must NEVER appear here or in any REACT_APP_ variable: it
 * bypasses RLS, so shipping it in the bundle would publish full read and write
 * access to the table.
 */

const rawUrl = (process.env.REACT_APP_SUPABASE_URL || '').trim();
const rawKey = (process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();

/**
 * Explains what is wrong with the configuration, or returns null when it is
 * usable. Exported so a test can assert each case, and so the message reaches the
 * console instead of being guessed at from a blank page.
 */
export function describeConfigProblem(url, key) {
  if (!url && !key) return null; // Not configured at all: a supported mode.
  if (!url) return 'REACT_APP_SUPABASE_URL is missing.';
  if (!key) return 'REACT_APP_SUPABASE_ANON_KEY is missing.';

  // The commonest mistake: the two values swapped, or a key pasted into the URL.
  if (/^sb_(publishable|secret)_/.test(url) || url.startsWith('eyJ')) {
    return 'REACT_APP_SUPABASE_URL looks like an API key, not a URL. It should be https://<project-ref>.supabase.co';
  }

  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) {
      return `REACT_APP_SUPABASE_URL must be an http(s) URL (got "${parsed.protocol}").`;
    }
  } catch {
    return `REACT_APP_SUPABASE_URL is not a valid URL ("${url}").`;
  }

  if (url.startsWith('https://') && /supabase\.co/.test(url) && key.startsWith('http')) {
    return 'REACT_APP_SUPABASE_ANON_KEY looks like a URL, not a key.';
  }

  return null;
}

function build() {
  const problem = describeConfigProblem(rawUrl, rawKey);

  if (problem) {
    // Loud in the console, harmless to the page.
    // eslint-disable-next-line no-console
    console.error(
      `[supabase] Not connecting: ${problem}\n` +
        'Falling back to browser-local storage. See .env.example.'
    );
    return null;
  }

  if (!rawUrl || !rawKey) return null;

  try {
    return createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[supabase] Could not create the client: ${e?.message}. Falling back to local storage.`);
    return null;
  }
}

export const supabase = build();

export const isSupabaseConfigured = Boolean(supabase);

export const SUBMISSIONS_TABLE = 'submissions';

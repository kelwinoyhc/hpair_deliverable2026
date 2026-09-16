import { createClient } from '@supabase/supabase-js';

/**
 * The Supabase client, or `null` when the project is not configured.
 *
 * Returning null rather than throwing is deliberate: the app is designed to run
 * without a backend at all. A missing config means submissions fall back to
 * localStorage and the admin view says so, which keeps `npm start` working for
 * anyone who clones this without credentials.
 *
 * ON THE ANON KEY BEING PUBLIC
 * `REACT_APP_*` variables are inlined into the bundle at build time, so this key
 * is visible to anyone who opens DevTools. That is how Supabase is designed to
 * work -- the anon key identifies the project, it does not authorise anything.
 * What stops one applicant reading another's submission is the Row Level
 * Security policy in supabase/schema.sql, enforced by Postgres. If RLS is off,
 * the key alone is enough to read the table, which is why the schema file enables
 * it and why there is a query at the bottom of that file to check.
 *
 * The service_role key must NEVER appear in this file or any REACT_APP_ variable.
 */

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          // The admin session should survive a refresh but not outlive the
          // browser session, since this is a shared-laptop scenario as often as
          // not.
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

export const isSupabaseConfigured = Boolean(supabase);

export const SUBMISSIONS_TABLE = 'submissions';

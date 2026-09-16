import { supabase, isSupabaseConfigured, SUBMISSIONS_TABLE } from './supabaseClient';

/**
 * Where submitted applications are kept.
 *
 * Separate from `submissionService` on purpose: the service owns *transmitting* a
 * submission, this owns *storing* it. Everything here is async because a network
 * round trip is the normal case.
 *
 * TWO TIERS, AND WHY
 * Supabase is the record. Every write also lands in localStorage, for two
 * reasons: the app has to run at all without credentials (a fresh clone, and the
 * whole test suite), and a network failure mid-submission should not discard
 * someone's answers. A submission that only reached localStorage is flagged
 * `pendingSync` so the confirmation can say it has not been delivered, rather
 * than implying a success that did not happen.
 */

const LOCAL_KEY = 'hpair-form:submissions';
const MAX_LOCAL_ROWS = 200;

// --- Local tier -------------------------------------------------------------

function readLocal() {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt or blocked storage must never stop someone submitting.
    return [];
  }
}

function writeLocal(rows) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(-MAX_LOCAL_ROWS)));
    return true;
  } catch {
    return false;
  }
}

export function listLocal() {
  return readLocal()
    .slice()
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

export function clearLocalCache() {
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* no-op */
  }
}

// --- Mapping ----------------------------------------------------------------

/** Row shape in Postgres is snake_case; the app speaks camelCase. */
function rowToReceipt(row) {
  return {
    reference: row.reference,
    submittedAt: row.submitted_at,
    answers: row.answers || {},
    attachment: row.attachment || null,
  };
}

function receiptToRow(receipt) {
  return {
    reference: receipt.reference,
    submitted_at: receipt.submittedAt,
    answers: receipt.answers,
    attachment: receipt.attachment,
  };
}

// --- Writes -----------------------------------------------------------------

export async function addSubmission(receipt) {
  let remote = false;
  let error = null;

  if (isSupabaseConfigured) {
    try {
      const { error: insertError } = await supabase
        .from(SUBMISSIONS_TABLE)
        .insert(receiptToRow(receipt));
      if (insertError) {
        error = insertError.message;
      } else {
        remote = true;
      }
    } catch (e) {
      // Network failure, paused project, DNS -- all the same to the caller.
      error = e?.message || 'Could not reach the database.';
    }
  }

  const rows = readLocal();
  rows.push({ ...receipt, pendingSync: isSupabaseConfigured && !remote });
  writeLocal(rows);

  return { remote, error };
}

// --- Reads ------------------------------------------------------------------

/**
 * Reads the submissions an admin is allowed to see.
 *
 * Note what happens for a non-admin: the RLS policy matches no rows, so this
 * returns an empty list rather than an error. That is the correct behaviour --
 * a policy should not confirm that rows exist to someone who may not read them.
 */
export async function listSubmissions({ limit = 200 } = {}) {
  if (!isSupabaseConfigured) {
    return { rows: listLocal(), remote: false, error: null };
  }

  try {
    const { data, error } = await supabase
      .from(SUBMISSIONS_TABLE)
      .select('reference, submitted_at, answers, attachment')
      .order('submitted_at', { ascending: false })
      .limit(limit);

    if (error) return { rows: listLocal(), remote: false, error: error.message };
    return { rows: (data || []).map(rowToReceipt), remote: true, error: null };
  } catch (e) {
    return { rows: listLocal(), remote: false, error: e?.message || 'Could not reach the database.' };
  }
}

/**
 * Counts, done by Postgres rather than in the browser.
 *
 * `head: true` sends no rows back at all -- only the count in a header -- so
 * "how many people need an invitation letter" costs one small request instead of
 * downloading every application to run `.filter().length` on it. The two boolean
 * columns being generated in the table is what makes this possible.
 */
export async function getStats() {
  if (!isSupabaseConfigured) {
    const rows = listLocal();
    return {
      total: rows.length,
      letters: rows.filter((r) => r.answers?.needsVisa === 'yes' && r.answers?.needsVisaLetter === 'yes').length,
      aid: rows.filter((r) => r.answers?.needsFinancialAid === 'yes').length,
      remote: false,
      error: null,
    };
  }

  const countOf = async (apply) => {
    let query = supabase.from(SUBMISSIONS_TABLE).select('*', { count: 'exact', head: true });
    if (apply) query = apply(query);
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count || 0;
  };

  try {
    const [total, letters, aid] = await Promise.all([
      countOf(null),
      countOf((q) => q.eq('needs_visa_letter', true)),
      countOf((q) => q.eq('needs_financial_aid', true)),
    ]);
    return { total, letters, aid, remote: true, error: null };
  } catch (e) {
    const rows = listLocal();
    return {
      total: rows.length,
      letters: rows.filter((r) => r.answers?.needsVisa === 'yes' && r.answers?.needsVisaLetter === 'yes').length,
      aid: rows.filter((r) => r.answers?.needsFinancialAid === 'yes').length,
      remote: false,
      error: e?.message || 'Could not reach the database.',
    };
  }
}

export { isSupabaseConfigured };

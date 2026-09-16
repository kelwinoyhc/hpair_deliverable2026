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

export const CV_BUCKET = 'cvs';

// Long enough for an admin to click through and for a large file to start
// downloading; short enough that a link pasted somewhere stops working quickly.
const SIGNED_URL_TTL_SECONDS = 300;

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

// --- CV files ---------------------------------------------------------------

/**
 * Makes a filename safe to use as a storage object key.
 *
 * Supabase object keys are URL path segments, so a name containing `/`, `?` or
 * `#` would either break the path or silently create folders. Non-ASCII is
 * stripped rather than encoded because an applicant's CV filename is not worth a
 * round of percent-decoding on the way back out.
 */
export function safeObjectName(filename) {
  const cleaned = String(filename || 'cv')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._-]+/, '')
    .slice(0, 120);
  return cleaned || 'cv';
}

/**
 * Uploads the CV, keyed by the submission's reference.
 *
 * `upsert: false` so a repeated reference can never overwrite an existing
 * applicant's file. The reference prefix also means the objects group per
 * submission, which is what makes the admin's lookup a single known path rather
 * than a search.
 *
 * A failure here does not fail the submission -- the row is still written, with
 * the file's metadata but no storage path, and the admin sees "not stored"
 * instead of a link. Losing the application because the file did not upload
 * would be the worse outcome.
 */
export async function uploadCv(reference, file) {
  if (!isSupabaseConfigured || !file) return { path: null, error: null };

  const path = `${reference}/${safeObjectName(file.name)}`;

  try {
    const { error } = await supabase.storage
      .from(CV_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) return { path: null, error: error.message };
    return { path, error: null };
  } catch (e) {
    return { path: null, error: e?.message || 'Could not upload the file.' };
  }
}

/**
 * Mints a short-lived URL for one stored CV.
 *
 * The bucket is private, so there is no permanent URL to link to. Supabase will
 * only sign an object the caller could have read, which means the select policy
 * -- admin email only -- governs this too: an applicant cannot mint a link to
 * anyone's CV, including their own.
 */
export async function getCvUrl(storagePath) {
  if (!isSupabaseConfigured || !storagePath) return { url: null, error: null };

  try {
    const { data, error } = await supabase.storage
      .from(CV_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (error) return { url: null, error: error.message };
    return { url: data?.signedUrl || null, error: null };
  } catch (e) {
    return { url: null, error: e?.message || 'Could not create a link.' };
  }
}

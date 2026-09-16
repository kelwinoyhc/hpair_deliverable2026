/**
 * The submission boundary.
 *
 * Everything the form knows about "sending data somewhere" is this module's
 * `submitApplication` function. It returns a settled result object rather than
 * throwing, so callers render states instead of handling exceptions.
 *
 * Persistence lives in `submissionStore`, which writes to Supabase when it is
 * configured and to localStorage either way. This module owns the *lifecycle* --
 * latency, the receipt, what counts as success -- and nothing else.
 *
 * The starter repo's Firebase layer was removed rather than reused: it shipped
 * credentials for a project shared by every applicant, and its read query
 * returned all submissions and filtered by user in the browser. The replacement
 * enforces access in Postgres instead; see supabase/schema.sql.
 *
 * The receipt is kept in sessionStorage -- not localStorage -- so a refresh on
 * the confirmation screen still shows it, but someone returning next week lands
 * on a fresh form rather than a stale "you already submitted" screen.
 */

import { addSubmission, uploadCv } from './submissionStore';
import { isSupabaseConfigured } from './supabaseClient';

// Kept only for the no-backend case, where an instant success looks like nothing
// happened. With Supabase configured the real round trip supplies the latency.
const SIMULATED_LATENCY_MS = 900;
const RECEIPTS_KEY = 'hpair-form:last-receipt';

/**
 * Demo hook: an email in the `fail@` form makes submission fail, so the error
 * state is reachable on demand. Failures are never random -- a random failure is
 * indistinguishable from a bug to whoever is reviewing this.
 */
function shouldSimulateFailure(values) {
  return typeof values.email === 'string' && values.email.trim().toLowerCase().startsWith('fail@');
}

function referenceId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const salt = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HPAIR-${stamp}-${salt}`;
}

/**
 * The File itself goes to Supabase Storage; what is recorded on the row is its
 * identity, size, and the object key it was stored under.
 */
function describeAttachment(file, storagePath = null) {
  if (!file) return null;
  return {
    filename: file.name,
    sizeBytes: file.size,
    contentType: file.type,
    // Where the file actually lives, or null if the upload failed or there is no
    // backend configured. The admin view keys its download link off this.
    storagePath,
  };
}

export async function submitApplication(values) {
  if (!isSupabaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
  }

  if (shouldSimulateFailure(values)) {
    return {
      ok: false,
      error: 'We could not reach the submission service. Your answers are saved - please try again.',
    };
  }

  const { cv, ...rest } = values;
  const reference = referenceId();

  // Uploaded before the row is written, so the row can record where the file
  // landed. A failed upload leaves `storagePath` null rather than aborting: the
  // application is still worth keeping, and the admin view shows "not stored".
  const { path: storagePath, error: uploadError } = await uploadCv(reference, cv);

  const receipt = {
    reference,
    submittedAt: new Date().toISOString(),
    answers: rest,
    attachment: describeAttachment(cv, storagePath),
  };

  // The archive write is awaited, but a remote failure does not fail the
  // submission. Losing an applicant's answers because the database was asleep is
  // worse than accepting them and saying they are not yet delivered -- which is
  // what `pendingSync` on the receipt tells the confirmation screen to show.
  const { remote, error } = await addSubmission(receipt);
  const finalReceipt = {
    ...receipt,
    delivered: remote,
    deliveryError: error,
    cvStored: Boolean(storagePath),
    cvError: uploadError,
  };

  saveReceipt(finalReceipt);
  return { ok: true, receipt: finalReceipt };
}

// --- Receipt persistence: sessionStorage, so it lives exactly as long as the tab ---

export function saveReceipt(receipt) {
  try {
    window.sessionStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipt));
  } catch {
    // Blocked storage (private mode, quota): the confirmation still renders from
    // component state, so this is a soft failure by design.
  }
}

export function loadReceipt() {
  try {
    const raw = window.sessionStorage.getItem(RECEIPTS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearReceipt() {
  try {
    window.sessionStorage.removeItem(RECEIPTS_KEY);
  } catch {
    /* no-op */
  }
}

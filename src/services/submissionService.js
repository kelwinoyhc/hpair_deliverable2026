/**
 * The submission boundary.
 *
 * Everything the form knows about "sending data somewhere" is this module's
 * `submitApplication` function. It returns a settled result object rather than
 * throwing, so callers render states instead of handling exceptions.
 *
 * There is no server here, and that is a deliberate choice: the starter repo
 * shipped Firebase credentials for a project shared by every applicant, whose
 * read query returned all submissions and filtered by user in the browser. Rather
 * than write real personal data into it, the transport is simulated and the shape
 * of this module matches what a real one would be -- swapping in `fetch`,
 * Firestore, or a Vercel serverless route means editing only `submitApplication`.
 *
 * Trade-off, stated plainly: submissions do not persist server-side. The receipt
 * is kept in sessionStorage -- not localStorage -- so a refresh on the
 * confirmation screen still shows it, but someone returning next week lands on a
 * fresh form rather than a stale "you already submitted" screen.
 */

const LATENCY_MS = 900;
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
 * A File cannot be serialised or sent as JSON, so we record what a real upload
 * would report back: identity and size, not contents.
 */
function describeAttachment(file) {
  if (!file) return null;
  return { filename: file.name, sizeBytes: file.size, contentType: file.type };
}

export async function submitApplication(values) {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

  if (shouldSimulateFailure(values)) {
    return {
      ok: false,
      error: 'We could not reach the submission service. Your answers are saved - please try again.',
    };
  }

  const { cv, ...rest } = values;
  const receipt = {
    reference: referenceId(),
    submittedAt: new Date().toISOString(),
    answers: rest,
    attachment: describeAttachment(cv),
  };

  saveReceipt(receipt);
  return { ok: true, receipt };
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

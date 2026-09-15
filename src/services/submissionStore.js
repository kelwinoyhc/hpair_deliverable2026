/**
 * Where submitted applications are kept.
 *
 * This is deliberately a separate module from `submissionService`: the service
 * owns *transmitting* a submission, this owns *storing* it. Swapping to a real
 * backend replaces this file's four functions and nothing else touches it.
 *
 * WHAT THIS IS NOT
 * localStorage is per-browser. These rows are visible only to whoever is sitting
 * at this machine, and a different laptop shows an empty table. That is correct
 * for a demo and wholly wrong for a real admissions workflow -- see DESIGN.md for
 * the Firestore version and the security rules it needs.
 */

const KEY = 'hpair-form:submissions';

// Rows are small (~1 KB), but localStorage caps out around 5 MB per origin and a
// quota error on submit would be a terrible way to lose an application. Capping
// the list keeps a demo from ever reaching that ceiling.
const MAX_ROWS = 200;

function readRaw() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt or blocked storage: an unreadable archive must never stop someone
    // submitting, so this degrades to "no history" rather than throwing.
    return [];
  }
}

/** Newest first, which is the order an admin wants to read them in. */
export function listSubmissions() {
  return readRaw()
    .slice()
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

export function addSubmission(receipt) {
  try {
    const rows = readRaw();
    rows.push(receipt);
    const trimmed = rows.slice(-MAX_ROWS);
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    return true;
  } catch {
    return false;
  }
}

export function clearSubmissions() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}

export function countSubmissions() {
  return readRaw().length;
}

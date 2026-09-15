import { useEffect, useRef, useState } from 'react';

const DRAFT_KEY = 'hpair-form:draft';
const DEBOUNCE_MS = 600;

/**
 * Persists in-progress answers to localStorage so a refresh or a closed tab does
 * not lose the user's work.
 *
 * Two details worth knowing:
 *  - Writes are debounced. Saving on every keystroke would mean a JSON.stringify
 *    per character for no benefit.
 *  - The `cv` File is dropped before saving. File objects are not serialisable,
 *    and browsers do not let a page re-attach a file without the user choosing it.
 *    We keep its name so the UI can say "please re-attach" instead of silently
 *    appearing complete with nothing attached.
 */

export function readDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* no-op */
  }
}

export function useAutoSave(values, step, { enabled = true } = {}) {
  const [savedAt, setSavedAt] = useState(null);
  // Skip the very first run so merely opening the page doesn't write a draft.
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (!enabled) return undefined;
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return undefined;
    }

    const timer = setTimeout(() => {
      const { cv, ...serialisable } = values;
      const payload = {
        values: serialisable,
        cvName: cv ? cv.name : null,
        step,
        savedAt: new Date().toISOString(),
      };
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        setSavedAt(payload.savedAt);
      } catch {
        // Storage unavailable (private mode, quota). Auto-save is an enhancement,
        // so we fail quietly rather than interrupt the user mid-form.
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [values, step, enabled]);

  return savedAt;
}

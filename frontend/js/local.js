import { STORAGE_KEYS } from './config.js?v=224';
import { normalizeNotesData } from './notes.js?v=224';

export const LOCAL_DATA_KEY = STORAGE_KEYS.LOCAL_DATA;

function emptyPayload() {
  return normalizeNotesData({
    version: 5,
    updatedAt: new Date().toISOString(),
    tags: [],
    notes: [],
  });
}

/** Raw version on disk before normalize (for one-shot migrations). */
export function peekLocalNotesVersion() {
  try {
    const raw = localStorage.getItem(LOCAL_DATA_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Number(parsed?.version) || 1;
  } catch {
    return 0;
  }
}

export function loadNotes() {
  try {
    const raw = localStorage.getItem(LOCAL_DATA_KEY);
    if (!raw) {
      return { data: emptyPayload() };
    }
    return { data: normalizeNotesData(JSON.parse(raw)) };
  } catch {
    return { data: emptyPayload() };
  }
}

/** Persist to localStorage. Caller owns `updatedAt` — do not fabricate a stamp here. */
export function saveNotes(notesData) {
  if (!notesData || typeof notesData !== 'object') return;
  localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(notesData));
}

export function exportNotesBlob(notesData) {
  return new Blob([JSON.stringify(notesData, null, 2)], { type: 'application/json' });
}

export function parseNotesImport(text) {
  return normalizeNotesData(JSON.parse(text));
}

export function markCloudPending() {
  try {
    localStorage.setItem(STORAGE_KEYS.CLOUD_PENDING, '1');
  } catch { /* ignore */ }
}

export function clearCloudPending() {
  try {
    localStorage.removeItem(STORAGE_KEYS.CLOUD_PENDING);
  } catch { /* ignore */ }
}

export function isCloudPending() {
  try {
    return localStorage.getItem(STORAGE_KEYS.CLOUD_PENDING) === '1';
  } catch {
    return false;
  }
}

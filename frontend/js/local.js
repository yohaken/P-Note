import { STORAGE_KEYS } from './config.js?v=51';
import { normalizeNotesData } from './notes.js?v=122';

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

export function saveNotes(notesData) {
  notesData.updatedAt = new Date().toISOString();
  localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(notesData));
}

export function exportNotesBlob(notesData) {
  return new Blob([JSON.stringify(notesData, null, 2)], { type: 'application/json' });
}

export function parseNotesImport(text) {
  return normalizeNotesData(JSON.parse(text));
}

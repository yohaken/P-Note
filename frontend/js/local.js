import { STORAGE_KEYS } from './config.js?v=37';
import { normalizeNotesData } from './notes.js?v=37';

export const LOCAL_DATA_KEY = STORAGE_KEYS.LOCAL_DATA;

function emptyPayload() {
  return normalizeNotesData({
    version: 4,
    updatedAt: new Date().toISOString(),
    tags: [],
    notes: [],
  });
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

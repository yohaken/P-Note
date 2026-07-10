import { normalizeNotesData } from './notes.js?v=13';

const LOCAL_DATA_KEY = 'pnote_local_data';

function emptyPayload() {
  return normalizeNotesData({
    version: 2,
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

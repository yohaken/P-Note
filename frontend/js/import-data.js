import { normalizeNotesData } from './notes.js?v=22';

const LEGACY_STORAGE_KEYS = [
  'pnote_local_data',
  'pnote_notes',
  'pnote_data',
  'pnote_notes_cache',
  'pnote_session_backup',
];

const BUNDLED_IMPORT_PATH = './data/notes-import.json';
const IMPORT_FLAG_KEY = 'pnote_bundled_import_done';

function parseMaybeNotes(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return normalizeNotesData({ version: 4, notes: parsed, tags: [] });
    }
    if (parsed && Array.isArray(parsed.notes)) {
      return normalizeNotesData(parsed);
    }
  } catch {
    return null;
  }
  return null;
}

export function hasAnyNotes(data) {
  return Array.isArray(data?.notes) && data.notes.length > 0;
}

export function mergeNotesData(target, incoming) {
  const base = normalizeNotesData(target);
  const add = normalizeNotesData(incoming);
  const noteIds = new Set(base.notes.map((n) => n.id));
  const tagIds = new Set(base.tags.map((t) => t.id));
  const mergedTags = [...base.tags];
  add.tags.forEach((tag) => {
    if (!tagIds.has(tag.id)) {
      tagIds.add(tag.id);
      mergedTags.push(tag);
    }
  });
  const mergedNotes = [...base.notes];
  add.notes.forEach((note) => {
    if (!noteIds.has(note.id)) {
      noteIds.add(note.id);
      mergedNotes.push(note);
    }
  });
  return normalizeNotesData({
    ...base,
    tags: mergedTags,
    notes: mergedNotes,
    updatedAt: new Date().toISOString(),
  });
}

export function recoverLegacyLocalStorage() {
  for (const key of LEGACY_STORAGE_KEYS) {
    const data = parseMaybeNotes(localStorage.getItem(key));
    if (hasAnyNotes(data)) {
      return { data, source: key };
    }
  }
  return null;
}

export async function fetchBundledImport() {
  try {
    const res = await fetch(`${BUNDLED_IMPORT_PATH}?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return parseMaybeNotes(await res.text());
  } catch {
    return null;
  }
}

export async function tryAutoImport(currentData) {
  if (hasAnyNotes(currentData)) {
    return { data: currentData, imported: false };
  }

  const legacy = recoverLegacyLocalStorage();
  if (legacy && legacy.source !== 'pnote_local_data') {
    return { data: legacy.data, imported: true, source: legacy.source };
  }

  if (localStorage.getItem(IMPORT_FLAG_KEY) === '1') {
    return { data: currentData, imported: false };
  }

  const bundled = await fetchBundledImport();
  if (hasAnyNotes(bundled)) {
    localStorage.setItem(IMPORT_FLAG_KEY, '1');
    return { data: bundled, imported: true, source: 'bundled' };
  }

  return { data: currentData, imported: false };
}

export function importFromText(text, currentData, { merge = false } = {}) {
  const incoming = normalizeNotesData(JSON.parse(text));
  if (merge && hasAnyNotes(currentData)) {
    return mergeNotesData(currentData, incoming);
  }
  return incoming;
}

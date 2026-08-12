import { normalizeNotesData } from './notes.js?v=148';
import { mergeCalorieByUpdatedAt } from './calorie.js?v=187';

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

/** True when payload has anything worth keeping on cloud (incl. calorie days). */
export function hasCloudContent(data) {
  return hasAnyNotes(data)
    || (Array.isArray(data?.notepads) && data.notepads.length > 0)
    || (Array.isArray(data?.tags) && data.tags.length > 0)
    || (Array.isArray(data?.calorie?.days) && data.calorie.days.length > 0);
}

export function mergeNotesData(target, incoming) {
  return mergeNotesByUpdatedAt(target, incoming);
}

/**
 * Union tags/notes by id; when both sides have the same note id, keep the
 * one with the newer updatedAt (tie → incoming wins).
 */
export function mergeNotesByUpdatedAt(localRaw, remoteRaw) {
  const local = normalizeNotesData(localRaw);
  const remote = normalizeNotesData(remoteRaw);

  const tags = new Map();
  local.tags.forEach((t) => tags.set(t.id, t));
  remote.tags.forEach((t) => {
    const prev = tags.get(t.id);
    if (!prev) {
      tags.set(t.id, t);
      return;
    }
    const pt = new Date(prev.createdAt || 0).getTime();
    const nt = new Date(t.createdAt || 0).getTime();
    // Prefer remote label/color if same id (shared catalog); keep stable id
    tags.set(t.id, { ...prev, ...t, id: t.id });
    void pt;
    void nt;
  });

  const notes = new Map();
  const takeNewer = (a, b) => {
    const at = new Date(a?.updatedAt || 0).getTime();
    const bt = new Date(b?.updatedAt || 0).getTime();
    if (bt > at) return b;
    if (at > bt) return a;
    return b; // tie → prefer remote/incoming
  };
  local.notes.forEach((n) => notes.set(n.id, n));
  remote.notes.forEach((n) => {
    const prev = notes.get(n.id);
    notes.set(n.id, prev ? takeNewer(prev, n) : n);
  });

  const workspaces = new Map();
  (local.workspaces || []).forEach((w) => workspaces.set(w.id, w));
  (remote.workspaces || []).forEach((w) => {
    const prev = workspaces.get(w.id);
    workspaces.set(w.id, prev ? takeNewer(prev, w) : w);
  });

  const notepads = new Map();
  (local.notepads || []).forEach((n) => notepads.set(n.id, n));
  (remote.notepads || []).forEach((n) => {
    const prev = notepads.get(n.id);
    notepads.set(n.id, prev ? takeNewer(prev, n) : n);
  });

  const localAt = new Date(local.updatedAt || 0).getTime();
  const remoteAt = new Date(remote.updatedAt || 0).getTime();
  const calorie = mergeCalorieByUpdatedAt(local.calorie, remote.calorie);

  return normalizeNotesData({
    version: Math.max(Number(local.version) || 8, Number(remote.version) || 8, 8),
    workspaces: [...workspaces.values()],
    notepads: [...notepads.values()],
    calorie,
    tags: [...tags.values()],
    notes: [...notes.values()],
    updatedAt: new Date(Math.max(localAt, remoteAt, Date.now())).toISOString(),
  });
}

function entityNeedsPush(localList, remoteList) {
  const remoteById = new Map((remoteList || []).map((n) => [n.id, n]));
  for (const n of localList || []) {
    const r = remoteById.get(n.id);
    if (!r) return true;
    if (new Date(n.updatedAt || 0).getTime() > new Date(r.updatedAt || 0).getTime()) {
      return true;
    }
  }
  return false;
}

/** True if local has notes/notepads missing on remote or newer than remote's copy. */
export function localNeedsRemotePush(localRaw, remoteRaw) {
  const local = normalizeNotesData(localRaw);
  const remote = normalizeNotesData(remoteRaw);
  const localHas = hasCloudContent(local);
  const remoteHas = hasCloudContent(remote);
  if (!localHas) return false;
  if (!remoteHas) return true;
  if (entityNeedsPush(local.notes, remote.notes)) return true;
  if (entityNeedsPush(local.notepads, remote.notepads)) return true;
  if (entityNeedsPush(local.calorie?.days || [], remote.calorie?.days || [])) return true;
  const localCalAt = new Date(local.calorie?.updatedAt || 0).getTime();
  const remoteCalAt = new Date(remote.calorie?.updatedAt || 0).getTime();
  if (localCalAt > remoteCalAt) return true;
  return false;
}

export function recoverLegacyLocalStorage() {
  for (const key of LEGACY_STORAGE_KEYS) {
    const data = parseMaybeNotes(localStorage.getItem(key));
    if (hasCloudContent(data)) {
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
  if (hasCloudContent(currentData)) {
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
  if (hasCloudContent(bundled)) {
    localStorage.setItem(IMPORT_FLAG_KEY, '1');
    return { data: bundled, imported: true, source: 'bundled' };
  }

  return { data: currentData, imported: false };
}

export function importFromText(text, currentData, { merge = false } = {}) {
  const incoming = normalizeNotesData(JSON.parse(text));
  if (merge && hasCloudContent(currentData)) {
    return mergeNotesData(currentData, incoming);
  }
  return incoming;
}

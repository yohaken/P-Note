import { normalizeNotesData, stripInlineAttachmentsForCloud } from './notes.js?v=227';
import { mergeCalorieByUpdatedAt, normalizeHomePins } from './calorie.js?v=233';
import { compareStamp, newerStampIso } from './clock.js?v=227';
import {
  applyDeletionFilter,
  isEntityTombstoned,
  mergeDeletions,
  normalizeDeletions,
} from './deletions.js?v=227';

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

/** True when payload has anything worth keeping on cloud (incl. calorie days / pins). */
export function hasCloudContent(data) {
  return hasAnyNotes(data)
    || (Array.isArray(data?.notepads) && data.notepads.length > 0)
    || (Array.isArray(data?.tags) && data.tags.length > 0)
    || (Array.isArray(data?.calorie?.days) && data.calorie.days.length > 0)
    || (Array.isArray(data?.homePins) && data.homePins.length > 0)
    || (Array.isArray(data?.calorie?.homePins) && data.calorie.homePins.length > 0);
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
  const mergedDeletions = mergeDeletions(local.deletions, remote.deletions);

  const tags = new Map();
  local.tags.forEach((t) => tags.set(t.id, t));
  remote.tags.forEach((t) => {
    if (isEntityTombstoned(mergedDeletions, 'tags', t.id, t.createdAt)) return;
    const prev = tags.get(t.id);
    if (!prev) {
      tags.set(t.id, t);
      return;
    }
    tags.set(t.id, { ...prev, ...t, id: t.id });
  });

  const notes = new Map();
  const takeNewer = (a, b) => {
    const c = compareStamp(a?.updatedAt, b?.updatedAt);
    if (c > 0) return a;
    return b;
  };
  local.notes.forEach((n) => {
    if (!isEntityTombstoned(mergedDeletions, 'notes', n.id, n.updatedAt)) {
      notes.set(n.id, n);
    }
  });
  remote.notes.forEach((n) => {
    if (isEntityTombstoned(mergedDeletions, 'notes', n.id, n.updatedAt)) return;
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
  local.notepads.forEach((n) => {
    if (!isEntityTombstoned(mergedDeletions, 'notepads', n.id, n.updatedAt)) {
      notepads.set(n.id, n);
    }
  });
  remote.notepads.forEach((n) => {
    if (isEntityTombstoned(mergedDeletions, 'notepads', n.id, n.updatedAt)) return;
    const prev = notepads.get(n.id);
    notepads.set(n.id, prev ? takeNewer(prev, n) : n);
  });

  const calorie = mergeCalorieByUpdatedAt(local.calorie, remote.calorie);

  // Root homePins merge by homePinsAt (independent of meal/day edits).
  const lp = normalizeHomePins(local.homePins?.length ? local.homePins : local.calorie?.homePins);
  const rp = normalizeHomePins(remote.homePins?.length ? remote.homePins : remote.calorie?.homePins);
  const lPinAt = new Date(local.homePinsAt || local.calorie?.homePinsAt || 0).getTime() || 0;
  const rPinAt = new Date(remote.homePinsAt || remote.calorie?.homePinsAt || 0).getTime() || 0;
  let homePins;
  let homePinsAt;
  if (lPinAt > rPinAt) {
    homePins = lp;
    homePinsAt = local.homePinsAt || local.calorie?.homePinsAt || '';
  } else if (rPinAt > lPinAt) {
    homePins = rp;
    homePinsAt = remote.homePinsAt || remote.calorie?.homePinsAt || '';
  } else if (!lp.length && rp.length) {
    homePins = rp;
    homePinsAt = remote.homePinsAt || remote.calorie?.homePinsAt || '';
  } else {
    homePins = lp;
    homePinsAt = local.homePinsAt || local.calorie?.homePinsAt || remote.homePinsAt || '';
  }

  return applyDeletionFilter(normalizeNotesData({
    version: Math.max(Number(local.version) || 9, Number(remote.version) || 9, 9),
    workspaces: [...workspaces.values()],
    notepads: [...notepads.values()],
    calorie: {
      ...calorie,
      homePins,
      homePinsAt,
    },
    homePins,
    homePinsAt,
    tags: [...tags.values()],
    notes: [...notes.values()],
    deletions: mergedDeletions,
    updatedAt: newerStampIso(local.updatedAt, remote.updatedAt),
  }));
}

/** Payload safe for Firestore document size limits. */
export function notesDataForCloudPush(data) {
  return stripInlineAttachmentsForCloud(normalizeNotesData(data));
}

function entityNeedsPush(localList, remoteList) {
  const remoteById = new Map((remoteList || []).map((n) => [n.id, n]));
  for (const n of localList || []) {
    const r = remoteById.get(n.id);
    if (!r) return true;
    if (compareStamp(n.updatedAt, r.updatedAt) > 0) {
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
  if (compareStamp(local.calorie?.updatedAt, remote.calorie?.updatedAt) > 0) return true;
  const ld = normalizeDeletions(local.deletions);
  const rd = normalizeDeletions(remote.deletions);
  if (compareStamp(ld.updatedAt, rd.updatedAt) > 0) return true;
  if (compareStamp(
    local.homePinsAt || local.calorie?.homePinsAt,
    remote.homePinsAt || remote.calorie?.homePinsAt,
  ) > 0) return true;
  const localPins = JSON.stringify(local.homePins || local.calorie?.homePins || []);
  const remotePins = JSON.stringify(remote.homePins || remote.calorie?.homePins || []);
  if (localPins !== remotePins && (local.homePins || local.calorie?.homePins || []).length > 0
    && !(remote.homePins || remote.calorie?.homePins || []).length) {
    return true;
  }
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

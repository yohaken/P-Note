import { STORAGE_KEYS } from './config.js?v=354';
import { initFirebase, getDb, auth } from './firebase.js?v=354';
import { nowIso, setClockOffset } from './clock.js?v=354';
import { emptyDeletions, normalizeDeletions } from './deletions.js?v=354';
import { notesDataForCloudPush } from './import-data.js?v=354';
import { compactCalorieForStorage } from './calorie.js?v=354';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

/** Test seam — harness may set window.__PNOTE_SYNC_TEST__ before modules run. */
function syncTestHook() {
  try {
    return typeof window !== 'undefined' ? window.__PNOTE_SYNC_TEST__ : null;
  } catch {
    return null;
  }
}

/**
 * Direct Firestore sync (no Express API).
 * One shared cloud doc for the owner account — local-first paint, then warm/sync.
 */

/** Fixed personal space — phone + desktop always use this Firestore doc. */
export const SHARED_SPACE_ID = 'sp-pnote-shared';

const SPACE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const PREV_SPACE_KEY = 'pnote_prev_space_id';
const COLLECTION = 'spaces';
/** Server-stamped sibling field used only to anchor the local clock. */
const CLOCK_FIELD = 'clockAt';
let clockAnchored = false;
/** Client ms of the last write we sent carrying a serverTimestamp() sentinel. */
let lastClockWriteAt = 0;

function persistSharedSpaceId() {
  const previous = localStorage.getItem(STORAGE_KEYS.SPACE_ID);
  if (
    previous &&
    previous !== SHARED_SPACE_ID &&
    SPACE_RE.test(previous) &&
    !localStorage.getItem(PREV_SPACE_KEY)
  ) {
    localStorage.setItem(PREV_SPACE_KEY, previous);
  }
  localStorage.setItem(STORAGE_KEYS.SPACE_ID, SHARED_SPACE_ID);
  localStorage.setItem(STORAGE_KEYS.LEGACY_CALORIE_SPACE_ID, SHARED_SPACE_ID);
  return SHARED_SPACE_ID;
}

export function getSpaceId() {
  return persistSharedSpaceId();
}

/** @deprecated Sync codes removed — always returns shared space. */
export function setSpaceId(_id) {
  return persistSharedSpaceId();
}

export function getPreviousSpaceId() {
  const prev = localStorage.getItem(PREV_SPACE_KEY);
  return prev && SPACE_RE.test(prev) && prev !== SHARED_SPACE_ID ? prev : null;
}

export function clearPreviousSpaceId() {
  localStorage.removeItem(PREV_SPACE_KEY);
}

function emptyPayload() {
  return {
    version: 10,
    updatedAt: nowIso(),
    tags: [],
    notes: [],
    workspaces: [],
    notepads: [],
    calorie: null,
    homePins: [],
    homePinsAt: '',
    deletions: emptyDeletions(),
    settingsSync: null,
  };
}

/**
 * Preserve homePins at document root (and pass calorie through).
 * Older clients only nested pins under calorie — both are kept on write.
 */
function normalizePayload(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const calorie = data.calorie && typeof data.calorie === 'object' ? data.calorie : null;
  const rootPins = Array.isArray(data.homePins) ? data.homePins : null;
  const nestedPins = Array.isArray(calorie?.homePins) ? calorie.homePins : null;
  const homePins = rootPins && rootPins.length ? rootPins : (nestedPins || []);
  const homePinsAt = String(
    data.homePinsAt
      || (homePins.length ? (calorie?.homePinsAt || calorie?.updatedAt || '') : '')
      || '',
  );
  return {
    version: Number(data.version) || 10,
    // Preserve the stored stamp; do NOT fabricate "now" for existing data
    // (a fabricated stamp makes old cloud content look newer than it is).
    updatedAt: data.updatedAt || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    workspaces: Array.isArray(data.workspaces) ? data.workspaces : [],
    notepads: Array.isArray(data.notepads) ? data.notepads : [],
    calorie,
    homePins,
    homePinsAt,
    deletions: normalizeDeletions(data.deletions),
    settingsSync: data.settingsSync && typeof data.settingsSync === 'object' ? data.settingsSync : null,
  };
}

/** Strip undefined (Firestore rejects them) and non-JSON values. */
function toFirestorePayload(data, { settingsSync } = {}) {
  const normalized = notesDataForCloudPush(normalizePayload(data));
  // Mirror pins into calorie so older readers still see them.
  if (normalized.calorie && typeof normalized.calorie === 'object') {
    normalized.calorie = compactCalorieForStorage({
      ...normalized.calorie,
      homePins: Array.isArray(normalized.homePins) ? normalized.homePins : [],
      homePinsAt: normalized.homePinsAt || '',
    });
    normalized.version = Math.max(Number(normalized.version) || 0, 10);
  }
  normalized.updatedAt = nowIso();
  if (settingsSync && typeof settingsSync === 'object') {
    normalized.settingsSync = settingsSync;
  } else if (data.settingsSync && typeof data.settingsSync === 'object') {
    normalized.settingsSync = data.settingsSync;
  }
  // One serialize: UTF-8 bytes (Firestore), not UTF-16 code units (Thai ≈ 3 B/char).
  const json = JSON.stringify(normalized);
  const out = JSON.parse(json);
  const bytes = new TextEncoder().encode(json).length;
  if (bytes > 900_000) {
    const err = new Error(`doc too big: ${bytes}`);
    err.code = 'DOC_TOO_BIG';
    throw err;
  }
  return out;
}

function requireSignedIn() {
  if (!auth?.currentUser) {
    throw new Error('Not signed in');
  }
}

function spaceRef(spaceId) {
  const id = SPACE_RE.test(spaceId) ? spaceId : SHARED_SPACE_ID;
  return doc(getDb(), COLLECTION, id);
}

/** Attach a serverTimestamp sentinel outside toFirestorePayload (keeps test hook JSON-clean). */
function withClockStamp(payload) {
  lastClockWriteAt = Date.now();
  return { ...payload, [CLOCK_FIELD]: serverTimestamp() };
}

/** Pair a resolved server Timestamp with the client ms of the write that made it. */
function anchorClockFromSnap(snap, clientMs) {
  try {
    if (!clientMs || !snap?.exists?.()) return;
    if (snap.metadata?.hasPendingWrites) return; // sentinel not resolved yet
    if (Date.now() - clientMs > 10_000) return;
    const raw = snap.data()?.[CLOCK_FIELD];
    const ms = raw && typeof raw.toMillis === 'function' ? raw.toMillis() : 0;
    if (!ms) return;
    setClockOffset(ms, clientMs);
    clockAnchored = true;
    lastClockWriteAt = 0;
  } catch { /* ignore */ }
}

/** Test harness: exercise A2 bail without a Firestore snap. Returns whether offset applied. */
export function __probeAnchorClock(serverMs, clientMs) {
  if (!clientMs) return { applied: false, reason: 'no-client' };
  if (Date.now() - clientMs > 10_000) return { applied: false, reason: 'stale' };
  if (!Number.isFinite(serverMs)) return { applied: false, reason: 'bad-server' };
  setClockOffset(serverMs, clientMs);
  clockAnchored = true;
  lastClockWriteAt = 0;
  return { applied: true };
}

/**
 * Anchor the client clock from an HTTP Date response header — no Firestore write.
 * Same-origin HEAD (fallback GET) of a tiny boot asset with cache: 'no-store'.
 * Skipped under __PNOTE_SYNC_TEST__ (harness drives the clock).
 */
export async function anchorClockFromHttpDate() {
  if (clockAnchored) return false;
  const hook = syncTestHook();
  if (hook) return false;
  try {
    const url = new URL('js/boot.js', typeof location !== 'undefined' ? location.href : 'http://localhost/');
    url.searchParams.set('_', String(Date.now()));
    const t0 = Date.now();
    let res = await fetch(url.toString(), { method: 'HEAD', cache: 'no-store' });
    if (!res.ok || !res.headers.get('date')) {
      res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
    }
    const dateHdr = res.headers.get('date');
    if (!dateHdr) return false;
    const serverMs = Date.parse(dateHdr);
    if (!Number.isFinite(serverMs)) return false;
    setClockOffset(serverMs, Math.round((t0 + Date.now()) / 2));
    clockAnchored = true;
    return true;
  } catch {
    return false;
  }
}

export async function fetchRemoteNotes(spaceId) {
  const hook = syncTestHook();
  if (hook && typeof hook.fetchRemoteNotes === 'function') {
    return normalizePayload(await hook.fetchRemoteNotes(spaceId || SHARED_SPACE_ID));
  }
  await initFirebase();
  requireSignedIn();
  const snap = await getDoc(spaceRef(spaceId || SHARED_SPACE_ID));
  anchorClockFromSnap(snap, lastClockWriteAt);
  if (!snap.exists()) {
    return emptyPayload();
  }
  return normalizePayload(snap.data());
}

export async function pushRemoteNotes(spaceId, data) {
  await initFirebase();
  requireSignedIn();
  const payload = toFirestorePayload(data);
  await setDoc(spaceRef(spaceId || SHARED_SPACE_ID), withClockStamp(payload));
  return payload;
}

/**
 * Bank-style atomic commit on the shared space doc (Firestore transaction).
 *
 * Same guarantee as a ledger transfer for sub-second races:
 * 1. Read latest cloud revision inside the txn
 * 2. Merge local + cloud by entity updatedAt
 * 3. Commit set — if another device wrote in between, Firestore aborts
 *    and auto-retries from step 1 (default ~5 attempts)
 *
 * Blind getDoc→setDoc is forbidden for multi-device saves.
 *
 * @param {string} spaceId
 * @param {(remote: object) => { write: boolean, data: object }} resolveMerged
 *   Called with the latest cloud payload inside the transaction.
 *   Return `{ write: false, data }` to skip setDoc (e.g. sparse local).
 * @returns {Promise<{ written: boolean, data: object, remote: object, flushedIds: string[]|null }>}
 */
export async function pushRemoteNotesMerged(spaceId, resolveMerged) {
  if (typeof resolveMerged !== 'function') {
    throw new Error('resolveMerged required');
  }
  const hook = syncTestHook();
  if (hook && typeof hook.pushRemoteNotesMerged === 'function') {
    const remote = normalizePayload(
      typeof hook.getRemote === 'function'
        ? hook.getRemote(spaceId || SHARED_SPACE_ID)
        : emptyPayload(),
    );
    const decision = resolveMerged(remote);
    if (typeof hook.__afterResolve === 'function') {
      try {
        hook.__afterResolve(decision);
      } catch (_) {
        /* ignore test-hook errors */
      }
    }
    if (!decision || decision.write === false) {
      return {
        written: false,
        data: decision?.data != null ? decision.data : remote,
        remote,
        flushedIds: null,
      };
    }
    const payload = toFirestorePayload(decision.data, {
      settingsSync: decision.settingsSync,
    });
    if (typeof hook.commitRemote === 'function') {
      hook.commitRemote(spaceId || SHARED_SPACE_ID, payload);
    }
    if (typeof hook.__afterCommit === 'function') {
      try {
        hook.__afterCommit(payload);
      } catch (_) {
        /* ignore test-hook errors */
      }
    }
    const flushedIds = Array.isArray(decision._flushedIds) ? decision._flushedIds.slice() : null;
    return { written: true, data: payload, remote, flushedIds };
  }
  await initFirebase();
  requireSignedIn();
  const ref = spaceRef(spaceId || SHARED_SPACE_ID);
  // runTransaction = optimistic concurrency + automatic retry on conflict.
  return runTransaction(getDb(), async (transaction) => {
    const snap = await transaction.get(ref);
    anchorClockFromSnap(snap, lastClockWriteAt);
    const remote = snap.exists() ? normalizePayload(snap.data()) : emptyPayload();
    const decision = resolveMerged(remote);
    if (!decision || decision.write === false) {
      return {
        written: false,
        data: decision?.data != null ? decision.data : remote,
        remote,
        flushedIds: null,
      };
    }
    const payload = toFirestorePayload(decision.data, {
      settingsSync: decision.settingsSync,
    });
    transaction.set(ref, withClockStamp(payload));
    const flushedIds = Array.isArray(decision._flushedIds) ? decision._flushedIds.slice() : null;
    return { written: true, data: payload, remote, flushedIds };
  });
}

/**
 * Live listener on the shared space doc. Returns an unsubscribe fn.
 * @param {string} spaceId
 * @param {(data: object) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export async function watchRemoteNotes(spaceId, onData, onError) {
  const hook = syncTestHook();
  if (hook && typeof hook.watchRemoteNotes === 'function') {
    return hook.watchRemoteNotes(spaceId || SHARED_SPACE_ID, (raw) => {
      onData(normalizePayload(raw));
    }, onError);
  }
  await initFirebase();
  requireSignedIn();
  return onSnapshot(
    spaceRef(spaceId || SHARED_SPACE_ID),
    (snap) => {
      anchorClockFromSnap(snap, lastClockWriteAt);
      if (!snap.exists()) {
        onData(emptyPayload());
        return;
      }
      onData(normalizePayload(snap.data()));
    },
    (err) => {
      if (typeof onError === 'function') onError(err);
      else console.warn('watchRemoteNotes', err);
    },
  );
}

/** True when browser is online and Firebase Auth session exists. */
export async function checkDbOnline() {
  if (!navigator.onLine) return false;
  try {
    await initFirebase();
    return Boolean(auth?.currentUser);
  } catch {
    return false;
  }
}

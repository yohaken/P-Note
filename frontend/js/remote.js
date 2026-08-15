import { STORAGE_KEYS } from './config.js?v=204';
import { initFirebase, getDb, auth } from './firebase.js?v=204';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

/**
 * Direct Firestore sync (no Express API).
 * One shared cloud doc for the owner account — local-first paint, then warm/sync.
 */

/** Fixed personal space — phone + desktop always use this Firestore doc. */
export const SHARED_SPACE_ID = 'sp-pnote-shared';

const SPACE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const PREV_SPACE_KEY = 'pnote_prev_space_id';
const COLLECTION = 'spaces';

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
    version: 8,
    updatedAt: new Date().toISOString(),
    tags: [],
    notes: [],
    workspaces: [],
    notepads: [],
    calorie: null,
    homePins: [],
    homePinsAt: '',
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
    version: Number(data.version) || 8,
    updatedAt: data.updatedAt || new Date().toISOString(),
    tags: Array.isArray(data.tags) ? data.tags : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    workspaces: Array.isArray(data.workspaces) ? data.workspaces : [],
    notepads: Array.isArray(data.notepads) ? data.notepads : [],
    calorie,
    homePins,
    homePinsAt,
  };
}

/** Strip undefined (Firestore rejects them) and non-JSON values. */
function toFirestorePayload(data) {
  const normalized = normalizePayload(data);
  // Mirror pins into calorie so older readers still see them.
  if (normalized.calorie && typeof normalized.calorie === 'object') {
    normalized.calorie = {
      ...normalized.calorie,
      homePins: Array.isArray(normalized.homePins) ? normalized.homePins : [],
      homePinsAt: normalized.homePinsAt || '',
    };
  }
  normalized.updatedAt = new Date().toISOString();
  return JSON.parse(JSON.stringify(normalized));
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

export async function fetchRemoteNotes(spaceId) {
  await initFirebase();
  requireSignedIn();
  const snap = await getDoc(spaceRef(spaceId || SHARED_SPACE_ID));
  if (!snap.exists()) {
    return emptyPayload();
  }
  return normalizePayload(snap.data());
}

export async function pushRemoteNotes(spaceId, data) {
  await initFirebase();
  requireSignedIn();
  const payload = toFirestorePayload(data);
  await setDoc(spaceRef(spaceId || SHARED_SPACE_ID), payload);
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
 * @returns {Promise<{ written: boolean, data: object, remote: object }>}
 */
export async function pushRemoteNotesMerged(spaceId, resolveMerged) {
  await initFirebase();
  requireSignedIn();
  if (typeof resolveMerged !== 'function') {
    throw new Error('resolveMerged required');
  }
  const ref = spaceRef(spaceId || SHARED_SPACE_ID);
  // runTransaction = optimistic concurrency + automatic retry on conflict.
  return runTransaction(getDb(), async (transaction) => {
    const snap = await transaction.get(ref);
    const remote = snap.exists() ? normalizePayload(snap.data()) : emptyPayload();
    const decision = resolveMerged(remote);
    if (!decision || decision.write === false) {
      return {
        written: false,
        data: decision?.data != null ? decision.data : remote,
        remote,
      };
    }
    const payload = toFirestorePayload(decision.data);
    transaction.set(ref, payload);
    return { written: true, data: payload, remote };
  });
}

/**
 * Live listener on the shared space doc. Returns an unsubscribe fn.
 * @param {string} spaceId
 * @param {(data: object) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export async function watchRemoteNotes(spaceId, onData, onError) {
  await initFirebase();
  requireSignedIn();
  return onSnapshot(
    spaceRef(spaceId || SHARED_SPACE_ID),
    (snap) => {
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

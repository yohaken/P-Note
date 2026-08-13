import { STORAGE_KEYS } from './config.js?v=154';
import { initFirebase, getDb, auth } from './firebase.js?v=154';
import {
  doc,
  getDoc,
  setDoc,
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
  };
}

function normalizePayload(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    version: Number(data.version) || 8,
    updatedAt: data.updatedAt || new Date().toISOString(),
    tags: Array.isArray(data.tags) ? data.tags : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    workspaces: Array.isArray(data.workspaces) ? data.workspaces : [],
    notepads: Array.isArray(data.notepads) ? data.notepads : [],
    calorie: data.calorie && typeof data.calorie === 'object' ? data.calorie : null,
  };
}

/** Strip undefined (Firestore rejects them) and non-JSON values. */
function toFirestorePayload(data) {
  const normalized = normalizePayload(data);
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

import { CONFIG, STORAGE_KEYS } from './config.js?v=149';

/**
 * Talks to the backend notes API (Firestore-backed database).
 * One shared cloud space for all devices — no sync code to copy.
 * Local-first: paint from localStorage immediately, then warm/sync
 * Firestore in the background (merge by per-note / notepad updatedAt).
 */

/** Fixed personal space — phone + desktop always use this Firestore doc. */
export const SHARED_SPACE_ID = 'sp-pnote-shared';

const SPACE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const REQUEST_TIMEOUT_MS = 8000;
const PREV_SPACE_KEY = 'pnote_prev_space_id';

function persistSharedSpaceId() {
  const previous = localStorage.getItem(STORAGE_KEYS.SPACE_ID);
  if (
    previous &&
    previous !== SHARED_SPACE_ID &&
    SPACE_RE.test(previous) &&
    !localStorage.getItem(PREV_SPACE_KEY)
  ) {
    // Keep once so bootstrap can merge the old device space into shared.
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

/** Previous per-device space id (if any), for one-shot migrate into shared. */
export function getPreviousSpaceId() {
  const prev = localStorage.getItem(PREV_SPACE_KEY);
  return prev && SPACE_RE.test(prev) && prev !== SHARED_SPACE_ID ? prev : null;
}

export function clearPreviousSpaceId() {
  localStorage.removeItem(PREV_SPACE_KEY);
}

function apiUrl(spaceId) {
  return `${CONFIG.API_BASE_URL}/api/spaces/${encodeURIComponent(spaceId)}/notes`;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, mode: 'cors' });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRemoteNotes(spaceId) {
  const res = await fetchWithTimeout(apiUrl(spaceId), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`GET failed (${res.status})`);
  }
  return res.json();
}

export async function pushRemoteNotes(spaceId, data) {
  const res = await fetchWithTimeout(apiUrl(spaceId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`PUT failed (${res.status})`);
  }
  return res.json();
}

export async function checkDbOnline() {
  try {
    const res = await fetchWithTimeout(`${CONFIG.API_BASE_URL}/api/db-status`);
    if (!res.ok) return false;
    const body = await res.json();
    return Boolean(body.ok);
  } catch {
    return false;
  }
}

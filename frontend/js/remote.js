import { CONFIG, STORAGE_KEYS } from './config.js?v=51';

/**
 * Talks to the backend notes API (Firestore-backed database).
 * Sync code is shared with Calorie (one space id for the whole app).
 * localStorage is kept only as an offline cache/fallback.
 */

const SPACE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const REQUEST_TIMEOUT_MS = 8000;

function randomSpaceId() {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `sp-${rand.slice(0, 20)}`;
}

function persistSpaceId(id) {
  localStorage.setItem(STORAGE_KEYS.SPACE_ID, id);
  localStorage.setItem(STORAGE_KEYS.LEGACY_CALORIE_SPACE_ID, id);
  return id;
}

export function getSpaceId() {
  const primary = localStorage.getItem(STORAGE_KEYS.SPACE_ID);
  if (primary && SPACE_RE.test(primary)) {
    return persistSpaceId(primary);
  }
  const legacy = localStorage.getItem(STORAGE_KEYS.LEGACY_CALORIE_SPACE_ID);
  if (legacy && SPACE_RE.test(legacy)) {
    return persistSpaceId(legacy);
  }
  return persistSpaceId(randomSpaceId());
}

export function setSpaceId(id) {
  const trimmed = String(id || '').trim();
  if (!SPACE_RE.test(trimmed)) {
    throw new Error('รหัสซิงค์ต้องเป็น A-Z a-z 0-9 - _ ยาว 6-64 ตัว');
  }
  return persistSpaceId(trimmed);
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

/**
 * Gym photos for the muscle log (e.g. the weight stack on a machine), one or more per
 * muscle row and day. Images live in Cloud Storage under the row/day path; the index is a
 * listing of that prefix cached in localStorage, so the synced Firestore payload is untouched.
 */
import { CONFIG } from './config.js?v=334';
import { getSpaceId } from './remote.js?v=334';
import { deleteCloudFile, getDownloadUrl } from './files.js?v=334';

const INDEX_KEY = 'pnote_mphoto_index';
const REQUEST_TIMEOUT_MS = 20000;
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.82;

/** @typedef {{ storagePath: string, rowId: string, date: string, at: number, size?: number }} MusclePhoto */

/** @type {MusclePhoto[]} newest first */
let index = readCachedIndex();
let refreshing = null;
const listeners = new Set();

function readCachedIndex() {
  try {
    const v = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
    return Array.isArray(v) ? v.filter((p) => p && typeof p.storagePath === 'string') : [];
  } catch {
    return [];
  }
}

function setIndex(next) {
  const sorted = sortPhotos(next);
  const json = JSON.stringify(sorted);
  if (json === JSON.stringify(index)) return;
  index = sorted;
  try { localStorage.setItem(INDEX_KEY, json); } catch { /* quota: keep in memory */ }
  listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

function sortPhotos(list) {
  return [...list].sort((a, b) => (b.date === a.date ? b.at - a.at : b.date < a.date ? -1 : 1));
}

function apiBase() {
  return String(CONFIG.API_BASE_URL || '').replace(/\/$/, '');
}

function spaceUrl(suffix) {
  return `${apiBase()}/api/spaces/${encodeURIComponent(getSpaceId())}/${suffix}`;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      mode: 'cors',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!res.ok) {
      const err = new Error(`mphoto_api_${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function onMusclePhotosChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Photos of one row, newest first (all rows when rowId is empty). */
export function musclePhotosFor(rowId) {
  return rowId ? index.filter((p) => p.rowId === rowId) : [...index];
}

export function hasMusclePhoto(rowId, date) {
  return index.some((p) => p.rowId === rowId && (!date || p.date === date));
}

/** Set of row ids with at least one photo, and of "rowId|date" keys. */
export function musclePhotoKeys() {
  const rows = new Set();
  const cells = new Set();
  index.forEach((p) => {
    rows.add(p.rowId);
    cells.add(`${p.rowId}|${p.date}`);
  });
  return { rows, cells };
}

let lastRefreshAt = 0;

/** Re-list from the server (one request); keeps the cached index when offline. `minAgeMs` skips a recent refresh. */
export function refreshMusclePhotos({ minAgeMs = 0 } = {}) {
  if (refreshing) return refreshing;
  if (minAgeMs && Date.now() - lastRefreshAt < minAgeMs) return Promise.resolve(true);
  lastRefreshAt = Date.now();
  refreshing = (async () => {
    try {
      const { photos } = await fetchJson(spaceUrl('muscle-photos'));
      if (Array.isArray(photos)) setIndex(photos);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Downscale to a JPEG that still shows the plate numbers clearly (~200–500 KB). */
export async function compressPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image_decode'));
      el.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('image_encode');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Compress and upload one photo for a row/day; the index updates right away.
 * @returns {Promise<MusclePhoto>}
 */
export async function uploadMusclePhoto(file, { rowId, date }) {
  const blob = await compressPhoto(file);
  const meta = await fetchJson(spaceUrl('muscle-photos/upload-url'), {
    method: 'POST',
    body: JSON.stringify({ rowId, date, size: blob.size }),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(meta.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`upload_failed_${res.status}`);
  } finally {
    clearTimeout(timer);
  }
  const photo = { storagePath: meta.storagePath, rowId, date, at: meta.at || Date.now(), size: blob.size };
  setIndex([photo, ...index.filter((p) => p.storagePath !== photo.storagePath)]);
  return photo;
}

export async function deleteMusclePhoto(storagePath) {
  await deleteCloudFile(storagePath);
  setIndex(index.filter((p) => p.storagePath !== storagePath));
}

export function musclePhotoUrl(storagePath) {
  return getDownloadUrl(storagePath);
}

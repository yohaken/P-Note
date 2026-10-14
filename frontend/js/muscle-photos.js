/**
 * Gym photos for the muscle log (e.g. the weight stack on a machine), one or more per
 * muscle row and day. Images live in Cloud Storage under the row/day path; the index is a
 * listing of that prefix cached in localStorage, so the synced Firestore payload is untouched.
 */
import { CONFIG } from './config.js?v=335';
import { getSpaceId } from './remote.js?v=335';
import { getDownloadUrl } from './files.js?v=335';

const INDEX_KEY = 'pnote_mphoto_index';
const REQUEST_TIMEOUT_MS = 20000;
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.82;

/** @typedef {{ storagePath: string, rowId: string, date: string, at: number, size?: number }} MusclePhoto */

/** @type {MusclePhoto[]} newest first */
let index = readCachedIndex();
let refreshing = null;
const listeners = new Set();
/** Local adds/deletes a listing may not reflect yet (it can start before them and land after). */
const pendingAdds = new Map();
const pendingDeletes = new Set();

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

/** Hosting → Cloud Run occasionally answers 502/503/504 or drops the connection; every call here is safe to repeat. */
async function fetchJson(url, options = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetchJsonOnce(url, options);
    } catch (err) {
      const transient = [502, 503, 504].includes(err?.status) || err?.name === 'TypeError';
      if (!transient || attempt >= 3) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

async function fetchJsonOnce(url, options = {}) {
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
      if (Array.isArray(photos)) setIndex(mergeListing(photos));
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function mergeListing(photos) {
  const listed = new Set(photos.map((p) => p.storagePath));
  for (const path of pendingAdds.keys()) if (listed.has(path)) pendingAdds.delete(path);
  for (const path of pendingDeletes) if (!listed.has(path)) pendingDeletes.delete(path);
  const kept = photos.filter((p) => !pendingDeletes.has(p.storagePath));
  return [...pendingAdds.values(), ...kept];
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

function abortError() {
  const err = new Error('upload_aborted');
  err.name = 'AbortError';
  return err;
}

/** PUT with upload progress (fetch has none). */
function putWithProgress(url, blob, { onProgress, signal }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'image/jpeg');
    xhr.timeout = 90000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload_failed_${xhr.status}`)));
    xhr.onerror = () => reject(new Error('upload_network'));
    xhr.ontimeout = () => reject(new Error('upload_timeout'));
    xhr.onabort = () => reject(abortError());
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

/**
 * Upload an already compressed JPEG for a row/day, then re-list from the server so
 * success means the photo is really stored. `onStage` gets 'upload' | 'verify'.
 * @returns {Promise<{ photo: MusclePhoto, verified: boolean }>}
 */
export async function uploadMusclePhoto(blob, { rowId, date }, { onStage, onProgress, signal } = {}) {
  onStage?.('upload');
  const meta = await fetchJson(spaceUrl('muscle-photos/upload-url'), {
    method: 'POST',
    body: JSON.stringify({ rowId, date, size: blob.size }),
  });
  if (signal?.aborted) throw abortError();
  await putWithProgress(meta.uploadUrl, blob, { onProgress, signal });
  const photo = { storagePath: meta.storagePath, rowId, date, at: meta.at || Date.now(), size: blob.size };
  pendingAdds.set(photo.storagePath, photo);
  setIndex([photo, ...index.filter((p) => p.storagePath !== photo.storagePath)]);
  onStage?.('verify');
  let listing = null;
  try {
    listing = await fetchJson(spaceUrl('muscle-photos'));
  } catch {
    return { photo, verified: false };
  }
  const photos = Array.isArray(listing?.photos) ? listing.photos : [];
  if (!photos.some((p) => p.storagePath === photo.storagePath)) {
    pendingAdds.delete(photo.storagePath);
    setIndex(index.filter((p) => p.storagePath !== photo.storagePath));
    throw new Error('upload_not_listed');
  }
  setIndex(mergeListing(photos));
  return { photo, verified: true };
}

/** Throws when the server did not confirm, so the photo stays listed. */
export async function deleteMusclePhoto(storagePath) {
  await fetchJson(spaceUrl('files/delete'), {
    method: 'POST',
    body: JSON.stringify({ storagePath }),
  });
  pendingAdds.delete(storagePath);
  pendingDeletes.add(storagePath);
  setIndex(index.filter((p) => p.storagePath !== storagePath));
}

export function musclePhotoUrl(storagePath) {
  return getDownloadUrl(storagePath);
}

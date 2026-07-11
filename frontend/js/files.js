/**
 * Full-size note file uploads to Google Cloud Storage via signed URLs.
 * Falls back silently so offline / old notes keep working with base64.
 */
import { CONFIG } from './config.js?v=106';
import { getSpaceId } from './remote.js?v=106';

const REQUEST_TIMEOUT_MS = 20000;
const downloadCache = new Map(); // storagePath -> { url, expiresAt }

function apiBase() {
  return String(CONFIG.API_BASE_URL || '').replace(/\/$/, '');
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
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const err = new Error(`files_api_${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getFilesStatus(spaceId = getSpaceId()) {
  try {
    return await fetchJson(
      `${apiBase()}/api/spaces/${encodeURIComponent(spaceId)}/files/status`,
    );
  } catch {
    return { enabled: false, maxBytes: 0 };
  }
}

/**
 * Upload a File/Blob to GCS with progress callbacks.
 * @param {File|Blob} file
 * @param {{
 *   name?: string,
 *   fileId?: string,
 *   spaceId?: string,
 *   onProgress?: (pct: number) => void,
 * }} [opts]
 * @returns {Promise<{ fileId: string, storagePath: string, name: string, mimeType: string, size: number }>}
 */
export function uploadFileToCloud(file, opts = {}) {
  const spaceId = opts.spaceId || getSpaceId();
  const name = opts.name || file.name || 'file';
  const mimeType = file.type || 'application/octet-stream';
  const size = file.size || 0;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : () => {};

  return (async () => {
    const meta = await fetchJson(
      `${apiBase()}/api/spaces/${encodeURIComponent(spaceId)}/files/upload-url`,
      {
        method: 'POST',
        body: JSON.stringify({
          fileId: opts.fileId,
          name,
          mimeType,
          size,
        }),
      },
    );

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', meta.uploadUrl);
      xhr.setRequestHeader('Content-Type', meta.mimeType || mimeType);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const pct = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
        onProgress(pct);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
          return;
        }
        const err = new Error(`upload_failed_${xhr.status}`);
        err.status = xhr.status;
        reject(err);
      };
      xhr.onerror = () => reject(new Error('upload_network'));
      xhr.onabort = () => reject(new Error('upload_aborted'));
      xhr.send(file);
    });

    return {
      fileId: meta.fileId,
      storagePath: meta.storagePath,
      name: meta.name || name,
      mimeType: meta.mimeType || mimeType,
      size,
    };
  })();
}

/**
 * Resolve a temporary download URL for a stored object.
 * @param {string} storagePath
 * @param {{ spaceId?: string }} [opts]
 */
export async function getDownloadUrl(storagePath, opts = {}) {
  const path = String(storagePath || '');
  if (!path) throw new Error('missing_path');
  const cached = downloadCache.get(path);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.url;
  }
  const spaceId = opts.spaceId || getSpaceId();
  const result = await fetchJson(
    `${apiBase()}/api/spaces/${encodeURIComponent(spaceId)}/files/download-url`,
    {
      method: 'POST',
      body: JSON.stringify({ storagePath: path }),
    },
  );
  const url = String(result.downloadUrl || '');
  const ttl = Math.max(60, Number(result.expiresInSec) || 3600);
  downloadCache.set(path, { url, expiresAt: Date.now() + ttl * 1000 });
  return url;
}

export async function deleteCloudFile(storagePath, opts = {}) {
  const path = String(storagePath || '');
  if (!path) return;
  const spaceId = opts.spaceId || getSpaceId();
  try {
    await fetchJson(`${apiBase()}/api/spaces/${encodeURIComponent(spaceId)}/files/delete`, {
      method: 'POST',
      body: JSON.stringify({ storagePath: path }),
    });
  } catch (err) {
    console.warn('delete cloud file failed', err);
  }
  downloadCache.delete(path);
}

/** Attachment shape safe to sync (prefer cloud path; keep base64 only as fallback). */
export function attachmentForSync(a) {
  if (!a || typeof a !== 'object') return null;
  const base = {
    id: String(a.id || ''),
    name: String(a.name || 'ไฟล์').slice(0, 120),
    mimeType: String(a.mimeType || 'application/octet-stream').slice(0, 120),
    size: Number.isFinite(a.size) ? a.size : 0,
    kind: a.kind === 'image' || String(a.mimeType || '').startsWith('image/') ? 'image' : 'file',
    fullRes: a.fullRes !== false,
  };
  if (a.storagePath) {
    return { ...base, storagePath: String(a.storagePath) };
  }
  if (a.data) {
    return { ...base, data: String(a.data) };
  }
  return null;
}

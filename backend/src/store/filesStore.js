import { Storage } from '@google-cloud/storage';
import { config } from '../config.js';

const SPACE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const FILE_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
const MAX_BYTES = 40 * 1024 * 1024; // full-size originals
const UPLOAD_TTL_MS = 15 * 60 * 1000;
const DOWNLOAD_TTL_MS = 60 * 60 * 1000;

let storage = null;
let storageError = null;

function getStorage() {
  if (storage || storageError) return storage;
  try {
    storage = new Storage({ projectId: config.gcpProjectId });
  } catch (err) {
    storageError = err;
    storage = null;
  }
  return storage;
}

export function filesEnabled() {
  return Boolean(config.filesBucket);
}

export function sanitizeSpaceId(spaceId) {
  return typeof spaceId === 'string' && SPACE_RE.test(spaceId) ? spaceId : null;
}

function sanitizeFileId(fileId) {
  return typeof fileId === 'string' && FILE_ID_RE.test(fileId) ? fileId : null;
}

function sanitizeMime(mimeType) {
  const m = String(mimeType || 'application/octet-stream').trim().slice(0, 120);
  return m || 'application/octet-stream';
}

function sanitizeName(name) {
  return String(name || 'file')
    .replace(/[^\w.\u0E00-\u0E7F -]+/g, '_')
    .trim()
    .slice(0, 120) || 'file';
}

/** @returns {string|null} */
export function buildStoragePath(spaceId, fileId, name) {
  const sid = sanitizeSpaceId(spaceId);
  const fid = sanitizeFileId(fileId);
  if (!sid || !fid) return null;
  const safe = sanitizeName(name).replace(/\s+/g, '_');
  return `spaces/${sid}/${fid}/${safe}`;
}

/** Ensure path belongs to this space. */
export function assertSpacePath(spaceId, storagePath) {
  const sid = sanitizeSpaceId(spaceId);
  const path = String(storagePath || '');
  if (!sid || !path.startsWith(`spaces/${sid}/`)) {
    const err = new Error('Invalid storage path');
    err.status = 400;
    throw err;
  }
  if (path.includes('..') || path.length > 400) {
    const err = new Error('Invalid storage path');
    err.status = 400;
    throw err;
  }
  return path;
}

function requireBucket() {
  if (!config.filesBucket) {
    const err = new Error('File storage not configured');
    err.status = 503;
    throw err;
  }
  const client = getStorage();
  if (!client) {
    const err = new Error('File storage unavailable');
    err.status = 503;
    throw err;
  }
  return client.bucket(config.filesBucket);
}

/**
 * @param {{ spaceId: string, fileId?: string, name: string, mimeType: string, size?: number }} input
 */
export async function createUploadUrl(input) {
  const spaceId = sanitizeSpaceId(input.spaceId);
  if (!spaceId) {
    const err = new Error('Invalid space id');
    err.status = 400;
    throw err;
  }
  const size = Number(input.size);
  if (Number.isFinite(size) && size > MAX_BYTES) {
    const err = new Error('File too large');
    err.status = 413;
    throw err;
  }

  const fileId =
    sanitizeFileId(input.fileId) ||
    `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const mimeType = sanitizeMime(input.mimeType);
  const name = sanitizeName(input.name);
  const storagePath = buildStoragePath(spaceId, fileId, name);
  const bucket = requireBucket();
  const file = bucket.file(storagePath);

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + UPLOAD_TTL_MS,
    contentType: mimeType,
  });

  return {
    fileId,
    storagePath,
    uploadUrl,
    mimeType,
    name,
    maxBytes: MAX_BYTES,
    expiresInSec: Math.floor(UPLOAD_TTL_MS / 1000),
  };
}

/**
 * @param {{ spaceId: string, storagePath: string }} input
 */
export async function createDownloadUrl(input) {
  const storagePath = assertSpacePath(input.spaceId, input.storagePath);
  const bucket = requireBucket();
  const file = bucket.file(storagePath);
  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + DOWNLOAD_TTL_MS,
  });
  return {
    storagePath,
    downloadUrl: uploadUrl,
    expiresInSec: Math.floor(DOWNLOAD_TTL_MS / 1000),
  };
}

/**
 * @param {{ spaceId: string, storagePath: string }} input
 */
export async function deleteStoredFile(input) {
  const storagePath = assertSpacePath(input.spaceId, input.storagePath);
  const bucket = requireBucket();
  try {
    await bucket.file(storagePath).delete({ ignoreNotFound: true });
  } catch (err) {
    console.warn('delete file failed', storagePath, err?.message || err);
  }
  return { ok: true, storagePath };
}

export const FILES_MAX_BYTES = MAX_BYTES;

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Storage } from '@google-cloud/storage';
import { config } from '../config.js';

const SPACE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const FILE_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
const ROW_ID_RE = /^[A-Za-z0-9_-]{2,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BYTES = 40 * 1024 * 1024; // full-size originals
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const UPLOAD_TTL_MS = 15 * 60 * 1000;
const DOWNLOAD_TTL_MS = 60 * 60 * 1000;
const PHOTO_DIR = 'mphoto';

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

function localMode() {
  return Boolean(config.filesLocalDir);
}

export function filesEnabled() {
  return localMode() || Boolean(config.filesBucket);
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

function badRequest(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function newFileId() {
  return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
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
  const p = String(storagePath || '');
  if (!sid || !p.startsWith(`spaces/${sid}/`)) throw badRequest('Invalid storage path');
  if (p.includes('..') || p.length > 400) throw badRequest('Invalid storage path');
  return p;
}

function requireBucket() {
  if (!config.filesBucket) throw badRequest('File storage not configured', 503);
  const client = getStorage();
  if (!client) throw badRequest('File storage unavailable', 503);
  return client.bucket(config.filesBucket);
}

/* Local dev store: same API, files under FILES_LOCAL_DIR, served by /api/local-files/*. */

export function localFilePath(storagePath) {
  const p = String(storagePath || '');
  if (!localMode() || !p.startsWith('spaces/') || p.includes('..')) return null;
  return path.join(config.filesLocalDir, p);
}

function localUrl(baseUrl, storagePath) {
  return `${String(baseUrl || '').replace(/\/$/, '')}/api/local-files/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
}

async function signedWriteUrl(storagePath, mimeType, baseUrl) {
  if (localMode()) return localUrl(baseUrl, storagePath);
  const [url] = await requireBucket().file(storagePath).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + UPLOAD_TTL_MS,
    contentType: mimeType,
  });
  return url;
}

/**
 * @param {{ spaceId: string, fileId?: string, name: string, mimeType: string, size?: number, baseUrl?: string }} input
 */
export async function createUploadUrl(input) {
  const spaceId = sanitizeSpaceId(input.spaceId);
  if (!spaceId) throw badRequest('Invalid space id');
  const size = Number(input.size);
  if (Number.isFinite(size) && size > MAX_BYTES) throw badRequest('File too large', 413);

  const fileId = sanitizeFileId(input.fileId) || newFileId();
  const mimeType = sanitizeMime(input.mimeType);
  const name = sanitizeName(input.name);
  const storagePath = buildStoragePath(spaceId, fileId, name);
  const uploadUrl = await signedWriteUrl(storagePath, mimeType, input.baseUrl);

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
 * @param {{ spaceId: string, storagePath: string, baseUrl?: string }} input
 */
export async function createDownloadUrl(input) {
  const storagePath = assertSpacePath(input.spaceId, input.storagePath);
  let downloadUrl;
  if (localMode()) {
    downloadUrl = localUrl(input.baseUrl, storagePath);
  } else {
    [downloadUrl] = await requireBucket().file(storagePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + DOWNLOAD_TTL_MS,
    });
  }
  return {
    storagePath,
    downloadUrl,
    expiresInSec: Math.floor(DOWNLOAD_TTL_MS / 1000),
  };
}

/**
 * @param {{ spaceId: string, storagePath: string }} input
 */
export async function deleteStoredFile(input) {
  const storagePath = assertSpacePath(input.spaceId, input.storagePath);
  try {
    if (localMode()) await fs.rm(localFilePath(storagePath), { force: true });
    else await requireBucket().file(storagePath).delete({ ignoreNotFound: true });
  } catch (err) {
    console.warn('delete file failed', storagePath, err?.message || err);
  }
  return { ok: true, storagePath };
}

/*
 * Gym photos for the muscle log. The object path carries the row and the day
 * (spaces/{space}/mphoto/{rowId}/{date}/{fileId}.jpg), so nothing is added to the
 * synced Firestore payload and listing the prefix is the whole index.
 */

function photoPrefix(spaceId) {
  return `spaces/${spaceId}/${PHOTO_DIR}/`;
}

/** @returns {{ rowId: string, date: string, fileId: string }|null} */
function parsePhotoPath(spaceId, storagePath) {
  const rest = String(storagePath || '').slice(photoPrefix(spaceId).length);
  const m = /^([A-Za-z0-9_-]+)\/(\d{4}-\d{2}-\d{2})\/([A-Za-z0-9_-]+)\.jpg$/.exec(rest);
  if (!m || !storagePath.startsWith(photoPrefix(spaceId))) return null;
  return { rowId: m[1], date: m[2], fileId: m[3] };
}

/** Upload time from the fileId (f + base36 ms), so listing needs no metadata reads. */
function fileIdTime(fileId) {
  const ms = parseInt(String(fileId).slice(1, 9), 36);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * @param {{ spaceId: string, rowId: string, date: string, size?: number, baseUrl?: string }} input
 */
export async function createMusclePhotoUploadUrl(input) {
  const spaceId = sanitizeSpaceId(input.spaceId);
  if (!spaceId) throw badRequest('Invalid space id');
  const rowId = String(input.rowId || '');
  const date = String(input.date || '');
  if (!ROW_ID_RE.test(rowId) || !DATE_RE.test(date)) throw badRequest('Invalid row or date');
  const size = Number(input.size);
  if (Number.isFinite(size) && size > PHOTO_MAX_BYTES) throw badRequest('Photo too large', 413);
  const fileId = newFileId();
  const storagePath = `${photoPrefix(spaceId)}${rowId}/${date}/${fileId}.jpg`;
  const uploadUrl = await signedWriteUrl(storagePath, 'image/jpeg', input.baseUrl);
  return { storagePath, uploadUrl, mimeType: 'image/jpeg', rowId, date, at: fileIdTime(fileId) };
}

async function listLocal(prefix) {
  const root = localFilePath(prefix);
  const out = [];
  const walk = async (dir) => {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else {
        const stat = await fs.stat(full);
        out.push({ name: path.relative(config.filesLocalDir, full).split(path.sep).join('/'), size: stat.size });
      }
    }
  };
  await walk(root);
  return out;
}

/** Every gym photo in the space, newest first. */
export async function listMusclePhotos(input) {
  const spaceId = sanitizeSpaceId(input.spaceId);
  if (!spaceId) throw badRequest('Invalid space id');
  const prefix = photoPrefix(spaceId);
  let objects;
  if (localMode()) {
    objects = await listLocal(prefix);
  } else {
    const [files] = await requireBucket().getFiles({ prefix, autoPaginate: true });
    objects = files.map((f) => ({ name: f.name, size: Number(f.metadata?.size) || 0 }));
  }
  const photos = objects
    .map((o) => {
      const p = parsePhotoPath(spaceId, o.name);
      return p ? { storagePath: o.name, rowId: p.rowId, date: p.date, at: fileIdTime(p.fileId), size: o.size } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.date === a.date ? b.at - a.at : b.date < a.date ? -1 : 1));
  return { photos };
}

export const FILES_MAX_BYTES = MAX_BYTES;
export const MUSCLE_PHOTO_MAX_BYTES = PHOTO_MAX_BYTES;

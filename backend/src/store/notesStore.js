import { Firestore } from '@google-cloud/firestore';
import { config } from '../config.js';

/**
 * Notes are stored in Firestore (a cloud database), NOT as a JSON file.
 * Each anonymous "space" (per-device id, no login required yet) maps to one
 * document in the `spaces` collection holding the full notes payload.
 *
 * Locally, set FIRESTORE_EMULATOR_HOST (e.g. localhost:8090) and the client
 * talks to the Firestore emulator with no credentials. On Cloud Run it uses
 * the default service account credentials automatically.
 */

const COLLECTION = 'spaces';

let firestore = null;
let initError = null;

function getFirestore() {
  if (firestore || initError) {
    return firestore;
  }
  try {
    firestore = new Firestore({
      projectId: config.gcpProjectId,
      ignoreUndefinedProperties: true,
    });
  } catch (error) {
    initError = error;
    firestore = null;
  }
  return firestore;
}

export function isEmulator() {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

function emptyPayload() {
  return {
    version: 4,
    updatedAt: new Date().toISOString(),
    tags: [],
    notes: [],
  };
}

function sanitizeSpaceId(spaceId) {
  return typeof spaceId === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(spaceId)
    ? spaceId
    : null;
}

export async function getSpaceNotes(spaceId) {
  const id = sanitizeSpaceId(spaceId);
  if (!id) {
    const err = new Error('Invalid space id');
    err.status = 400;
    throw err;
  }

  const db = getFirestore();
  if (!db) {
    const err = new Error('Database unavailable');
    err.status = 503;
    throw err;
  }

  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) {
    return emptyPayload();
  }
  const data = snap.data();
  return {
    version: data.version || 4,
    updatedAt: data.updatedAt || new Date().toISOString(),
    tags: Array.isArray(data.tags) ? data.tags : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
  };
}

export async function putSpaceNotes(spaceId, payload) {
  const id = sanitizeSpaceId(spaceId);
  if (!id) {
    const err = new Error('Invalid space id');
    err.status = 400;
    throw err;
  }

  const db = getFirestore();
  if (!db) {
    const err = new Error('Database unavailable');
    err.status = 503;
    throw err;
  }

  const doc = {
    version: Number(payload?.version) || 4,
    updatedAt: new Date().toISOString(),
    tags: Array.isArray(payload?.tags) ? payload.tags : [],
    notes: Array.isArray(payload?.notes) ? payload.notes : [],
  };

  await db.collection(COLLECTION).doc(id).set(doc);
  return doc;
}

export async function pingDatabase() {
  const db = getFirestore();
  if (!db) {
    return { ok: false, reason: initError?.message || 'not initialized' };
  }
  try {
    await db.collection(COLLECTION).limit(1).get();
    return { ok: true, emulator: isEmulator() };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

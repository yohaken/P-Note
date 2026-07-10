import { Firestore } from '@google-cloud/firestore';
import { config } from '../config.js';

/**
 * Calorie tracker payload per anonymous sync-code space.
 * Same space-id model as notes, separate collection so notes + calorie
 * never overwrite each other.
 *
 * Doc: calorieSpaces/{spaceId}
 * Body: { version, updatedAt, data: { [localStorageKey]: string } }
 */

const COLLECTION = 'calorieSpaces';

let firestore = null;
let initError = null;

function getDb() {
  if (firestore || initError) return firestore;
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

function sanitizeSpaceId(spaceId) {
  return typeof spaceId === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(spaceId)
    ? spaceId
    : null;
}

function emptyPayload() {
  return {
    version: 6,
    updatedAt: new Date().toISOString(),
    data: {},
  };
}

function normalizeData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== 'string' || !key.startsWith('calorieTracker:')) continue;
    if (typeof value === 'string') out[key] = value;
    else if (value != null) out[key] = JSON.stringify(value);
  }
  return out;
}

export async function getSpaceCalorie(spaceId) {
  const id = sanitizeSpaceId(spaceId);
  if (!id) {
    const err = new Error('Invalid space id');
    err.status = 400;
    throw err;
  }

  const db = getDb();
  if (!db) {
    const err = new Error('Database unavailable');
    err.status = 503;
    throw err;
  }

  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return emptyPayload();
  const data = snap.data() || {};
  return {
    version: Number(data.version) || 6,
    updatedAt: data.updatedAt || new Date().toISOString(),
    data: normalizeData(data.data),
  };
}

export async function putSpaceCalorie(spaceId, payload) {
  const id = sanitizeSpaceId(spaceId);
  if (!id) {
    const err = new Error('Invalid space id');
    err.status = 400;
    throw err;
  }

  const db = getDb();
  if (!db) {
    const err = new Error('Database unavailable');
    err.status = 503;
    throw err;
  }

  const doc = {
    version: Number(payload?.version) || 6,
    updatedAt: new Date().toISOString(),
    data: normalizeData(payload?.data),
  };

  await db.collection(COLLECTION).doc(id).set(doc);
  return doc;
}

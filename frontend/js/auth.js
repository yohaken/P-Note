import { auth, initFirebase } from './firebase.js?v=355';
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut as firebaseSignOut,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { CONFIG } from './config.js?v=355';

const GATE_KEY = 'pnote_gate';
const GATE_VERIFIER_KEY = 'pnote_gate_v';
const GATE_OK = 'v2:ok';
const PBKDF2_ITER = 150000;
/** sessionStorage — survives reload for one paint so earlyPinGate stays locked */
export const JUST_LOCKED_KEY = 'pnote_just_locked';

/** While true, watchAuth never recreates a cloud session. */
let authSuppressed = false;
let cloudPending = false;
/** Raw PIN held briefly for background cloud exchange after local unlock. */
let pendingPin = null;

function syncTestHook() {
  try {
    return typeof window !== 'undefined' ? window.__PNOTE_SYNC_TEST__ : null;
  } catch {
    return null;
  }
}

function apiBase() {
  return String(CONFIG.API_BASE_URL || '').replace(/\/$/, '');
}

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
  const clean = String(hex || '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function derivePinHash(pin, saltBuf, iter = PBKDF2_ITER) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(pin)),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations: iter, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return bufToHex(bits);
}

function readVerifier() {
  try {
    const raw = localStorage.getItem(GATE_VERIFIER_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v.salt !== 'string' || typeof v.hash !== 'string') return null;
    const iter = Number(v.iter) || PBKDF2_ITER;
    return { salt: v.salt, iter, hash: v.hash };
  } catch {
    return null;
  }
}

async function writeVerifier(pin) {
  // Skip re-derive when the stored verifier already matches this PIN.
  if (await verifyLocalPin(pin)) return readVerifier();
  const saltBuf = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePinHash(pin, saltBuf, PBKDF2_ITER);
  const payload = {
    salt: bufToHex(saltBuf),
    iter: PBKDF2_ITER,
    hash,
  };
  try {
    localStorage.setItem(GATE_VERIFIER_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
  return payload;
}

async function verifyLocalPin(pin) {
  const v = readVerifier();
  if (!v) return false;
  const got = await derivePinHash(pin, hexToBuf(v.salt), v.iter);
  return got === v.hash;
}

function setGateOk() {
  try {
    localStorage.setItem(GATE_KEY, GATE_OK);
  } catch {
    /* ignore */
  }
}

function markUnlockedLocally(pin) {
  authSuppressed = false;
  pendingPin = String(pin || '');
  try {
    sessionStorage.removeItem(JUST_LOCKED_KEY);
  } catch {
    /* ignore */
  }
  setGateOk();
}

export function isAuthSuppressed() {
  return authSuppressed;
}

export function setAuthSuppressed(value) {
  authSuppressed = Boolean(value);
}

export function isCloudPending() {
  return cloudPending;
}

export function isPinUnlocked() {
  if (authSuppressed) return false;
  try {
    if (sessionStorage.getItem(JUST_LOCKED_KEY) === '1') return false;
  } catch {
    /* ignore */
  }
  try {
    const g = localStorage.getItem(GATE_KEY);
    return g === GATE_OK || (Boolean(g) && g.indexOf('v1:') === 0);
  } catch {
    return false;
  }
}

function v1Suffix() {
  try {
    const g = localStorage.getItem(GATE_KEY) || '';
    if (g.indexOf('v1:') === 0) return g.slice(3);
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * Exchange PIN for a Firebase custom-token session.
 * @returns {Promise<import('firebase/auth').User|null>}
 */
export async function exchangePinForSession(pin) {
  const hook = syncTestHook();
  if (hook && hook.skipAuth) {
    return fakeTestUser();
  }
  try {
    await initFirebase();
    const res = await fetch(`${apiBase()}/api/auth/pin`, {
      method: 'POST',
      mode: 'cors',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: String(pin || '') }),
    });
    if (res.status === 401) {
      cloudPending = true;
      return null;
    }
    if (res.status === 429) {
      cloudPending = true;
      return null;
    }
    if (!res.ok) {
      cloudPending = true;
      return null;
    }
    const data = await res.json();
    const customToken = data?.customToken;
    if (!customToken) {
      cloudPending = true;
      return null;
    }
    const cred = await signInWithCustomToken(auth, customToken);
    cloudPending = false;
    pendingPin = null;
    return cred.user;
  } catch {
    cloudPending = true;
    return null;
  }
}

/**
 * Unlock with PIN. Uses device-local PBKDF2 verifier when present (offline);
 * otherwise (or on local fail while online) POSTs to /api/auth/pin.
 * @returns {Promise<boolean>}
 */
export async function unlockWithPin(raw) {
  const pin = String(raw ?? '').trim();
  if (!pin) return false;

  const hook = syncTestHook();
  if (hook && typeof hook.verifyPin === 'function') {
    const ok = await hook.verifyPin(pin);
    if (!ok) return false;
    markUnlockedLocally(pin);
    return true;
  }

  const hasVerifier = Boolean(readVerifier());
  if (hasVerifier) {
    const localOk = await verifyLocalPin(pin);
    if (localOk) {
      markUnlockedLocally(pin);
      // Background cloud exchange — never block local use.
      if (!auth?.currentUser) {
        void exchangePinForSession(pin).then(async (user) => {
          if (user) {
            try {
              await writeVerifier(pin);
            } catch {
              /* ignore */
            }
          }
        });
      }
      return true;
    }
  }

  // No verifier, or local check failed — try the server (needs network).
  try {
    await initFirebase();
    const res = await fetch(`${apiBase()}/api/auth/pin`, {
      method: 'POST',
      mode: 'cors',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (res.status === 401) {
      throw new Error('รหัสไม่ถูกต้อง');
    }
    if (res.status === 429) {
      throw new Error('ลองผิดหลายครั้ง · รอสักครู่แล้วลองใหม่');
    }
    if (!res.ok) {
      throw new Error(
        hasVerifier
          ? 'รหัสไม่ถูกต้อง'
          : 'ต้องต่อเน็ตเพื่อปลดล็อกครั้งแรก',
      );
    }
    const data = await res.json();
    const customToken = data?.customToken;
    if (!customToken) {
      throw new Error('ต้องต่อเน็ตเพื่อปลดล็อกครั้งแรก');
    }
    await signInWithCustomToken(auth, customToken);
    await writeVerifier(pin);
    markUnlockedLocally(pin);
    cloudPending = false;
    pendingPin = null;
    return true;
  } catch (err) {
    if (
      err?.message === 'รหัสไม่ถูกต้อง' ||
      err?.message === 'ลองผิดหลายครั้ง · รอสักครู่แล้วลองใหม่' ||
      err?.message === 'ต้องต่อเน็ตเพื่อปลดล็อกครั้งแรก'
    ) {
      throw err;
    }
    if (!hasVerifier) {
      throw new Error('ต้องต่อเน็ตเพื่อปลดล็อกครั้งแรก');
    }
    throw new Error('รหัสไม่ถูกต้อง');
  }
}

export function clearPinUnlock() {
  try {
    localStorage.removeItem(GATE_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(GATE_VERIFIER_KEY);
  } catch {
    /* ignore */
  }
  pendingPin = null;
}

function mapAuthError(error) {
  const code = error?.code || '';
  const msg = String(error?.message || '');
  if (code === 'auth/network-request-failed') {
    return new Error('เน็ตมีปัญหา · ลองใหม่');
  }
  return new Error(msg || 'เข้าสู่ระบบไม่สำเร็จ');
}

function fakeTestUser() {
  const hook = syncTestHook();
  if (hook && typeof hook.getUser === 'function') return hook.getUser();
  return { uid: 'pnote-sync-test', isAnonymous: true };
}

async function migrateV1Marker() {
  const pin = v1Suffix();
  if (!pin) return;
  if (!readVerifier()) {
    try {
      await writeVerifier(pin);
    } catch {
      /* ignore */
    }
  }
  const user = await exchangePinForSession(pin);
  if (user) {
    setGateOk();
    pendingPin = null;
  }
  // If offline/exchange failed, keep v1: marker until next boot.
}

/** Drop persisted Firebase anonymous sessions (build 353); rules deny anon. */
async function dropStaleAnonymous() {
  if (!auth?.currentUser?.isAnonymous) return false;
  try {
    await firebaseSignOut(auth);
  } catch {
    /* ignore */
  }
  return true;
}

async function ensureCloudSession() {
  const hook = syncTestHook();
  if (hook && hook.skipAuth) {
    return fakeTestUser();
  }
  await initFirebase();
  await dropStaleAnonymous();
  if (auth.currentUser) return auth.currentUser;

  const pin = pendingPin || v1Suffix();
  if (!pin) {
    cloudPending = true;
    return null;
  }
  return exchangePinForSession(pin);
}

/**
 * PIN unlocked locally but no Firebase session and no PIN left to exchange
 * (reload cleared pendingPin; gate is already v2:ok). Caller should offer
 * a re-link chip — never block local use.
 */
export function needsCloudRelink() {
  if (!isPinUnlocked()) return false;
  const hook = syncTestHook();
  if (hook && hook.skipAuth) return false;
  try {
    if (auth?.currentUser && !auth.currentUser.isAnonymous) return false;
  } catch {
    /* ignore */
  }
  if (pendingPin || v1Suffix()) return false;
  return true;
}

/** No Google redirect flow anymore — kept so boot/app imports stay stable. */
export function isAuthRedirectPending() {
  return false;
}

export async function handleAuthRedirect() {
  const hook = syncTestHook();
  if (hook && hook.skipAuth) return null;
  await initFirebase();
  return null;
}

/**
 * Unlock with PIN then ensure a Firebase custom-token session for Firestore.
 * @param {string} [pin] — if omitted, uses already-unlocked gate from localStorage
 */
export async function startLogin(pin) {
  try {
    if (pin != null && String(pin).length) {
      const ok = await unlockWithPin(pin);
      if (!ok) {
        throw new Error('รหัสไม่ถูกต้อง');
      }
    } else if (!isPinUnlocked()) {
      throw new Error('ใส่รหัสก่อน');
    } else if (String(localStorage.getItem(GATE_KEY) || '').indexOf('v1:') === 0) {
      await migrateV1Marker();
    }
    authSuppressed = false;
    const user = await ensureCloudSession();
    return user;
  } catch (error) {
    if (
      error?.message === 'รหัสไม่ถูกต้อง' ||
      error?.message === 'ใส่รหัสก่อน' ||
      error?.message === 'ลองผิดหลายครั้ง · รอสักครู่แล้วลองใหม่' ||
      error?.message === 'ต้องต่อเน็ตเพื่อปลดล็อกครั้งแรก'
    ) {
      throw error;
    }
    throw mapAuthError(error);
  }
}

/** Returns current session user only when PIN gate is unlocked. */
export async function getAllowedUser() {
  if (!isPinUnlocked() || authSuppressed) return null;
  try {
    if (String(localStorage.getItem(GATE_KEY) || '').indexOf('v1:') === 0) {
      await migrateV1Marker();
    }
    return await ensureCloudSession();
  } catch (error) {
    console.warn('getAllowedUser session failed', error);
    return null;
  }
}

export function watchAuth(callback) {
  const hook = syncTestHook();
  if (hook && hook.skipAuth) {
    if (!authSuppressed && isPinUnlocked()) {
      Promise.resolve().then(() => callback(fakeTestUser()));
    } else {
      Promise.resolve().then(() => callback(null));
    }
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (authSuppressed || !isPinUnlocked()) {
      callback(null);
      return;
    }
    if (user && user.isAnonymous) {
      await dropStaleAnonymous();
      return;
    }
    if (!user) {
      try {
        const next = await ensureCloudSession();
        if (authSuppressed || !isPinUnlocked()) {
          callback(null);
          return;
        }
        callback(next);
      } catch {
        callback(null);
      }
      return;
    }
    callback(user);
  });
}

/**
 * Forget device PIN + Firebase session.
 * Callers should close settings and show the PIN overlay (z-index above settings).
 */
export async function signOut() {
  authSuppressed = true;
  clearPinUnlock();
  try {
    sessionStorage.setItem(JUST_LOCKED_KEY, '1');
  } catch {
    /* ignore */
  }
  const hook = syncTestHook();
  if (hook && hook.skipAuth) return;
  await initFirebase();
  try {
    await firebaseSignOut(auth);
  } catch {
    /* ignore */
  }
}

import { auth, initFirebase } from './firebase.js?v=227';
import {
  onAuthStateChanged,
  signInAnonymously,
  signOut as firebaseSignOut,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

/** App entry PIN — shown before the app; remembered in localStorage. */
export const APP_PIN = '0884818817';
const GATE_KEY = 'pnote_gate';
/** sessionStorage — survives reload for one paint so earlyPinGate stays locked */
export const JUST_LOCKED_KEY = 'pnote_just_locked';

/** While true, watchAuth never recreates an anonymous session. */
let authSuppressed = false;

function gateToken() {
  return `v1:${APP_PIN}`;
}

export function isAuthSuppressed() {
  return authSuppressed;
}

export function setAuthSuppressed(value) {
  authSuppressed = Boolean(value);
}

export function isPinUnlocked() {
  if (authSuppressed) return false;
  try {
    if (sessionStorage.getItem(JUST_LOCKED_KEY) === '1') return false;
  } catch {
    /* ignore */
  }
  try {
    return localStorage.getItem(GATE_KEY) === gateToken();
  } catch {
    return false;
  }
}

export function unlockWithPin(raw) {
  const pin = String(raw ?? '').trim();
  if (pin !== APP_PIN) return false;
  authSuppressed = false;
  try {
    sessionStorage.removeItem(JUST_LOCKED_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(GATE_KEY, gateToken());
  } catch {
    /* ignore quota */
  }
  return true;
}

export function clearPinUnlock() {
  try {
    localStorage.removeItem(GATE_KEY);
  } catch {
    /* ignore */
  }
}

function mapAuthError(error) {
  const code = error?.code || '';
  const msg = String(error?.message || '');
  if (code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed') {
    return new Error('ยังไม่ได้เปิด Anonymous Sign-In ใน Firebase');
  }
  if (code === 'auth/network-request-failed') {
    return new Error('เน็ตมีปัญหา · ลองใหม่');
  }
  return new Error(msg || 'เข้าสู่ระบบไม่สำเร็จ');
}

async function ensureCloudSession() {
  await initFirebase();
  if (auth.currentUser) return auth.currentUser;
  const result = await signInAnonymously(auth);
  return result.user;
}

/** No Google redirect flow anymore — kept so boot/app imports stay stable. */
export function isAuthRedirectPending() {
  return false;
}

export async function handleAuthRedirect() {
  await initFirebase();
  return null;
}

/**
 * Unlock with PIN then ensure a Firebase session (anonymous) for Firestore.
 * @param {string} [pin] — if omitted, uses already-unlocked gate from localStorage
 */
export async function startLogin(pin) {
  try {
    if (pin != null && String(pin).length) {
      if (!unlockWithPin(pin)) {
        throw new Error('รหัสไม่ถูกต้อง');
      }
    } else if (!isPinUnlocked()) {
      throw new Error('ใส่รหัสก่อน');
    }
    authSuppressed = false;
    return ensureCloudSession();
  } catch (error) {
    if (error?.message === 'รหัสไม่ถูกต้อง' || error?.message === 'ใส่รหัสก่อน') throw error;
    throw mapAuthError(error);
  }
}

/** Returns current session user only when PIN gate is unlocked. */
export async function getAllowedUser() {
  if (!isPinUnlocked() || authSuppressed) return null;
  try {
    return await ensureCloudSession();
  } catch (error) {
    console.warn('getAllowedUser session failed', error);
    return null;
  }
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (authSuppressed || !isPinUnlocked()) {
      callback(null);
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
  await initFirebase();
  try {
    await firebaseSignOut(auth);
  } catch {
    /* ignore */
  }
}

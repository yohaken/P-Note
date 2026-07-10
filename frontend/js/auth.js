import { CONFIG, STORAGE_KEYS } from './config.js?v=41';
import { auth, initFirebase } from './firebase.js?v=41';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const AUTH_REDIRECT_FLAG = 'pnote_auth_redirect';

// Google OAuth access tokens live ~1h; refresh a little early to be safe.
const TOKEN_TTL_MS = 55 * 60 * 1000;

function cacheAccessToken(token) {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(Date.now() + TOKEN_TTL_MS));
}

function getCachedAccessToken() {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const expiry = Number(localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY) || 0);
  if (token && expiry > Date.now()) {
    return token;
  }
  return null;
}

function markRedirectPending() {
  sessionStorage.setItem(AUTH_REDIRECT_FLAG, '1');
}

export function isAuthRedirectPending() {
  return sessionStorage.getItem(AUTH_REDIRECT_FLAG) === '1';
}

function clearRedirectPending() {
  sessionStorage.removeItem(AUTH_REDIRECT_FLAG);
}

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  provider.addScope('email');
  return provider;
}

/** Popups are unreliable on phones/tablets and in installed PWAs — use full-page redirect. */
export function shouldPreferRedirectAuth() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return false;
  }
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod|Android/i.test(ua)) {
    return true;
  }
  if (window.matchMedia?.('(display-mode: standalone)').matches) {
    return true;
  }
  return false;
}

function mapAuthError(error) {
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/redirect-cancelled-by-user') {
    return new Error('การล็อกอินถูกยกเลิก');
  }
  if (code === 'auth/popup-blocked') {
    return new Error('เปิดหน้าต่างล็อกอินไม่ได้ — กำลังลองวิธีอื่น...');
  }
  if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
    return new Error('ยังไม่ได้เปิด Google Sign-In ใน Firebase Console — ดู docs/PHASE2_FIREBASE_AUTH.md');
  }
  return new Error(error?.message || 'การล็อกอินล้มเหลว');
}

function tokenFromCredential(result) {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  return credential?.accessToken || null;
}

export function clearSession() {
  clearRedirectPending();
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

async function verifyEmail(email) {
  if (!CONFIG.ALLOWED_EMAILS.includes(email)) {
    await signOut();
    throw new Error('Access Denied: บัญชีนี้ไม่มีสิทธิ์ใช้งาน');
  }
  return email;
}

async function waitForAuthUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

async function finalizeSignInResult(result) {
  const accessToken = tokenFromCredential(result);
  if (!accessToken) {
    throw new Error('ไม่สามารถเข้าถึง Google Drive ได้ กรุณาลองใหม่');
  }
  await verifyEmail(result.user.email);
  cacheAccessToken(accessToken);
  clearRedirectPending();
  return accessToken;
}

async function signInWithRedirectFlow() {
  markRedirectPending();
  await signInWithRedirect(auth, googleProvider());
  return null;
}

async function getDriveAccessToken() {
  const provider = googleProvider();

  // User gesture (button click): try popup first — works on many phones too.
  try {
    const result = await signInWithPopup(auth, provider);
    return finalizeSignInResult(result);
  } catch (error) {
    const code = error?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/redirect-cancelled-by-user') {
      throw error;
    }
    if (
      shouldPreferRedirectAuth()
      || code === 'auth/popup-blocked'
      || code === 'auth/cancelled-popup-request'
    ) {
      return signInWithRedirectFlow();
    }
    throw error;
  }
}

/** Call once on every page load — completes mobile redirect sign-in when returning from Google. */
export async function handleAuthRedirect() {
  await initFirebase();
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) {
      if (!isAuthRedirectPending()) {
        return null;
      }
      clearRedirectPending();
      return null;
    }
    return finalizeSignInResult(result);
  } catch (error) {
    clearRedirectPending();
    throw mapAuthError(error);
  }
}

export async function startLogin() {
  try {
    await initFirebase();
    return getDriveAccessToken();
  } catch (error) {
    clearRedirectPending();
    throw mapAuthError(error);
  }
}

export async function autoLogin() {
  await initFirebase();
  const user = auth.currentUser || await waitForAuthUser();
  if (!user) {
    return null;
  }

  try {
    await verifyEmail(user.email);

    const cachedToken = getCachedAccessToken();
    if (cachedToken) {
      return cachedToken;
    }

    // Firebase session exists but Drive token expired — require an explicit tap
    // (mobile browsers block popup/redirect without a user gesture).
    return null;
  } catch (error) {
    if (error.message.includes('Access Denied')) {
      throw error;
    }
    throw mapAuthError(error);
  }
}

export async function signOut() {
  try {
    await initFirebase();
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
  } catch {
    // Best-effort sign out.
  }
  clearSession();
}

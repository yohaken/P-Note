import { CONFIG } from './config.js?v=226';
import { auth, initFirebase } from './firebase.js?v=226';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const AUTH_REDIRECT_FLAG = 'pnote_auth_redirect';

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
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/** Popups are unreliable on phones/tablets and installed PWAs — use redirect. */
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
  const msg = String(error?.message || '');
  if (code === 'auth/popup-closed-by-user' || code === 'auth/redirect-cancelled-by-user') {
    return new Error('การล็อกอินถูกยกเลิก');
  }
  if (code === 'auth/popup-blocked') {
    return new Error('เปิดหน้าต่างล็อกอินไม่ได้ — กำลังลองวิธีอื่น...');
  }
  if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
    return new Error('ยังไม่ได้เปิด Google Sign-In ใน Firebase Console');
  }
  if (/redirect_uri_mismatch/i.test(msg) || /invalid.request/i.test(msg)) {
    return new Error(
      'OAuth redirect_uri_mismatch — ต้องเพิ่ม https://mynote-f1bbc.firebaseapp.com/__/auth/handler ใน Google Cloud Credentials',
    );
  }
  return new Error(msg || 'การล็อกอินล้มเหลว');
}

export function allowedEmails() {
  return (CONFIG.ALLOWED_EMAILS || []).map((e) => String(e).toLowerCase());
}

export function isAllowedEmail(email) {
  return allowedEmails().includes(String(email || '').toLowerCase());
}

async function verifyEmail(email) {
  if (!isAllowedEmail(email)) {
    await signOut();
    throw new Error('Access Denied: ใช้ได้เฉพาะ yohaken@gmail.com');
  }
  return String(email).toLowerCase();
}

function waitForAuthUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

async function finalizeSignIn(user) {
  if (!user?.email) {
    throw new Error('ไม่พบอีเมลจาก Google');
  }
  await verifyEmail(user.email);
  clearRedirectPending();
  return user;
}

async function signInWithRedirectFlow() {
  markRedirectPending();
  await signInWithRedirect(auth, googleProvider());
  return null;
}

async function signInInteractive() {
  const provider = googleProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return finalizeSignIn(result.user);
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

/** Call once on page load — completes mobile redirect sign-in. */
export async function handleAuthRedirect() {
  await initFirebase();
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) {
      if (isAuthRedirectPending()) clearRedirectPending();
      return null;
    }
    return finalizeSignIn(result.user);
  } catch (error) {
    clearRedirectPending();
    throw mapAuthError(error);
  }
}

export async function startLogin() {
  try {
    await initFirebase();
    return signInInteractive();
  } catch (error) {
    clearRedirectPending();
    throw mapAuthError(error);
  }
}

/** Returns current allowed user, or null if signed out / wrong account. */
export async function getAllowedUser() {
  await initFirebase();
  let user = auth.currentUser;
  if (!user) {
    user = await waitForAuthUser();
  }
  if (!user?.email) return null;
  if (!isAllowedEmail(user.email)) {
    await signOut();
    return null;
  }
  return user;
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }
    if (!isAllowedEmail(user.email)) {
      await signOut();
      callback(null);
      return;
    }
    callback(user);
  });
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
  clearRedirectPending();
}

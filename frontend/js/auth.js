import { CONFIG, STORAGE_KEYS } from './config.js?v=8';
import { auth, initFirebase } from './firebase.js?v=8';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  provider.addScope('email');
  return provider;
}

function mapAuthError(error) {
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user') {
    return new Error('การล็อกอินถูกยกเลิก');
  }
  if (code === 'auth/popup-blocked') {
    return new Error('เปิดหน้าต่างล็อกอินไม่ได้ กรุณาอนุญาต popup');
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error('ยังไม่ได้เปิด Google Sign-In ใน Firebase Console');
  }
  return new Error(error?.message || 'การล็อกอินล้มเหลว');
}

export function clearSession() {
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

async function getDriveAccessToken() {
  const result = await signInWithPopup(auth, googleProvider());
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;

  if (!accessToken) {
    throw new Error('ไม่สามารถเข้าถึง Google Drive ได้ กรุณาลองใหม่');
  }

  await verifyEmail(result.user.email);
  return accessToken;
}

export async function startLogin() {
  try {
    await initFirebase();
    return getDriveAccessToken();
  } catch (error) {
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
    return getDriveAccessToken();
  } catch (error) {
    if (error.message.includes('Access Denied')) {
      throw error;
    }
    if (error?.code === 'auth/popup-closed-by-user') {
      return null;
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

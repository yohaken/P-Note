import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

/**
 * P-Note Firebase project (`pnote`) — fallback when /__/firebase/init.json is unavailable
 * (local static serve). On Firebase Hosting, init.json overlays these values.
 *
 * Paste Web app config from:
 * https://console.firebase.google.com/project/pnote/settings/general
 * (apiKey + messagingSenderId + appId). Until then, Auth works on Hosting only.
 */
const PROJECT_DEFAULTS = {
  apiKey: '',
  authDomain: 'pnote.firebaseapp.com',
  projectId: 'pnote',
  storageBucket: 'pnote.firebasestorage.app',
  messagingSenderId: '',
  appId: '',
};

let app = null;
export let auth = null;

/**
 * Keep authDomain on the Firebase default domain — its /__/auth/handler redirect URI
 * is pre-registered in the Google OAuth client. Using *.web.app here without registering
 * https://<site>.web.app/__/auth/handler breaks ALL sign-in (redirect_uri_mismatch).
 */
export function resolveAuthDomain(config) {
  return config.authDomain || PROJECT_DEFAULTS.authDomain;
}

async function loadFirebaseConfig() {
  let config = { ...PROJECT_DEFAULTS };
  try {
    const response = await fetch('/__/firebase/init.json');
    if (response.ok) {
      config = { ...config, ...(await response.json()) };
    }
  } catch {
    // Local dev or non-Firebase hosting.
  }
  return { ...config, authDomain: resolveAuthDomain(config) };
}

export async function initFirebase() {
  if (app) {
    return auth;
  }

  const config = await loadFirebaseConfig();
  if (!config.apiKey) {
    throw new Error(
      'Firebase apiKey ยังว่าง — วาง Web config จากโปรเจกต์ pnote ใน js/firebase.js หรือเปิดผ่าน Firebase Hosting',
    );
  }
  app = initializeApp(config);
  auth = getAuth(app);

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // Persistence is best-effort.
  }

  return auth;
}

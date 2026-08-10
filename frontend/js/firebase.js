import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

/**
 * MyNote (mynote-f1bbc) — fallback when /__/firebase/init.json is unavailable
 * (local static serve). On Firebase Hosting, init.json overlays these values.
 */
const PROJECT_DEFAULTS = {
  apiKey: 'AIzaSyAswz15_kbwp0owNI0R2_6x8YoNHmZfeeI',
  authDomain: 'mynote-f1bbc.firebaseapp.com',
  projectId: 'mynote-f1bbc',
  storageBucket: 'mynote-f1bbc.firebasestorage.app',
  messagingSenderId: '570843838870',
};

let app = null;
export let auth = null;
export let db = null;

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
    return { app, auth, db };
  }

  const config = await loadFirebaseConfig();
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // Persistence is best-effort.
  }

  return { app, auth, db };
}

export function getDb() {
  if (!db) {
    throw new Error('Firestore not initialized — call initFirebase() first');
  }
  return db;
}

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const PROJECT_DEFAULTS = {
  apiKey: 'AIzaSyD_b7TASutFOmoUKskH6yLjmxJzVpTUIn4',
  authDomain: 'mypeer-501909.firebaseapp.com',
  projectId: 'mypeer-501909',
  storageBucket: 'mypeer-501909.firebasestorage.app',
  messagingSenderId: '470549580687',
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
  app = initializeApp(config);
  auth = getAuth(app);

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // Persistence is best-effort.
  }

  return auth;
}

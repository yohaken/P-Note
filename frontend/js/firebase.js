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
 * authDomain must match the host serving the app (same-origin /__/auth/handler).
 * Using firebaseapp.com while the app runs on *.web.app breaks sign-in on Safari
 * and modern mobile browsers (third-party cookie restrictions).
 */
export function resolveAuthDomain() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    // Static dev server has no /__/auth handler — use Firebase-hosted auth domain.
    return PROJECT_DEFAULTS.authDomain;
  }
  return host;
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
  return { ...config, authDomain: resolveAuthDomain() };
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

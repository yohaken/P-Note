import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const FALLBACK_CONFIG = {
  apiKey: 'AIzaSyD_b7TASutFOmoUKskH6yLjmxJzVpTUIn4',
  authDomain: 'mypeer-501909.firebaseapp.com',
  projectId: 'mypeer-501909',
  storageBucket: 'mypeer-501909.firebasestorage.app',
  messagingSenderId: '470549580687',
};

let app = null;
export let auth = null;

async function loadFirebaseConfig() {
  try {
    const response = await fetch('/__/firebase/init.json');
    if (response.ok) {
      return response.json();
    }
  } catch {
    // Local dev or non-Firebase hosting.
  }
  return FALLBACK_CONFIG;
}

export async function initFirebase() {
  if (app) {
    return auth;
  }

  const config = await loadFirebaseConfig();
  app = initializeApp(config);
  auth = getAuth(app);

  // Keep the signed-in session across reloads/restarts (long-lived login).
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // Persistence is best-effort; falls back to the SDK default.
  }

  return auth;
}

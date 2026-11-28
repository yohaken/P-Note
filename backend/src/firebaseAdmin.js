import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { config } from './config.js';

let app = null;
/** @type {ReturnType<typeof getAuth>|null} */
let testAuth = null;

export function __setAdminAuthForTests(fake) {
  testAuth = fake;
}

export function adminAuth() {
  if (testAuth) return testAuth;
  if (!app) {
    app = initializeApp({
      credential: applicationDefault(),
      projectId: config.gcpProjectId,
    });
  }
  return getAuth(app);
}

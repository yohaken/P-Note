import { cacheName, getAppBuild } from './version.js?v=353';
import { checkForAppUpdate } from './update.js?v=353';

/**
 * Legacy ./sw.js is missing — do not register it (404 + useless controllerchange reloads).
 * Notification SW stays in note-notify.js (sw-notify.js).
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const build = getAppBuild();
  checkForAppUpdate(build).catch(() => {});
}

export { cacheName, getAppBuild };

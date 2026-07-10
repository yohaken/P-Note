import { cacheName, getAppBuild } from './version.js?v=17';

/** Register SW for offline use (after cache-bootstrap ensured the active build). */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  const build = getAppBuild();
  navigator.serviceWorker.register(`./sw.js?v=${build}`).catch(() => {});
}

export { cacheName, getAppBuild };

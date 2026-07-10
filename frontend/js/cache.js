import { cacheName, getAppBuild } from './version.js?v=25';
import { checkForAppUpdate } from './update.js?v=25';

let controllerReloadPending = false;

/** Register SW for offline use (after cache-bootstrap ensured the active build). */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const build = getAppBuild();

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controllerReloadPending) return;
    controllerReloadPending = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register(`./sw.js?v=${build}`)
    .then((registration) => {
      registration.update().catch(() => {});

      setInterval(() => registration.update().catch(() => {}), 60_000);

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      if (registration.waiting && navigator.serviceWorker.controller) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    })
    .catch(() => {});

  checkForAppUpdate(build).catch(() => {});
}

export { cacheName, getAppBuild };

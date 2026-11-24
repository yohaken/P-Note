/**
 * Runs before any module — if pnote-build changed, purge SW + Cache Storage.
 * Reload ONLY when at least one service worker was actually registered
 * (e.g. sw-notify). A bare build bump with no SW must not double-load.
 * Keep in sync with <meta name="pnote-build"> in note.html.
 */
(function bootstrapCache() {
  var meta = document.querySelector('meta[name="pnote-build"]');
  var build = meta && meta.getAttribute('content');
  if (!build) return;

  var STORAGE_KEY = 'pnote_active_build';
  if (localStorage.getItem(STORAGE_KEY) === build) return;

  localStorage.setItem(STORAGE_KEY, build);

  var hadServiceWorker = false;
  var chain = Promise.resolve();

  if ('serviceWorker' in navigator) {
    chain = chain.then(function () {
      return navigator.serviceWorker.getRegistrations().then(function (regs) {
        hadServiceWorker = regs && regs.length > 0;
        return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
      });
    });
  }

  if (window.caches) {
    chain = chain.then(function () {
      return caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) { return caches.delete(key); }));
      });
    });
  }

  chain.then(function () {
    if (hadServiceWorker) location.reload();
  });
})();

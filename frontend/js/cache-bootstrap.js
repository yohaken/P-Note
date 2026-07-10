/**
 * Runs before any module — if pnote-build changed, purge SW + Cache Storage then reload once.
 * Keep in sync with <meta name="pnote-build"> in index.html.
 */
(function bootstrapCache() {
  var meta = document.querySelector('meta[name="pnote-build"]');
  var build = meta && meta.getAttribute('content');
  if (!build) return;

  var STORAGE_KEY = 'pnote_active_build';
  if (localStorage.getItem(STORAGE_KEY) === build) return;

  localStorage.setItem(STORAGE_KEY, build);

  var chain = Promise.resolve();

  if ('serviceWorker' in navigator) {
    chain = chain.then(function () {
      return navigator.serviceWorker.getRegistrations().then(function (regs) {
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
    location.reload();
  });
})();

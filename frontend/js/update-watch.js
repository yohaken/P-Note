/**
 * Poll this page's HTML for <meta name="pnote-build"> changes.
 * Reload only when the remote build is newer than the one in the DOM
 * (never on mismatch with a different page like index vs note).
 */
(function updateWatch() {
  var BUILD_META_RE = /meta\s+name=["']pnote-build["']\s+content=["'](\d+)["']/i;
  var INTERVAL_MS = 20000;
  var applying = false;
  var checking = false;

  function getLocalBuild() {
    return document.querySelector('meta[name="pnote-build"]')?.content || '0';
  }

  function parseBuildFromHtml(html) {
    var match = String(html).match(BUILD_META_RE);
    return match ? match[1] : null;
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /** Fetch the current document (index.html or note.html), not always index. */
  function currentPageUrl() {
    var path = window.location.pathname || '/';
    if (path.endsWith('/')) return path + 'index.html';
    if (!/\.html?$/i.test(path)) return path.replace(/\/?$/, '/') + 'index.html';
    return path;
  }

  async function fetchRemoteBuild() {
    var res = await fetch(currentPageUrl() + '?_=' + Date.now(), {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    if (!res.ok) return null;
    return parseBuildFromHtml(await res.text());
  }

  async function purgeCachesAndServiceWorkers() {
    if ('serviceWorker' in navigator) {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function (reg) { return reg.unregister(); }));
    }
    if (window.caches) {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (key) { return caches.delete(key); }));
    }
  }

  function showUpdateToast(message, durationMs) {
    var toast = document.getElementById('update-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'update-toast';
      toast.className = 'update-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add('visible');
    return sleep(durationMs || 900).then(function () {
      toast.classList.remove('visible');
    });
  }

  async function applyAppUpdate(message) {
    if (applying) return;
    applying = true;
    await showUpdateToast(message || 'มีอัปเดตใหม่ — กำลังรีเฟรช...', 900);
    await purgeCachesAndServiceWorkers();
    var url = new URL(window.location.href);
    url.searchParams.set('__refresh', String(Date.now()));
    window.location.replace(url.toString());
  }

  async function checkForAppUpdate() {
    if (applying) return false;
    try {
      var localBuild = getLocalBuild();
      var remoteBuild = await fetchRemoteBuild();
      if (!remoteBuild) return false;
      // Only upgrade — never reload when remote is older/equal (stops index↔note loops).
      if (Number(remoteBuild) <= Number(localBuild || 0)) return false;
      await applyAppUpdate();
      return true;
    } catch (e) {
      return false;
    }
  }

  function startUpdateWatcher() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return;
    }

    var runCheck = async function () {
      if (document.hidden || checking || applying) return;
      checking = true;
      try {
        await checkForAppUpdate();
      } finally {
        checking = false;
      }
    };

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) runCheck();
    });
    window.addEventListener('focus', runCheck);
    runCheck();
    window.setInterval(runCheck, INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startUpdateWatcher);
  } else {
    startUpdateWatcher();
  }
})();

import { STORAGE_KEYS } from './config.js?v=23';

const BUILD_META_RE = /meta\s+name=["']pnote-build["']\s+content=["'](\d+)["']/i;

let applying = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseBuildFromHtml(html) {
  const match = String(html).match(BUILD_META_RE);
  return match ? match[1] : null;
}

export async function fetchRemoteBuild() {
  const res = await fetch(`./index.html?_=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  if (!res.ok) return null;
  return parseBuildFromHtml(await res.text());
}

async function purgeCachesAndServiceWorkers() {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  }
  if (window.caches) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

function showUpdateToast(message, durationMs = 900) {
  let toast = document.getElementById('update-toast');
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
  return sleep(durationMs).then(() => {
    toast.classList.remove('visible');
  });
}

export async function applyAppUpdate({ message = 'มีอัปเดตใหม่ — กำลังรีเฟรช...', toastMs = 900 } = {}) {
  if (applying) return;
  applying = true;

  await showUpdateToast(message, toastMs);
  await purgeCachesAndServiceWorkers();

  const url = new URL(window.location.href);
  url.searchParams.set('__refresh', String(Date.now()));
  window.location.replace(url.toString());
}

export async function forceRefresh() {
  await applyAppUpdate({ message: 'กำลังรีเฟรชแอป...', toastMs: 500 });
}

export async function checkForAppUpdate(localBuild) {
  if (applying) return false;
  try {
    const remoteBuild = await fetchRemoteBuild();
    if (!remoteBuild || remoteBuild === localBuild) return false;
    await applyAppUpdate();
    return true;
  } catch {
    return false;
  }
}

export function startUpdateWatcher({ getLocalBuild, intervalMs = 20000 }) {
  if (window.location.hostname === 'localhost') {
    return;
  }

  let checking = false;

  const runCheck = async () => {
    if (document.hidden || checking || applying) return;
    checking = true;
    try {
      await checkForAppUpdate(getLocalBuild());
    } finally {
      checking = false;
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) runCheck();
  });
  window.addEventListener('focus', runCheck);

  runCheck();
  return window.setInterval(runCheck, intervalMs);
}

export { STORAGE_KEYS };

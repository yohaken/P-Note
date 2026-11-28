/**
 * Calorie-first entry — paint the calorie shell ASAP, then hydrate full app.
 * First cloud pull is non-blocking (badge only); PIN overlay still gates edits.
 */
import { paintListFromLocal } from './list-paint.js?v=354';

document.documentElement.dataset.pnoteBoot = '1';

try {
  paintListFromLocal();
} catch (err) {
  console.warn('calorie boot paint failed', err);
  document.body.classList.add('light', 'calorie-mode', 'calorie-only');
  const loading = document.getElementById('loading-overlay');
  const boardTopbar = document.getElementById('board-topbar');
  const calorieView = document.getElementById('calorie-view');
  if (boardTopbar) boardTopbar.hidden = false;
  if (calorieView) calorieView.hidden = false;
  if (loading) loading.hidden = true;
}

// Warm Firebase in parallel with the app module (do not block paint / hydrate).
import('./firebase.js?v=354')
  .then((m) => (typeof m.initFirebase === 'function' ? m.initFirebase() : undefined))
  .catch((err) => console.warn('early firebase init failed', err));

const retryCountKey = 'pnote_boot_retry_n';

// Full app (interactions, sync, settings) after first paint.
import('./app.js?v=354')
  .then((m) => {
    try { sessionStorage.removeItem(retryCountKey); } catch { /* ignore */ }
    if (typeof m.hydrateApp === 'function') return m.hydrateApp();
    return undefined;
  })
  .catch((err) => {
    console.error('app hydrate failed', err);
    // A failed module fetch stays failed for this page — only a reload retries it.
    // Allow 2 immediate auto-reloads, then show the tap-to-retry gate.
    const MAX_BOOT_RELOADS = 2;
    let tries = 0;
    let storageOk = true;
    try { tries = Number(sessionStorage.getItem(retryCountKey)) || 0; } catch { storageOk = false; }
    if (storageOk && tries < MAX_BOOT_RELOADS) {
      let wrote = false;
      try { sessionStorage.setItem(retryCountKey, String(tries + 1)); wrote = true; } catch { wrote = false; }
      if (wrote) { location.reload(); return; }
    }
    const loading = document.getElementById('loading-overlay');
    if (loading) loading.hidden = true;
    const gate = document.getElementById('sync-gate-overlay');
    const title = document.getElementById('sync-gate-title');
    const sub = document.getElementById('sync-gate-sub');
    if (title) title.textContent = 'โหลดแอปไม่สำเร็จ';
    if (sub) sub.textContent = 'เช็คเน็ตแล้วแตะเพื่อลองใหม่';
    const spin = gate?.querySelector('.sync-gate-spinner');
    if (spin) { spin.setAttribute('hidden', ''); spin.classList.remove('spinner'); }
    if (gate) {
      gate.hidden = false;
      gate.style.cursor = 'pointer';
      gate.addEventListener('click', () => location.reload(), { once: true });
    }
  });

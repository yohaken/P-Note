/**
 * Calorie-first entry — paint the calorie shell ASAP, then hydrate full app.
 */
import { paintListFromLocal } from './list-paint.js?v=227';

document.documentElement.dataset.pnoteBoot = '1';

try {
  paintListFromLocal();
} catch (err) {
  console.warn('calorie boot paint failed', err);
  document.body.classList.add('light', 'calorie-mode', 'calorie-only');
  const loading = document.getElementById('loading-overlay');
  const boardTopbar = document.getElementById('board-topbar');
  const calorieView = document.getElementById('calorie-view');
  const listView = document.getElementById('list-view');
  if (boardTopbar) boardTopbar.hidden = false;
  if (calorieView) calorieView.hidden = false;
  if (listView) listView.hidden = true;
  if (loading) loading.hidden = true;
}

// Full app (interactions, sync, settings) after first paint.
import('./app.js?v=230')
  .then((m) => {
    if (typeof m.hydrateApp === 'function') return m.hydrateApp();
    return undefined;
  })
  .catch((err) => {
    console.error('app hydrate failed', err);
    const loading = document.getElementById('loading-overlay');
    if (loading) loading.hidden = true;
    const gate = document.getElementById('sync-gate-overlay');
    if (gate) gate.hidden = true;
    document.body.classList.remove('sync-gated');
  });

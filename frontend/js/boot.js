/**
 * List-first entry — paint the work board ASAP, then hydrate full app.
 * Other surfaces (settings / AI / editor / camera) load with app.js after paint.
 */
import { paintListFromLocal } from './list-paint.js?v=175';

document.documentElement.dataset.pnoteBoot = '1';

try {
  paintListFromLocal();
} catch (err) {
  console.warn('list boot paint failed', err);
  const loading = document.getElementById('loading-overlay');
  const boardTopbar = document.getElementById('board-topbar');
  const listView = document.getElementById('list-view');
  if (boardTopbar) boardTopbar.hidden = false;
  if (listView) listView.hidden = false;
  if (loading) loading.hidden = true;
}

// Full app (interactions, sync, settings, AI) after first paint.
import('./app.js?v=175')
  .then((m) => {
    if (typeof m.hydrateApp === 'function') return m.hydrateApp();
    return undefined;
  })
  .catch((err) => {
    console.error('app hydrate failed', err);
  });

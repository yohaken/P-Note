/**
 * Fast first paint — calorie shell only (work/note/calendar retired).
 * Intentionally avoids notes/schedule/icons so the first frame stays clean.
 */
import {
  FIXED_UI,
  loadSettings,
  calorieToneCssVars,
  dockScaleToCss,
  dockOffsetYToLiftPx,
} from './settings.js?v=194';

function applyCalorieChrome() {
  document.body.classList.add('light', 'calorie-mode', 'calorie-only');
  document.body.classList.remove('note-mode', 'calendar-mode');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#e8f0ea');

  const dock = document.getElementById('filter-dock');
  if (dock) {
    dock.style.setProperty('--dock-scale', String(dockScaleToCss(FIXED_UI.dockScale)));
    dock.style.setProperty('--dock-lift', `${dockOffsetYToLiftPx(FIXED_UI.dockOffsetY)}px`);
  }

  try {
    const vars = calorieToneCssVars(loadSettings().calorieTones);
    [
      document.documentElement,
      document.body,
      document.getElementById('calorie-view'),
      document.querySelector('.calorie-table'),
    ].filter(Boolean).forEach((el) => {
      Object.entries(vars).forEach(([key, value]) => {
        el.style.setProperty(key, value);
      });
    });
  } catch { /* ignore */ }

  const build =
    document.querySelector('meta[name="pnote-build"]')?.content || '';
  const n = String(build).replace(/^v/i, '');
  const ver = n ? `v${n}` : '';
  const calVer = document.getElementById('calorie-app-ver');
  if (calVer) calVer.textContent = ver;
  const barVer = document.getElementById('mode-switch-ver');
  if (barVer) barVer.textContent = ver;
}

function showCalorieShell() {
  const boardTopbar = document.getElementById('board-topbar');
  const listView = document.getElementById('list-view');
  const editorView = document.getElementById('editor-view');
  const calendarView = document.getElementById('calendar-view');
  const calorieView = document.getElementById('calorie-view');
  const loading = document.getElementById('loading-overlay');
  const filters = document.getElementById('filter-dock-filters');
  const drawer = document.getElementById('group-drawer');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const modeMenu = document.getElementById('modeMenuOverlay');
  if (editorView) editorView.hidden = true;
  if (calendarView) calendarView.hidden = true;
  if (listView) listView.hidden = true;
  if (filters) filters.hidden = true;
  if (drawer) drawer.hidden = true;
  if (drawerBackdrop) drawerBackdrop.hidden = true;
  if (modeMenu) modeMenu.hidden = true;
  if (calorieView) calorieView.hidden = false;
  if (boardTopbar) boardTopbar.hidden = false;
  if (loading) loading.hidden = true;
}

/**
 * @returns {{ settings: object, notesData: null }}
 */
export function paintListFromLocal() {
  const settings = loadSettings();
  const bootSettings = {
    ...settings,
    appMode: 'calorie',
    searchQuery: '',
  };

  applyCalorieChrome();
  showCalorieShell();

  document.documentElement.dataset.pnoteBoot = '1';
  return { settings: bootSettings, notesData: null };
}

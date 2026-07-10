import { STORAGE_KEYS } from './config.js?v=51';
import { DEFAULT_BAR_LAYOUT, normalizeLayout } from './bars.js?v=46';

const DEFAULTS = {
  theme: 'dark',
  cardDensity: 0,
  sortMode: 'updated',
  barThickness: { sort: 0, tag: 0, priority: 0, recurrence: 0 },
};

const SORT_MODES = ['updated', 'schedule', 'manual'];

function clampPct(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      return {
        ...DEFAULTS,
        barThickness: { ...DEFAULTS.barThickness },
        barLayout: [...DEFAULT_BAR_LAYOUT],
      };
    }
    const parsed = JSON.parse(raw);
    const bt = parsed.barThickness || {};
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      cardDensity: clampPct(parsed.cardDensity),
      sortMode: SORT_MODES.includes(parsed.sortMode) ? parsed.sortMode : 'updated',
      barThickness: {
        sort: clampPct(bt.sort),
        tag: clampPct(bt.tag),
        priority: clampPct(bt.priority),
        recurrence: clampPct(bt.recurrence),
      },
      barLayout: normalizeLayout(parsed.barLayout),
    };
  } catch {
    return {
      ...DEFAULTS,
      barThickness: { ...DEFAULTS.barThickness },
      barLayout: [...DEFAULT_BAR_LAYOUT],
    };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function densityToCssUnit(percent) {
  return Math.min(100, Math.max(0, percent)) / 100;
}

/** Map thickness 0..100 (thin) → bar padding + chip scale (wider range, ultra-thin at 100). */
export function thicknessToPadRem(percent) {
  const p = Math.min(100, Math.max(0, percent)) / 100;
  // 0 → 0.48rem, 100 → 0
  return `${(0.48 * (1 - p)).toFixed(3)}rem`;
}

/** Extra CSS vars so the whole filter row shrinks with thickness. */
export function thicknessStyleVars(percent) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0)) / 100;
  return {
    '--bar-pad': `${(0.48 * (1 - p)).toFixed(3)}rem`,
    '--bar-gap': `${(0.35 * (1 - p * 0.75)).toFixed(3)}rem`,
    '--bar-chip-py': `${(0.35 * (1 - p * 0.9)).toFixed(3)}rem`,
    '--bar-chip-px': `${(0.8 * (1 - p * 0.55)).toFixed(3)}rem`,
    '--bar-chip-font': `${(0.85 * (1 - p * 0.42)).toFixed(3)}rem`,
    '--bar-grip-w': `${Math.max(12, 20 * (1 - p * 0.45)).toFixed(1)}px`,
  };
}

import { STORAGE_KEYS } from './config.js?v=25';
import { DEFAULT_BAR_LAYOUT, normalizeLayout } from './bars.js?v=25';

const DEFAULTS = {
  theme: 'dark',
  cardDensity: 0,
  barThickness: { sort: 0, tag: 0 },
};

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
      barThickness: {
        sort: clampPct(bt.sort),
        tag: clampPct(bt.tag),
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

/** Map thickness 0..100 (thin) to vertical bar padding in rem. */
export function thicknessToPadRem(percent) {
  const p = Math.min(100, Math.max(0, percent)) / 100;
  return `${(0.5 - p * 0.44).toFixed(3)}rem`;
}

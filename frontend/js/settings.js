import { STORAGE_KEYS } from './config.js?v=20';

const DEFAULTS = {
  cardDensity: 0,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    const density = Number(parsed.cardDensity);
    return {
      cardDensity: Number.isFinite(density)
        ? Math.min(100, Math.max(0, density))
        : DEFAULTS.cardDensity,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function densityToCssUnit(percent) {
  return Math.min(100, Math.max(0, percent)) / 100;
}

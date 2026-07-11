import { STORAGE_KEYS } from './config.js?v=51';
import { DEFAULT_BAR_LAYOUT, normalizeLayout } from './bars.js?v=46';

export const DEFAULT_NOTIFY_PREFS = {
  enabled: false,
  label: 'P-Note',
  sound: true,
  vibrate: true,
  preview: 'full', // full | title | hidden
  persistent: false,
  earlyMinutes: 0,
  minPriority: 'normal',
  tagIds: [],
};

const DEFAULTS = {
  theme: 'dark',
  cardDensity: 0,
  dockScale: 50,
  dockOffsetY: 70,
  sortMode: 'updated',
  tagFilterId: null,
  priorityFilter: null,
  recurrenceFilter: null,
  tagOrder: [],
  barThickness: { sort: 0, tag: 0, priority: 0, recurrence: 0 },
  notificationsEnabled: false,
  notifyPrefs: { ...DEFAULT_NOTIFY_PREFS },
  /** Google AI Studio key — stored on this device only */
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
};

export function normalizeGeminiModel(value) {
  const v = String(value || '').trim().slice(0, 80);
  return v || DEFAULTS.geminiModel;
}

const SORT_MODES = ['updated', 'schedule', 'manual'];
const PRIORITY_FILTERS = ['normal', 'important', 'urgent', 'critical'];
const RECURRENCE_FILTERS = ['none', 'any', 'daily', 'weekly', 'monthly', 'yearly'];
const PREVIEW_MODES = ['full', 'title', 'hidden'];
const EARLY_MINUTES = [0, 5, 15, 30, 60];

function clampPct(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
}

function normalizeTagFilterId(value) {
  if (value == null || value === '') return null;
  return String(value);
}

function normalizePriorityFilter(value) {
  return PRIORITY_FILTERS.includes(value) ? value : null;
}

function normalizeRecurrenceFilterSetting(value) {
  return RECURRENCE_FILTERS.includes(value) ? value : null;
}

function normalizeTagOrder(value) {
  if (!Array.isArray(value)) return [];
  return value.map((id) => String(id)).filter(Boolean);
}

export function normalizeNotifyPrefs(raw, legacyEnabled) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const early = Number(src.earlyMinutes);
  const enabled =
    typeof src.enabled === 'boolean'
      ? src.enabled
      : Boolean(legacyEnabled);
  return {
    enabled,
    label: String(src.label || DEFAULT_NOTIFY_PREFS.label).trim().slice(0, 24) || 'P-Note',
    sound: src.sound !== false,
    vibrate: src.vibrate !== false,
    preview: PREVIEW_MODES.includes(src.preview) ? src.preview : 'full',
    persistent: Boolean(src.persistent),
    earlyMinutes: EARLY_MINUTES.includes(early) ? early : 0,
    minPriority: PRIORITY_FILTERS.includes(src.minPriority) ? src.minPriority : 'normal',
    tagIds: Array.isArray(src.tagIds) ? src.tagIds.map(String).filter(Boolean) : [],
  };
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      return {
        ...DEFAULTS,
        tagOrder: [],
        barThickness: { ...DEFAULTS.barThickness },
        barLayout: [...DEFAULT_BAR_LAYOUT],
        notifyPrefs: { ...DEFAULT_NOTIFY_PREFS },
        geminiApiKey: '',
        geminiModel: DEFAULTS.geminiModel,
        dockScale: DEFAULTS.dockScale,
        dockOffsetY: DEFAULTS.dockOffsetY,
      };
    }
    const parsed = JSON.parse(raw);
    const bt = parsed.barThickness || {};
    const notifyPrefs = normalizeNotifyPrefs(parsed.notifyPrefs, parsed.notificationsEnabled);
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      cardDensity: clampPct(parsed.cardDensity),
      dockScale: clampPct(parsed.dockScale, 50),
      dockOffsetY: clampPct(parsed.dockOffsetY, 70),
      sortMode: SORT_MODES.includes(parsed.sortMode) ? parsed.sortMode : 'updated',
      tagFilterId: normalizeTagFilterId(parsed.tagFilterId),
      priorityFilter: normalizePriorityFilter(parsed.priorityFilter),
      recurrenceFilter: normalizeRecurrenceFilterSetting(parsed.recurrenceFilter),
      tagOrder: normalizeTagOrder(parsed.tagOrder),
      barThickness: {
        sort: clampPct(bt.sort),
        tag: clampPct(bt.tag),
        priority: clampPct(bt.priority),
        recurrence: clampPct(bt.recurrence),
      },
      barLayout: normalizeLayout(parsed.barLayout),
      notificationsEnabled: notifyPrefs.enabled,
      notifyPrefs,
      geminiApiKey: String(parsed.geminiApiKey || '').trim().slice(0, 200),
      geminiModel: normalizeGeminiModel(parsed.geminiModel),
    };
  } catch {
    return {
      ...DEFAULTS,
      tagOrder: [],
      barThickness: { ...DEFAULTS.barThickness },
      barLayout: [...DEFAULT_BAR_LAYOUT],
      notificationsEnabled: false,
      notifyPrefs: { ...DEFAULT_NOTIFY_PREFS },
      geminiApiKey: '',
      geminiModel: DEFAULTS.geminiModel,
      dockScale: DEFAULTS.dockScale,
      dockOffsetY: DEFAULTS.dockOffsetY,
    };
  }
}

export function saveSettings(settings) {
  const notifyPrefs = normalizeNotifyPrefs(
    settings.notifyPrefs,
    settings.notificationsEnabled,
  );
  const next = {
    ...settings,
    notifyPrefs,
    notificationsEnabled: notifyPrefs.enabled,
    geminiApiKey: String(settings.geminiApiKey || '').trim().slice(0, 200),
    geminiModel: normalizeGeminiModel(settings.geminiModel),
  };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(next));
}

export function densityToCssUnit(percent) {
  return Math.min(100, Math.max(0, percent)) / 100;
}

/** Map dockScale 0..100 → CSS scale factor (~0.78 .. 1.32). Mid 50 = 1.0 */
export function dockScaleToCss(percent) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0)) / 100;
  return Number((0.78 + p * 0.54).toFixed(3));
}

/** Map dockOffsetY 0..100 → extra top padding lift (px). Higher = lower on screen. */
export function dockOffsetYToLiftPx(percent) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0)) / 100;
  // 0 → 14px lift (higher), 100 → 0px (flush down toward home indicator)
  return Number(((1 - p) * 14).toFixed(1));
}

/** Map thickness 0..100 (thin) → bar padding + chip scale (wider range, ultra-thin at 100). */
export function thicknessToPadRem(percent) {
  const p = Math.min(100, Math.max(0, percent)) / 100;
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

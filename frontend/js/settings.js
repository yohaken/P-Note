import { STORAGE_KEYS } from './config.js?v=51';
import { DEFAULT_BAR_LAYOUT, normalizeLayout } from './bars.js?v=46';
import {
  normalizeMonthPresets,
  normalizeRecurrenceFilter,
} from './schedule.js?v=113';

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

const DEFAULT_FAB_ORDER = ['pages', 'group', 'ai']; // visual top → bottom (AI nearest dock by default)

const CAMERA_QUALITIES = ['max', 'high', 'medium'];
const CAMERA_FACINGS = ['environment', 'user'];

const DEFAULTS = {
  theme: 'dark',
  cardDensity: 0,
  dockScale: 50,
  dockOffsetY: 70,
  fabOrder: [...DEFAULT_FAB_ORDER],
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
  /** Free-text profile Gemini should read when drafting notes */
  aiProfile: '',
  /** Manual keyword → tag rules, e.g. ที่ดิน/รังวัด → peerland */
  aiTagRules: [],
  /** In-app camera: save captured photos to device */
  cameraSaveToDevice: true,
  cameraFacing: 'environment',
  cameraQuality: 'max',
  /** List box colors — user-defined */
  priorityColors: null,
  dueColors: null,
  /** Month intervals offered in ทำซ้ำ / แจ้งเตือนซ้ำ (e.g. 3,5,6) */
  notifyMonthPresets: [3, 5, 6],
};

export const DEFAULT_PRIORITY_COLORS = {
  normal: '#8b929a',
  important: '#f59e0b',
  urgent: '#06b6d4',
  critical: '#ef4444',
};

export const DEFAULT_DUE_COLORS = {
  far: '#6b8f71',
  mid: '#c4a035',
  near: '#e0893a',
  today: '#e85d2c',
  overdue: '#e23b2e',
};

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function safeHexColor(value, fallback) {
  const v = String(value || '').trim();
  if (HEX_RE.test(v)) return v.length === 4
    ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
    : v.slice(0, 7);
  return fallback;
}

export function normalizePriorityColors(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    normal: safeHexColor(src.normal, DEFAULT_PRIORITY_COLORS.normal),
    important: safeHexColor(src.important, DEFAULT_PRIORITY_COLORS.important),
    urgent: safeHexColor(src.urgent, DEFAULT_PRIORITY_COLORS.urgent),
    critical: safeHexColor(src.critical, DEFAULT_PRIORITY_COLORS.critical),
  };
}

export function normalizeDueColors(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    far: safeHexColor(src.far, DEFAULT_DUE_COLORS.far),
    mid: safeHexColor(src.mid, DEFAULT_DUE_COLORS.mid),
    near: safeHexColor(src.near, DEFAULT_DUE_COLORS.near),
    today: safeHexColor(src.today, DEFAULT_DUE_COLORS.today),
    overdue: safeHexColor(src.overdue, DEFAULT_DUE_COLORS.overdue),
  };
}

/** @returns {'max'|'high'|'medium'} */
export function normalizeCameraQuality(value) {
  return CAMERA_QUALITIES.includes(value) ? value : 'max';
}

/** @returns {'environment'|'user'} */
export function normalizeCameraFacing(value) {
  return CAMERA_FACINGS.includes(value) ? value : 'environment';
}

export function normalizeCameraSaveToDevice(value) {
  return value !== false;
}

/** Ideal capture constraints + JPEG quality for a preset. */
export function cameraQualityPreset(quality) {
  const q = normalizeCameraQuality(quality);
  if (q === 'medium') {
    return { width: 1280, height: 960, jpeg: 0.82, label: 'กลาง' };
  }
  if (q === 'high') {
    return { width: 1920, height: 1440, jpeg: 0.88, label: 'สูง' };
  }
  return { width: 4032, height: 3024, jpeg: 0.92, label: 'สูงสุด' };
}

export function normalizeGeminiModel(value) {
  const v = String(value || '').trim().slice(0, 80);
  return v || DEFAULTS.geminiModel;
}

export function normalizeAiProfile(value) {
  return String(value || '').trim().slice(0, 2000);
}

/** @returns {Array<{ id: string, tagName: string, keywords: string[] }>} */
export function normalizeAiTagRules(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  value.forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    const tagName = String(raw.tagName || '').trim().slice(0, 40);
    if (!tagName) return;
    const keywords = Array.isArray(raw.keywords)
      ? raw.keywords
          .map((k) => String(k || '').trim().slice(0, 40))
          .filter(Boolean)
      : String(raw.keywordsText || '')
          .split(/[,،、|/]+/)
          .map((k) => k.trim().slice(0, 40))
          .filter(Boolean);
    const uniqKw = [];
    const kwSeen = new Set();
    keywords.forEach((k) => {
      const key = k.toLowerCase();
      if (kwSeen.has(key)) return;
      kwSeen.add(key);
      uniqKw.push(k);
    });
    if (!uniqKw.length) return;
    const id = String(raw.id || `${tagName}:${uniqKw.join('|')}`).slice(0, 80);
    const dedupe = `${tagName.toLowerCase()}::${uniqKw.map((k) => k.toLowerCase()).sort().join('|')}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push({ id, tagName, keywords: uniqKw.slice(0, 12) });
  });
  return out.slice(0, 40);
}

const SORT_MODES = ['updated', 'schedule', 'manual'];
const PRIORITY_FILTERS = ['normal', 'important', 'urgent', 'critical'];
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
  return normalizeRecurrenceFilter(value);
}

function normalizeTagOrder(value) {
  if (!Array.isArray(value)) return [];
  return value.map((id) => String(id)).filter(Boolean);
}

const FAB_ORDER_IDS = ['pages', 'group', 'ai'];

/** Visual top → bottom. Missing ids appended; unknown dropped. */
export function normalizeFabOrder(value) {
  const raw = Array.isArray(value) ? value.map(String) : [];
  const seen = new Set();
  const out = [];
  raw.forEach((id) => {
    if (FAB_ORDER_IDS.includes(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  });
  FAB_ORDER_IDS.forEach((id) => {
    if (!seen.has(id)) out.push(id);
  });
  return out;
}

export { DEFAULT_FAB_ORDER };

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
        aiProfile: '',
        aiTagRules: [],
        dockScale: DEFAULTS.dockScale,
        dockOffsetY: DEFAULTS.dockOffsetY,
        fabOrder: [...DEFAULT_FAB_ORDER],
        cameraSaveToDevice: true,
        cameraFacing: 'environment',
        cameraQuality: 'max',
        priorityColors: { ...DEFAULT_PRIORITY_COLORS },
        dueColors: { ...DEFAULT_DUE_COLORS },
        notifyMonthPresets: [3, 5, 6],
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
      fabOrder: normalizeFabOrder(parsed.fabOrder),
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
      aiProfile: normalizeAiProfile(parsed.aiProfile),
      aiTagRules: normalizeAiTagRules(parsed.aiTagRules),
      cameraSaveToDevice: normalizeCameraSaveToDevice(parsed.cameraSaveToDevice),
      cameraFacing: normalizeCameraFacing(parsed.cameraFacing),
      cameraQuality: normalizeCameraQuality(parsed.cameraQuality),
      priorityColors: normalizePriorityColors(parsed.priorityColors),
      dueColors: normalizeDueColors(parsed.dueColors),
      notifyMonthPresets: normalizeMonthPresets(parsed.notifyMonthPresets),
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
      aiProfile: '',
      aiTagRules: [],
      dockScale: DEFAULTS.dockScale,
      dockOffsetY: DEFAULTS.dockOffsetY,
      fabOrder: [...DEFAULT_FAB_ORDER],
      cameraSaveToDevice: true,
      cameraFacing: 'environment',
      cameraQuality: 'max',
      priorityColors: { ...DEFAULT_PRIORITY_COLORS },
      dueColors: { ...DEFAULT_DUE_COLORS },
      notifyMonthPresets: [3, 5, 6],
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
    fabOrder: normalizeFabOrder(settings.fabOrder),
    notifyPrefs,
    notificationsEnabled: notifyPrefs.enabled,
    geminiApiKey: String(settings.geminiApiKey || '').trim().slice(0, 200),
    geminiModel: normalizeGeminiModel(settings.geminiModel),
    aiProfile: normalizeAiProfile(settings.aiProfile),
    aiTagRules: normalizeAiTagRules(settings.aiTagRules),
    cameraSaveToDevice: normalizeCameraSaveToDevice(settings.cameraSaveToDevice),
    cameraFacing: normalizeCameraFacing(settings.cameraFacing),
    cameraQuality: normalizeCameraQuality(settings.cameraQuality),
    priorityColors: normalizePriorityColors(settings.priorityColors),
    dueColors: normalizeDueColors(settings.dueColors),
    notifyMonthPresets: normalizeMonthPresets(settings.notifyMonthPresets),
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

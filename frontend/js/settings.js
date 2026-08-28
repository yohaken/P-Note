import { STORAGE_KEYS } from './config.js?v=227';
import { compareStamp, nowIso } from './clock.js?v=227';
import { DEFAULT_BAR_LAYOUT, normalizeLayout } from './bars.js?v=227';
import {
  normalizeMonthPresets,
  normalizeRecurrenceFilter,
} from './schedule.js?v=227';
import { DEFAULT_PRIORITY_ICONS, normalizePriorityIcons } from './icons.js?v=227';

export const DEFAULT_NOTIFY_PREFS = {
  enabled: false,
  label: 'แคลโน้ต',
  sound: true,
  vibrate: true,
  preview: 'full', // full | title | hidden
  persistent: false,
  earlyMinutes: 0,
  minPriority: 'normal',
  tagIds: [],
};

const DEFAULT_FAB_ORDER = ['group', 'ai']; // visual top → bottom (AI nearest dock by default)

const CAMERA_QUALITIES = ['max', 'high', 'medium'];
const CAMERA_FACINGS = ['environment', 'user'];

export const DEFAULT_FILTER_ORDER = ['due', 'sort', 'priority', 'recurrence'];

export const META_SHOW_MODES = ['off', 'text', 'icon', 'both'];

/** What to show inside work cards (meta row + lead icon). */
export const DEFAULT_CARD_DISPLAY = {
  leadIcon: true,
  tag: 'both',
  priority: 'text',
  due: 'text',
  recurrence: 'text',
  iconColorMode: 'auto', // auto | custom
  priorityIconColors: {
    critical: null,
    important: null,
    urgent: null,
    normal: null,
  },
};

export function normalizeMetaShow(value, fallback = 'text') {
  return META_SHOW_MODES.includes(value) ? value : fallback;
}

/** Fixed chrome — no user UI customization (avoids broken desktop/mobile layouts). */
export const FIXED_UI = {
  theme: 'light',
  cardDensity: 70,
  dockScale: 50,
  dockOffsetY: 85,
  fabOrder: [...DEFAULT_FAB_ORDER],
  filterOrder: [...DEFAULT_FILTER_ORDER],
  barThickness: { sort: 0, tag: 0, priority: 0, recurrence: 0 },
  priorityColors: null, // resolved to DEFAULT_PRIORITY_COLORS on load
  dueColors: null, // resolved to DEFAULT_DUE_COLORS on load
  listShowContent: false,
};

const DEFAULTS = {
  theme: FIXED_UI.theme,
  cardDensity: FIXED_UI.cardDensity,
  dockScale: FIXED_UI.dockScale,
  dockOffsetY: FIXED_UI.dockOffsetY,
  fabOrder: [...DEFAULT_FAB_ORDER],
  filterOrder: [...DEFAULT_FILTER_ORDER],
  sortMode: 'updated',
  tagFilterId: null,
  priorityFilter: null,
  recurrenceFilter: null,
  tagOrder: [],
  barThickness: { ...FIXED_UI.barThickness },
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
  /** List box colors — locked to defaults */
  priorityColors: null,
  dueColors: null,
  /** Month intervals offered in ทำซ้ำ / แจ้งเตือนซ้ำ (e.g. 3,5,6) */
  notifyMonthPresets: [3, 5, 6],
  /** List cards: title only (fixed) */
  listShowContent: false,
  /** Leading icons for priority levels on work cards */
  priorityIcons: { ...DEFAULT_PRIORITY_ICONS },
  /** Work-card meta visibility / icon mode */
  cardDisplay: { ...DEFAULT_CARD_DISPLAY, priorityIconColors: { ...DEFAULT_CARD_DISPLAY.priorityIconColors } },
  /** Last opened workspace id (legacy device key) */
  lastWorkspaceId: null,
  /** App is calorie-only; other modes are retired from the UI. */
  appMode: 'calorie',
  /** Last opened notepad id in Note mode */
  lastNotepadId: null,
  /** Recent notepad ids for bottom quick-title bar (most recent first) */
  recentNotepadIds: [],
  /** Table / today-card color tones — filled in loadSettings via normalizeCalorieTones */
  calorieTones: null,
  /** Last health-summary chart range (days): 1/3/7/14/90/180/365 — shared with home dash */
  calorieTrendDays: 7,
  /** Pinned health widgets on home dash (unique ids, synced to cloud) */
  calorieHomePins: [],
};

function withFixedUi(settings) {
  return {
    ...settings,
    theme: FIXED_UI.theme,
    cardDensity: FIXED_UI.cardDensity,
    dockScale: FIXED_UI.dockScale,
    dockOffsetY: FIXED_UI.dockOffsetY,
    fabOrder: [...FIXED_UI.fabOrder],
    filterOrder: [...FIXED_UI.filterOrder],
    barThickness: { ...FIXED_UI.barThickness },
    priorityColors: { ...DEFAULT_PRIORITY_COLORS },
    dueColors: { ...DEFAULT_DUE_COLORS },
    listShowContent: FIXED_UI.listShowContent,
    priorityIcons: normalizePriorityIcons(settings.priorityIcons),
    cardDisplay: normalizeCardDisplay(settings.cardDisplay),
  };
}

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

/** Calorie table / today-card tones (eat = caution, burn = green, empty = white, line = day guide). */
export const DEFAULT_CALORIE_TONES = {
  eat: '#ea580c',
  burn: '#16a34a',
  empty: '#ffffff',
  line: '#d9d2c5',
};

export function normalizeCalorieTones(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    eat: safeHexColor(src.eat, DEFAULT_CALORIE_TONES.eat),
    burn: safeHexColor(src.burn, DEFAULT_CALORIE_TONES.burn),
    empty: safeHexColor(src.empty, DEFAULT_CALORIE_TONES.empty),
    line: safeHexColor(src.line, DEFAULT_CALORIE_TONES.line),
  };
}

/** Keep in sync with HEALTH_TREND_RANGES in calorie.js */
const CALORIE_TREND_DAY_OPTIONS = [1, 3, 7, 14, 30, 90, 180, 365];

export function normalizeCalorieTrendDays(raw, fallback = 7) {
  const n = Number(raw);
  if (CALORIE_TREND_DAY_OPTIONS.includes(n)) return n;
  const fb = Number(fallback);
  return CALORIE_TREND_DAY_OPTIONS.includes(fb) ? fb : 7;
}

/** Home-dash pin ids from health sheet (keep in sync with HOME_PIN_IDS in calorie.js). */
const HOME_PIN_ID_OPTIONS = [
  'goal-waist',
  'goal-weight',
  'card-body',
  'card-bmi',
  'card-whtr',
  'card-waistZone',
  'card-ideal',
  'card-weekKg',
  'chart-waist',
  'chart-weight',
  'chart-cal',
  'chart-prot',
  'chart-balance',
  'chart-blKg',
  'chart-mealTime',
  'ex-poses',
  'ex-mus',
];

/** Legacy device-only pin list (migrated into calorie.homePins for cloud sync). */
export function normalizeCalorieHomePins(raw) {
  const allowed = new Set(HOME_PIN_ID_OPTIONS);
  const seen = new Set();
  const out = [];
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    const id = String(item || '').trim();
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function safeHexColor(value, fallback) {
  const v = String(value || '').trim();
  if (HEX_RE.test(v)) return v.length === 4
    ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
    : v.slice(0, 7);
  return fallback;
}

function hexToRgb(hex) {
  const h = safeHexColor(hex, '#000000').slice(1);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Mix `fg` over `bg` by amount (0–1 of fg). */
export function mixHex(fg, bg, amount) {
  const a = Math.max(0, Math.min(1, Number(amount) || 0));
  const [fr, fgG, fb] = hexToRgb(fg);
  const [br, bgG, bb] = hexToRgb(bg);
  return rgbToHex(
    fr * a + br * (1 - a),
    fgG * a + bgG * (1 - a),
    fb * a + bb * (1 - a),
  );
}

/**
 * Concrete hex washes for the calorie table — set as inline CSS vars so
 * Settings color changes always win (no fragile color-mix + transparent).
 */
export function calorieToneCssVars(raw) {
  const t = normalizeCalorieTones(raw);
  const ink = '#333333';
  return {
    '--cal-tone-eat': t.eat,
    '--cal-tone-burn': t.burn,
    '--cal-tone-empty': t.empty,
    '--cal-tone-eat-wash': mixHex(t.eat, t.empty, 0.1),
    '--cal-tone-burn-wash': mixHex(t.burn, t.empty, 0.12),
    '--cal-tone-eat-head': mixHex(t.eat, t.empty, 0.16),
    '--cal-tone-burn-head': mixHex(t.burn, t.empty, 0.14),
    '--cal-tone-eat-ink': mixHex(t.eat, ink, 0.62),
    '--cal-tone-burn-ink': mixHex(t.burn, ink, 0.55),
    '--cal-tone-pos-ink': mixHex(t.burn, ink, 0.7),
    '--cal-tone-neg-ink': mixHex(t.eat, ink, 0.75),
    '--cal-tone-row-line': t.line,
  };
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

export function normalizeCardDisplay(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const pc = src.priorityIconColors && typeof src.priorityIconColors === 'object'
    ? src.priorityIconColors
    : {};
  const colorOrNull = (value, fallback) => {
    if (value == null || value === '') return null;
    return safeHexColor(value, fallback);
  };
  return {
    leadIcon: src.leadIcon !== false,
    tag: normalizeMetaShow(src.tag, DEFAULT_CARD_DISPLAY.tag),
    priority: normalizeMetaShow(src.priority, DEFAULT_CARD_DISPLAY.priority),
    due: normalizeMetaShow(src.due, DEFAULT_CARD_DISPLAY.due),
    recurrence: normalizeMetaShow(src.recurrence, DEFAULT_CARD_DISPLAY.recurrence),
    iconColorMode: src.iconColorMode === 'custom' ? 'custom' : 'auto',
    priorityIconColors: {
      critical: colorOrNull(pc.critical, DEFAULT_PRIORITY_COLORS.critical),
      important: colorOrNull(pc.important, DEFAULT_PRIORITY_COLORS.important),
      urgent: colorOrNull(pc.urgent, DEFAULT_PRIORITY_COLORS.urgent),
      normal: colorOrNull(pc.normal, DEFAULT_PRIORITY_COLORS.normal),
    },
  };
}

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

const FAB_ORDER_IDS = ['group', 'ai'];

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

const FILTER_ORDER_IDS = [...DEFAULT_FILTER_ORDER];

/** Left → right on the filter dock. */
export function normalizeFilterOrder(value) {
  const raw = Array.isArray(value) ? value.map(String) : [];
  const seen = new Set();
  const out = [];
  raw.forEach((id) => {
    if (FILTER_ORDER_IDS.includes(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  });
  FILTER_ORDER_IDS.forEach((id) => {
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
    label: String(src.label || DEFAULT_NOTIFY_PREFS.label).trim().slice(0, 24) || 'แคลโน้ต',
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
      return withFixedUi({
        ...DEFAULTS,
        tagOrder: [],
        barLayout: [...DEFAULT_BAR_LAYOUT],
        notifyPrefs: { ...DEFAULT_NOTIFY_PREFS },
        geminiApiKey: '',
        geminiModel: DEFAULTS.geminiModel,
        aiProfile: '',
        aiTagRules: [],
        cameraSaveToDevice: true,
        cameraFacing: 'environment',
        cameraQuality: 'max',
        notifyMonthPresets: [3, 5, 6],
        lastWorkspaceId: null,
        appMode: 'calorie',
        lastNotepadId: null,
        recentNotepadIds: [],
        calorieTones: normalizeCalorieTones(null),
        calorieTrendDays: normalizeCalorieTrendDays(null),
        calorieHomePins: normalizeCalorieHomePins(null),
      });
    }
    const parsed = JSON.parse(raw);
    const notifyPrefs = normalizeNotifyPrefs(parsed.notifyPrefs, parsed.notificationsEnabled);
    return withFixedUi({
      sortMode: SORT_MODES.includes(parsed.sortMode) ? parsed.sortMode : 'updated',
      tagFilterId: normalizeTagFilterId(parsed.tagFilterId),
      priorityFilter: normalizePriorityFilter(parsed.priorityFilter),
      recurrenceFilter: normalizeRecurrenceFilterSetting(parsed.recurrenceFilter),
      dueScope: ['today', 'soon', 'overdue'].includes(parsed.dueScope) ? parsed.dueScope : null,
      tagOrder: normalizeTagOrder(parsed.tagOrder),
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
      notifyMonthPresets: normalizeMonthPresets(parsed.notifyMonthPresets),
      /** User card/icon prefs — always restore from localStorage */
      priorityIcons: normalizePriorityIcons(parsed.priorityIcons),
      cardDisplay: normalizeCardDisplay(parsed.cardDisplay),
      lastWorkspaceId: parsed.lastWorkspaceId ? String(parsed.lastWorkspaceId) : null,
      appMode: normalizeAppMode(parsed.appMode),
      lastNotepadId: parsed.lastNotepadId ? String(parsed.lastNotepadId) : null,
      recentNotepadIds: normalizeRecentNotepadIds(parsed.recentNotepadIds, parsed.lastNotepadId),
      calorieTones: normalizeCalorieTones(parsed.calorieTones),
      calorieTrendDays: normalizeCalorieTrendDays(parsed.calorieTrendDays),
      calorieHomePins: normalizeCalorieHomePins(parsed.calorieHomePins),
    });
  } catch {
    return withFixedUi({
      ...DEFAULTS,
      tagOrder: [],
      barLayout: [...DEFAULT_BAR_LAYOUT],
      notificationsEnabled: false,
      notifyPrefs: { ...DEFAULT_NOTIFY_PREFS },
      geminiApiKey: '',
      geminiModel: DEFAULTS.geminiModel,
      aiProfile: '',
      aiTagRules: [],
      cameraSaveToDevice: true,
      cameraFacing: 'environment',
      cameraQuality: 'max',
      notifyMonthPresets: [3, 5, 6],
      lastWorkspaceId: null,
      appMode: 'calorie',
      lastNotepadId: null,
      recentNotepadIds: [],
      calorieTones: normalizeCalorieTones(null),
      calorieTrendDays: normalizeCalorieTrendDays(null),
      calorieHomePins: normalizeCalorieHomePins(null),
    });
  }
}

/** Calorie-only product — always normalize to calorie. */
export function normalizeAppMode(_mode) {
  return 'calorie';
}

export function saveSettings(settings) {
  const notifyPrefs = normalizeNotifyPrefs(
    settings.notifyPrefs,
    settings.notificationsEnabled,
  );
  const stamped = touchSettingsCloudStamp(settings);
  const next = withFixedUi({
    ...stamped,
    notifyPrefs,
    notificationsEnabled: notifyPrefs.enabled,
    geminiApiKey: String(settings.geminiApiKey || '').trim().slice(0, 200),
    geminiModel: normalizeGeminiModel(settings.geminiModel),
    aiProfile: normalizeAiProfile(settings.aiProfile),
    aiTagRules: normalizeAiTagRules(settings.aiTagRules),
    cameraSaveToDevice: normalizeCameraSaveToDevice(settings.cameraSaveToDevice),
    cameraFacing: normalizeCameraFacing(settings.cameraFacing),
    cameraQuality: normalizeCameraQuality(settings.cameraQuality),
    notifyMonthPresets: normalizeMonthPresets(settings.notifyMonthPresets),
    lastWorkspaceId: settings.lastWorkspaceId ? String(settings.lastWorkspaceId) : null,
    appMode: normalizeAppMode(settings.appMode),
    lastNotepadId: settings.lastNotepadId ? String(settings.lastNotepadId) : null,
    recentNotepadIds: normalizeRecentNotepadIds(settings.recentNotepadIds, settings.lastNotepadId),
    calorieTones: normalizeCalorieTones(settings.calorieTones),
    calorieTrendDays: normalizeCalorieTrendDays(settings.calorieTrendDays),
    calorieHomePins: normalizeCalorieHomePins(settings.calorieHomePins),
  });
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(next));
}

/** Cloud-syncable settings blob (never includes Gemini API key). */
export function normalizeSettingsSync(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const notifyPrefs = normalizeNotifyPrefs(raw.notifyPrefs, raw.notificationsEnabled);
  const updatedAt = String(raw.updatedAt || '').trim();
  if (!updatedAt) return null;
  return {
    updatedAt,
    sortMode: SORT_MODES.includes(raw.sortMode) ? raw.sortMode : 'updated',
    tagFilterId: normalizeTagFilterId(raw.tagFilterId),
    priorityFilter: normalizePriorityFilter(raw.priorityFilter),
    recurrenceFilter: normalizeRecurrenceFilterSetting(raw.recurrenceFilter),
    dueScope: ['today', 'soon', 'overdue'].includes(raw.dueScope) ? raw.dueScope : null,
    tagOrder: normalizeTagOrder(raw.tagOrder),
    barLayout: normalizeLayout(raw.barLayout),
    notificationsEnabled: notifyPrefs.enabled,
    notifyPrefs,
    geminiModel: normalizeGeminiModel(raw.geminiModel),
    aiProfile: normalizeAiProfile(raw.aiProfile),
    aiTagRules: normalizeAiTagRules(raw.aiTagRules),
    cameraSaveToDevice: normalizeCameraSaveToDevice(raw.cameraSaveToDevice),
    cameraFacing: normalizeCameraFacing(raw.cameraFacing),
    cameraQuality: normalizeCameraQuality(raw.cameraQuality),
    notifyMonthPresets: normalizeMonthPresets(raw.notifyMonthPresets),
    priorityIcons: normalizePriorityIcons(raw.priorityIcons),
    cardDisplay: normalizeCardDisplay(raw.cardDisplay),
    lastWorkspaceId: raw.lastWorkspaceId ? String(raw.lastWorkspaceId) : null,
    appMode: normalizeAppMode(raw.appMode),
    lastNotepadId: raw.lastNotepadId ? String(raw.lastNotepadId) : null,
    recentNotepadIds: normalizeRecentNotepadIds(raw.recentNotepadIds, raw.lastNotepadId),
    calorieTones: normalizeCalorieTones(raw.calorieTones),
    calorieTrendDays: normalizeCalorieTrendDays(raw.calorieTrendDays),
    calorieHomePins: normalizeCalorieHomePins(raw.calorieHomePins),
  };
}

export function settingsForCloud(settings) {
  const s = settings && typeof settings === 'object' ? settings : loadSettings();
  const notifyPrefs = normalizeNotifyPrefs(s.notifyPrefs, s.notificationsEnabled);
  const updatedAt = String(s.cloudUpdatedAt || '').trim() || nowIso();
  return normalizeSettingsSync({
    ...s,
    updatedAt,
    notifyPrefs,
    notificationsEnabled: notifyPrefs.enabled,
  });
}

/** Apply newer cloud settings into local state; preserve API key. */
export function mergeSettingsFromCloud(localSettings, cloudRaw) {
  const cloud = normalizeSettingsSync(cloudRaw);
  if (!cloud) return localSettings;
  const localAt = String(localSettings?.cloudUpdatedAt || '').trim();
  if (localAt && compareStamp(cloud.updatedAt, localAt) <= 0) {
    return localSettings;
  }
  const apiKey = String(localSettings?.geminiApiKey || '').trim();
  const merged = withFixedUi({
    ...localSettings,
    sortMode: cloud.sortMode,
    tagFilterId: cloud.tagFilterId,
    priorityFilter: cloud.priorityFilter,
    recurrenceFilter: cloud.recurrenceFilter,
    dueScope: cloud.dueScope,
    tagOrder: cloud.tagOrder,
    barLayout: cloud.barLayout,
    notificationsEnabled: cloud.notificationsEnabled,
    notifyPrefs: cloud.notifyPrefs,
    geminiApiKey: apiKey,
    geminiModel: cloud.geminiModel,
    aiProfile: cloud.aiProfile,
    aiTagRules: cloud.aiTagRules,
    cameraSaveToDevice: cloud.cameraSaveToDevice,
    cameraFacing: cloud.cameraFacing,
    cameraQuality: cloud.cameraQuality,
    notifyMonthPresets: cloud.notifyMonthPresets,
    priorityIcons: cloud.priorityIcons,
    cardDisplay: cloud.cardDisplay,
    lastWorkspaceId: cloud.lastWorkspaceId,
    appMode: cloud.appMode,
    lastNotepadId: cloud.lastNotepadId,
    recentNotepadIds: cloud.recentNotepadIds,
    calorieTones: cloud.calorieTones,
    calorieTrendDays: cloud.calorieTrendDays,
    calorieHomePins: cloud.calorieHomePins,
    cloudUpdatedAt: cloud.updatedAt,
  });
  return merged;
}

export function touchSettingsCloudStamp(settings) {
  return { ...settings, cloudUpdatedAt: nowIso() };
}

export function normalizeRecentNotepadIds(raw, lastId = null) {
  const seen = new Set();
  const out = [];
  const push = (id) => {
    const s = String(id || '').trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  push(lastId);
  if (Array.isArray(raw)) raw.forEach(push);
  return out.slice(0, 16);
}

export function touchRecentNotepadId(settings, notepadId) {
  const id = String(notepadId || '').trim();
  if (!id) return settings;
  return {
    ...settings,
    lastNotepadId: id,
    recentNotepadIds: normalizeRecentNotepadIds(
      [id, ...(settings.recentNotepadIds || [])],
      id,
    ),
  };
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

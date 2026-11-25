/** Lightweight schedule normalize helpers — kept off the hydrate graph from settings/notes. */

export const RECURRENCE = {
  NONE: null,
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

/** Built-in recurrence chips; month presets from settings are merged in UI. */
export const RECURRENCE_OPTIONS = [
  { id: null, label: 'ไม่ทำซ้ำ', short: '' },
  { id: 'daily', label: 'ทุกวัน', short: 'ทุกวัน' },
  { id: 'weekly', label: 'ทุกสัปดาห์', short: 'ทุกสัปดาห์' },
  { id: 'monthly', label: 'ทุกเดือน', short: 'ทุกเดือน' },
  { id: 'every3mo', label: 'ทุก 3 เดือน', short: '3 ด.' },
  { id: 'every5mo', label: 'ทุก 5 เดือน', short: '5 ด.' },
  { id: 'every6mo', label: 'ทุก 6 เดือน', short: '6 ด.' },
  { id: 'yearly', label: 'ทุกปี', short: 'ทุกปี' },
];

/** List filter chips: all / none / any recurring / each frequency. */
export const RECURRENCE_FILTER_OPTIONS = [
  { id: null, label: 'ทั้งหมด' },
  { id: 'none', label: 'ไม่ทำซ้ำ' },
  { id: 'any', label: 'ทำประจำ' },
  { id: 'daily', label: 'ทุกวัน' },
  { id: 'weekly', label: 'ทุกสัปดาห์' },
  { id: 'monthly', label: 'ทุกเดือน' },
  { id: 'every3mo', label: 'ทุก 3 เดือน' },
  { id: 'every5mo', label: 'ทุก 5 เดือน' },
  { id: 'every6mo', label: 'ทุก 6 เดือน' },
  { id: 'yearly', label: 'ทุกปี' },
];

const FIXED_RECURRENCE = new Set(['daily', 'weekly', 'monthly', 'yearly']);
const MONTH_INTERVAL_RE = /^every(\d+)mo$/;

/** @returns {number|null} months for everyNmo / monthly */
export function monthIntervalFromId(value) {
  if (value === 'monthly') return 1;
  const m = String(value || '').match(MONTH_INTERVAL_RE);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 2 && n <= 36 ? n : null;
}

export function everyMonthsId(months) {
  const n = Math.round(Number(months));
  if (!Number.isFinite(n) || n < 1 || n > 36) return null;
  if (n === 1) return 'monthly';
  return `every${n}mo`;
}

export function normalizeRecurrence(value) {
  if (value == null || value === '' || value === 'none' || value === 'null') return null;
  const v = String(value);
  if (FIXED_RECURRENCE.has(v)) return v;
  if (monthIntervalFromId(v) != null) return v;
  return null;
}

export function normalizeRecurrenceFilter(value) {
  if (
    value === 'none' ||
    value === 'any' ||
    value === 'daily' ||
    value === 'weekly' ||
    value === 'monthly' ||
    value === 'yearly'
  ) {
    return value;
  }
  if (monthIntervalFromId(value) != null) return value;
  return null;
}

/**
 * Notification nag interval — separate from note recurrence (ทำซ้ำประจำ).
 * Reminders-style: keep pinging until the note is done.
 * Month intervals: monthly | everyNmo (N=2..36), counted from scheduled start (มาตรฐาน 09:00).
 */
export const NOTIFY_REPEAT_OPTIONS = [
  { id: 'none', label: 'ครั้งเดียว' },
  { id: 'hourly', label: 'ทุกชั่วโมง' },
  { id: 'daily', label: 'ทุกวัน' },
  { id: 'every2d', label: 'ทุก 2 วัน' },
  { id: 'weekly', label: 'ทุกสัปดาห์' },
  { id: 'monthly', label: 'ทุกเดือน' },
  { id: 'every3mo', label: 'ทุก 3 เดือน' },
  { id: 'every5mo', label: 'ทุก 5 เดือน' },
  { id: 'every6mo', label: 'ทุก 6 เดือน' },
];

const FIXED_NOTIFY_REPEAT = new Set(['none', 'hourly', 'daily', 'every2d', 'weekly', 'monthly']);

export function normalizeNotifyRepeat(value) {
  const v = String(value || 'none');
  if (FIXED_NOTIFY_REPEAT.has(v)) return v;
  if (monthIntervalFromId(v) != null) return v;
  return 'none';
}

/** @param {unknown} raw @returns {number[]} */
export function normalizeMonthPresets(raw) {
  const fallback = [3, 5, 6];
  const list = Array.isArray(raw)
    ? raw
    : String(raw || '')
        .split(/[,|\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
  const out = [];
  const seen = new Set();
  list.forEach((v) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 2 || n > 36) return;
    if (seen.has(n)) return;
    seen.add(n);
    out.push(n);
  });
  out.sort((a, b) => a - b);
  return out.length ? out.slice(0, 12) : fallback;
}

export function normalizeCycleAnchor(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Schedule / calendar helpers for notes. */

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

/** Per-note reminder offset before scheduledAt (Calendar-style). */
export const REMIND_BEFORE_OPTIONS = [
  { id: 'default', label: 'ตามตั้งค่าแอป' },
  { id: 'at', label: 'ตรงเวลา' },
  { id: '5m', label: 'ก่อน 5 นาที' },
  { id: '15m', label: 'ก่อน 15 นาที' },
  { id: '30m', label: 'ก่อน 30 นาที' },
  { id: '1h', label: 'ก่อน 1 ชั่วโมง' },
  { id: '2h', label: 'ก่อน 2 ชั่วโมง' },
  { id: '1d', label: 'ก่อน 1 วัน' },
  { id: '2d', label: 'ก่อน 2 วัน' },
  { id: '1w', label: 'ก่อน 1 สัปดาห์' },
  { id: '2w', label: 'ก่อน 2 สัปดาห์' },
  { id: '1mo', label: 'ก่อน 1 เดือน' },
];

const REMIND_IDS = new Set(REMIND_BEFORE_OPTIONS.map((o) => o.id));

export function normalizeRemindBefore(value) {
  return REMIND_IDS.has(value) ? value : 'default';
}

export function remindBeforeLabel(value) {
  const id = normalizeRemindBefore(value);
  return REMIND_BEFORE_OPTIONS.find((o) => o.id === id)?.label || 'ตามตั้งค่าแอป';
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

export function notifyRepeatLabel(value) {
  const id = normalizeNotifyRepeat(value);
  const known = NOTIFY_REPEAT_OPTIONS.find((o) => o.id === id);
  if (known) return known.label;
  const months = monthIntervalFromId(id);
  if (months) return `ทุก ${months} เดือน`;
  return 'ครั้งเดียว';
}

export function notifyRepeatIntervalMs(value) {
  const id = normalizeNotifyRepeat(value);
  if (id === 'hourly') return 60 * 60 * 1000;
  if (id === 'daily') return 24 * 60 * 60 * 1000;
  if (id === 'every2d') return 2 * 24 * 60 * 60 * 1000;
  if (id === 'weekly') return 7 * 24 * 60 * 60 * 1000;
  const months = monthIntervalFromId(id);
  if (months) return months * 30 * 24 * 60 * 60 * 1000;
  return 0;
}

/** Advance a fire timestamp by notify-repeat unit (calendar months for everyNmo). */
export function advanceNotifyFireAt(fireAtMs, notifyRepeat) {
  const id = normalizeNotifyRepeat(notifyRepeat);
  if (id === 'none' || !Number.isFinite(fireAtMs)) return null;
  const d = new Date(fireAtMs);
  if (id === 'hourly') d.setHours(d.getHours() + 1);
  else if (id === 'daily') d.setDate(d.getDate() + 1);
  else if (id === 'every2d') d.setDate(d.getDate() + 2);
  else if (id === 'weekly') d.setDate(d.getDate() + 7);
  else {
    const months = monthIntervalFromId(id);
    if (!months) return null;
    d.setMonth(d.getMonth() + months);
  }
  return d.getTime();
}

/**
 * When to fire the device notification for a note.
 * @param {string} scheduledAt ISO
 * @param {string} remindBefore
 * @param {number} globalEarlyMinutes from app settings (used when remindBefore === 'default')
 */
export function reminderFireAtMs(scheduledAt, remindBefore, globalEarlyMinutes = 0) {
  const due = new Date(scheduledAt).getTime();
  if (!Number.isFinite(due)) return null;
  const id = normalizeRemindBefore(remindBefore);

  if (id === 'default') {
    const early = Math.max(0, Number(globalEarlyMinutes) || 0);
    return due - early * 60 * 1000;
  }
  if (id === 'at') return due;
  if (id === '5m') return due - 5 * 60 * 1000;
  if (id === '15m') return due - 15 * 60 * 1000;
  if (id === '30m') return due - 30 * 60 * 1000;
  if (id === '1h') return due - 60 * 60 * 1000;
  if (id === '2h') return due - 2 * 60 * 60 * 1000;
  if (id === '1d') return due - 24 * 60 * 60 * 1000;
  if (id === '2d') return due - 2 * 24 * 60 * 60 * 1000;
  if (id === '1w') return due - 7 * 24 * 60 * 60 * 1000;
  if (id === '2w') return due - 14 * 24 * 60 * 60 * 1000;
  if (id === '1mo') {
    const d = new Date(due);
    d.setMonth(d.getMonth() - 1);
    return d.getTime();
  }
  return due;
}

export function filterNotesByRecurrence(notes, filter) {
  const f = normalizeRecurrenceFilter(filter);
  if (!f) return notes;
  if (f === 'none') {
    return notes.filter((note) => !normalizeRecurrence(note.recurrence));
  }
  if (f === 'any') {
    return notes.filter((note) => Boolean(normalizeRecurrence(note.recurrence)));
  }
  return notes.filter((note) => normalizeRecurrence(note.recurrence) === f);
}

export function countNotesByRecurrence(notes, filter) {
  return filterNotesByRecurrence(notes, filter).length;
}

export function recurrenceLabel(value, { short = false } = {}) {
  const id = normalizeRecurrence(value);
  if (!id) return '';
  const opt = RECURRENCE_OPTIONS.find((o) => o.id === id);
  if (opt) return short ? opt.short : opt.label;
  const months = monthIntervalFromId(id);
  if (months) return short ? `${months} ด.` : `ทุก ${months} เดือน`;
  return '';
}

/** Advance scheduledAt by one recurrence step. */
export function nextOccurrenceIso(iso, freq) {
  const recurrence = normalizeRecurrence(freq);
  if (!recurrence) return iso || null;
  const d = new Date(iso || Date.now());
  if (Number.isNaN(d.getTime())) return null;
  if (recurrence === 'daily') d.setDate(d.getDate() + 1);
  else if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
  else if (recurrence === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else {
    const months = monthIntervalFromId(recurrence);
    if (!months) return iso || null;
    d.setMonth(d.getMonth() + months);
  }
  return d.toISOString();
}

/**
 * Build recurrence / notify-repeat option lists including user month presets.
 * @param {number[]} [monthPresets]
 */
export function buildRecurrenceSelectOptions(monthPresets = [3, 5, 6]) {
  const base = [
    { id: '', label: 'ไม่ซ้ำ' },
    { id: 'daily', label: 'ทุกวัน' },
    { id: 'weekly', label: 'ทุกสัปดาห์' },
    { id: 'monthly', label: 'ทุกเดือน' },
  ];
  const months = normalizeMonthPresets(monthPresets);
  months.forEach((n) => {
    base.push({ id: everyMonthsId(n), label: `ทุก ${n} เดือน` });
  });
  base.push({ id: 'yearly', label: 'ทุกปี' });
  return base;
}

export function buildNotifyRepeatSelectOptions(monthPresets = [3, 5, 6]) {
  const base = [
    { id: 'none', label: 'ครั้งเดียว' },
    { id: 'hourly', label: 'ทุกชั่วโมง' },
    { id: 'daily', label: 'ทุกวัน' },
    { id: 'every2d', label: 'ทุก 2 วัน' },
    { id: 'weekly', label: 'ทุกสัปดาห์' },
    { id: 'monthly', label: 'ทุกเดือน' },
  ];
  normalizeMonthPresets(monthPresets).forEach((n) => {
    base.push({ id: everyMonthsId(n), label: `ทุก ${n} เดือน` });
  });
  return base;
}

/** Editor chips: ไม่ทำซ้ำ + frequencies + month presets + yearly. */
export function buildRecurrenceChipOptions(monthPresets = [3, 5, 6]) {
  const base = [
    { id: null, label: 'ไม่ทำซ้ำ', short: '' },
    { id: 'daily', label: 'ทุกวัน', short: 'ทุกวัน' },
    { id: 'weekly', label: 'ทุกสัปดาห์', short: 'ทุกสัปดาห์' },
    { id: 'monthly', label: 'ทุกเดือน', short: 'ทุกเดือน' },
  ];
  normalizeMonthPresets(monthPresets).forEach((n) => {
    base.push({ id: everyMonthsId(n), label: `ทุก ${n} เดือน`, short: `${n} ด.` });
  });
  base.push({ id: 'yearly', label: 'ทุกปี', short: 'ทุกปี' });
  return base;
}

/** List filter menu options including user month presets. */
export function buildRecurrenceFilterOptions(monthPresets = [3, 5, 6]) {
  const base = [
    { id: null, label: 'ทั้งหมด' },
    { id: 'none', label: 'ไม่ทำซ้ำ' },
    { id: 'any', label: 'ทำประจำ' },
    { id: 'daily', label: 'ทุกวัน' },
    { id: 'weekly', label: 'ทุกสัปดาห์' },
    { id: 'monthly', label: 'ทุกเดือน' },
  ];
  normalizeMonthPresets(monthPresets).forEach((n) => {
    base.push({ id: everyMonthsId(n), label: `ทุก ${n} เดือน` });
  });
  base.push({ id: 'yearly', label: 'ทุกปี' });
  return base;
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

/** Next occurrence on or after today (keeps time-of-day from the base). */
export function nextUpcomingOccurrenceIso(iso, freq) {
  const recurrence = normalizeRecurrence(freq);
  if (!recurrence) return iso || null;
  let next = iso || new Date().toISOString();
  const today = startOfDay().getTime();
  let guard = 0;
  while (startOfDay(new Date(next)).getTime() < today && guard < 4000) {
    next = nextOccurrenceIso(next, recurrence);
    guard += 1;
  }
  return next;
}

/**
 * Complete a note: recurring → advance schedule and stay active; else mark done.
 * If the occurrence was snoozed, advance from cycleAnchor (original cycle point),
 * not from the postponed scheduledAt — so the series does not drift.
 * @param {object} note
 * @param {(n: object) => object} markDone
 */
export function completeOrAdvanceNote(note, markDone) {
  const recurrence = normalizeRecurrence(note.recurrence);
  if (!recurrence) {
    return { note: markDone(note), advanced: false };
  }
  const base = note.cycleAnchor || note.scheduledAt || new Date().toISOString();
  let next = nextOccurrenceIso(base, recurrence);
  const today = startOfDay().getTime();
  let guard = 0;
  while (next && startOfDay(new Date(next)).getTime() < today && guard < 4000) {
    next = nextOccurrenceIso(next, recurrence);
    guard += 1;
  }
  return {
    note: {
      ...note,
      scheduledAt: next,
      cycleAnchor: null,
      completedAt: null,
      updatedAt: new Date().toISOString(),
    },
    advanced: true,
  };
}

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dateKeyFromDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dateKeyFromIso(iso) {
  if (!iso) return null;
  return dateKeyFromDate(new Date(iso));
}

export function setNoteSchedule(note, scheduledAt) {
  return {
    ...note,
    scheduledAt: scheduledAt || null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Postpone this occurrence only — keep the note active, move scheduledAt.
 * Does not mark done. For recurring notes, freezes cycleAnchor so "ทำแล้ว"
 * still advances from the original cycle point (series does not drift).
 *
 * Reminder fires from the new scheduledAt (plus remind-before / notify-repeat).
 */
export const SNOOZE_OPTIONS = [
  { id: '1d', label: 'พรุ่งนี้', short: '+1 ว' },
  { id: '3d', label: '+3 วัน', short: '+3 ว' },
  { id: '1w', label: '+1 สัปดาห์', short: '+1 ส.' },
  { id: '1mo', label: '+1 เดือน', short: '+1 ด.' },
];

export function normalizeSnoozeId(value) {
  return SNOOZE_OPTIONS.some((o) => o.id === value) ? value : null;
}

export function normalizeCycleAnchor(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Compute new scheduledAt for a snooze.
 * Uses existing time-of-day; if overdue/missing → today (or now) then add offset.
 */
export function snoozeScheduledAt(iso, snoozeId, now = new Date()) {
  const id = normalizeSnoozeId(snoozeId);
  if (!id) return iso || null;

  let d = iso ? new Date(iso) : new Date(defaultScheduleIso(now));
  if (Number.isNaN(d.getTime())) d = new Date(defaultScheduleIso(now));

  if (d.getTime() < now.getTime()) {
    const todaySameTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      d.getHours(),
      d.getMinutes(),
      0,
      0,
    );
    d = todaySameTime.getTime() >= now.getTime()
      ? todaySameTime
      : new Date(defaultScheduleIso(now));
    // If default 09:00 today is still in the past, start from now (keep minutes rounded).
    if (d.getTime() < now.getTime()) {
      d = new Date(now);
      d.setSeconds(0, 0);
    }
  }

  if (id === '1d') d.setDate(d.getDate() + 1);
  else if (id === '3d') d.setDate(d.getDate() + 3);
  else if (id === '1w') d.setDate(d.getDate() + 7);
  else if (id === '1mo') d.setMonth(d.getMonth() + 1);

  return d.toISOString();
}

export function snoozeNote(note, snoozeId) {
  const nextAt = snoozeScheduledAt(note?.scheduledAt, snoozeId);
  if (!nextAt) return note;
  return applySnoozeToNote(note, nextAt);
}

/** Postpone to an exact ISO datetime (custom picker). */
export function snoozeNoteTo(note, iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return note;
  return applySnoozeToNote(note, d.toISOString());
}

function applySnoozeToNote(note, nextAt) {
  const hasRecurrence = Boolean(normalizeRecurrence(note?.recurrence));
  let cycleAnchor = normalizeCycleAnchor(note?.cycleAnchor);
  if (hasRecurrence && !cycleAnchor && note?.scheduledAt) {
    cycleAnchor = normalizeCycleAnchor(note.scheduledAt);
  }
  return {
    ...note,
    scheduledAt: nextAt,
    cycleAnchor: hasRecurrence ? cycleAnchor : null,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Clear postpone anchor when the user manually sets a new due date. */
export function clearCycleAnchor(note) {
  if (!note?.cycleAnchor) return note;
  return { ...note, cycleAnchor: null };
}

/**
 * List scope by due date: all | today | soon (≤7d incl today) | overdue.
 */
export function normalizeDueScope(value) {
  return value === 'today' || value === 'soon' || value === 'overdue' ? value : null;
}

export function filterNotesByDueScope(notes, scope, now = new Date()) {
  const s = normalizeDueScope(scope);
  if (!s) return notes;
  const today = startOfDay(now).getTime();
  const soonEnd = today + 7 * 86400000;
  return notes.filter((note) => {
    if (!note?.scheduledAt) return false;
    const day = startOfDay(new Date(note.scheduledAt)).getTime();
    if (Number.isNaN(day)) return false;
    if (s === 'overdue') return day < today;
    if (s === 'today') return day === today;
    if (s === 'soon') return day >= today && day <= soonEnd;
    return true;
  });
}

export const DUE_SCOPE_OPTIONS = [
  { id: null, label: 'ทุกกำหนด' },
  { id: 'today', label: 'วันนี้' },
  { id: 'soon', label: '7 วัน' },
  { id: 'overdue', label: 'เลยกำหนด' },
];

export function sortNotesBySchedule(notes) {
  const withSchedule = notes
    .filter((n) => n.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const without = notes
    .filter((n) => !n.scheduledAt)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return [...withSchedule, ...without];
}

export function getScheduleStatus(scheduledAt) {
  if (!scheduledAt) return 'none';
  const today = startOfDay().getTime();
  const day = startOfDay(new Date(scheduledAt)).getTime();
  if (day < today) return 'overdue';
  if (day === today) return 'today';
  return 'upcoming';
}

/**
 * How close a schedule is — for the list proximity column.
 * @returns {{ label: string, level: 'none'|'far'|'mid'|'near'|'today'|'overdue', days: number|null }}
 */
export function scheduleProximity(scheduledAt, now = new Date()) {
  if (!scheduledAt) {
    return { label: '', level: 'none', days: null };
  }
  const due = new Date(scheduledAt);
  if (Number.isNaN(due.getTime())) {
    return { label: '', level: 'none', days: null };
  }
  const today = startOfDay(now).getTime();
  const day = startOfDay(due).getTime();
  const days = Math.round((day - today) / 86400000);

  if (days < 0) {
    const n = Math.abs(days);
    return {
      label: `−${n}ว`,
      level: 'overdue',
      days,
    };
  }
  if (days === 0) {
    const msLeft = due.getTime() - now.getTime();
    if (msLeft <= 0) {
      return { label: 'ถึง', level: 'overdue', days: 0 };
    }
    const hours = Math.max(1, Math.round(msLeft / 3600000));
    if (hours < 24) {
      return { label: `${hours}ชม`, level: 'today', days: 0 };
    }
    return { label: 'วันนี้', level: 'today', days: 0 };
  }
  if (days === 1) return { label: 'พรุ่ง', level: 'near', days: 1 };
  if (days <= 7) return { label: `${days}ว`, level: days <= 2 ? 'near' : 'mid', days };
  return { label: `${days}ว`, level: 'far', days };
}

export function relativeDayLabel(iso) {
  if (!iso) return '';
  const today = startOfDay().getTime();
  const day = startOfDay(new Date(iso)).getTime();
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return 'วันนี้';
  if (diff === 1) return 'พรุ่งนี้';
  if (diff === -1) return 'เมื่อวาน';
  if (diff > 1) return `อีก ${diff} วัน`;
  return `เลย ${Math.abs(diff)} วัน`;
}

export function shortDate(iso) {
  try {
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function formatScheduleDisplay(iso) {
  try {
    return new Intl.DateTimeFormat('th-TH', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

/** Default local time for new/migrated note schedules (แจ้งเตือนมาตรฐาน). */
export const DEFAULT_SCHEDULE_HOUR = 9;
export const DEFAULT_SCHEDULE_MINUTE = 0;

/**
 * Keep the calendar day in local time; set clock to the default schedule hour.
 * @param {string|Date|number} isoOrDate
 * @param {{ hour?: number, minute?: number }} [opts]
 * @returns {string|null} ISO string
 */
export function snapToDefaultScheduleTime(isoOrDate, opts = {}) {
  if (isoOrDate == null || isoOrDate === '') return null;
  const d = isoOrDate instanceof Date ? new Date(isoOrDate.getTime()) : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  const hour = Number.isFinite(opts.hour) ? opts.hour : DEFAULT_SCHEDULE_HOUR;
  const minute = Number.isFinite(opts.minute) ? opts.minute : DEFAULT_SCHEDULE_MINUTE;
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Today (or given date's day) at the default schedule time, as ISO. */
export function defaultScheduleIso(fromDate = new Date()) {
  return snapToDefaultScheduleTime(fromDate);
}

export function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${da}T${h}:${mi}`;
}

/** datetime-local value at default hour for a given day (default: today). */
export function defaultDatetimeLocalValue(fromDate = new Date()) {
  return toDatetimeLocalValue(defaultScheduleIso(fromDate));
}

export function fromDatetimeLocalValue(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function notesOnDate(notes, dateKey) {
  return notes.filter((note) => dateKeyFromIso(note.scheduledAt) === dateKey);
}

export function countNotesByDate(notes) {
  const map = new Map();
  notes.forEach((note) => {
    const key = dateKeyFromIso(note.scheduledAt);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

export function getUpcomingScheduledNotes(notes, limit = 8) {
  const today = startOfDay();
  return notes
    .filter((note) => note.scheduledAt && new Date(note.scheduledAt) >= today)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, limit);
}

const WEEKDAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

export function buildMonthGrid(year, month, notes) {
  const counts = countNotesByDate(notes);
  const todayKey = dateKeyFromDate(new Date());
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ empty: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = dateKeyFromDate(date);
    cells.push({
      empty: false,
      day,
      dateKey: key,
      count: counts.get(key) || 0,
      isToday: key === todayKey,
    });
  }

  return { year, month, weekdays: WEEKDAYS, cells };
}

export function monthLabel(year, month) {
  return new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  );
}

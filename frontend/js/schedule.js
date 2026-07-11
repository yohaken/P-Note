/** Schedule / calendar helpers for notes. */

export const RECURRENCE = {
  NONE: null,
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

export const RECURRENCE_OPTIONS = [
  { id: null, label: 'ไม่ทำซ้ำ', short: '' },
  { id: 'daily', label: 'ทุกวัน', short: 'ทุกวัน' },
  { id: 'weekly', label: 'ทุกสัปดาห์', short: 'ทุกสัปดาห์' },
  { id: 'monthly', label: 'ทุกเดือน', short: 'ทุกเดือน' },
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
  { id: 'yearly', label: 'ทุกปี' },
];

export function normalizeRecurrence(value) {
  if (value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly') {
    return value;
  }
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
 */
export const NOTIFY_REPEAT_OPTIONS = [
  { id: 'none', label: 'ครั้งเดียว' },
  { id: 'hourly', label: 'ทุกชั่วโมง' },
  { id: 'daily', label: 'ทุกวัน' },
  { id: 'every2d', label: 'ทุก 2 วัน' },
  { id: 'weekly', label: 'ทุกสัปดาห์' },
  { id: 'monthly', label: 'ทุกเดือน' },
];

const NOTIFY_REPEAT_IDS = new Set(NOTIFY_REPEAT_OPTIONS.map((o) => o.id));

export function normalizeNotifyRepeat(value) {
  return NOTIFY_REPEAT_IDS.has(value) ? value : 'none';
}

export function notifyRepeatLabel(value) {
  const id = normalizeNotifyRepeat(value);
  return NOTIFY_REPEAT_OPTIONS.find((o) => o.id === id)?.label || 'ครั้งเดียว';
}

export function notifyRepeatIntervalMs(value) {
  const id = normalizeNotifyRepeat(value);
  if (id === 'hourly') return 60 * 60 * 1000;
  if (id === 'daily') return 24 * 60 * 60 * 1000;
  if (id === 'every2d') return 2 * 24 * 60 * 60 * 1000;
  if (id === 'weekly') return 7 * 24 * 60 * 60 * 1000;
  if (id === 'monthly') return 30 * 24 * 60 * 60 * 1000; // approx; monthly step uses calendar below
  return 0;
}

/** Advance a fire timestamp by notify-repeat unit. */
export function advanceNotifyFireAt(fireAtMs, notifyRepeat) {
  const id = normalizeNotifyRepeat(notifyRepeat);
  if (id === 'none' || !Number.isFinite(fireAtMs)) return null;
  const d = new Date(fireAtMs);
  if (id === 'hourly') d.setHours(d.getHours() + 1);
  else if (id === 'daily') d.setDate(d.getDate() + 1);
  else if (id === 'every2d') d.setDate(d.getDate() + 2);
  else if (id === 'weekly') d.setDate(d.getDate() + 7);
  else if (id === 'monthly') d.setMonth(d.getMonth() + 1);
  else return null;
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
  const opt = RECURRENCE_OPTIONS.find((o) => o.id === normalizeRecurrence(value));
  if (!opt || !opt.id) return '';
  return short ? opt.short : opt.label;
}

/** Advance scheduledAt by one recurrence step. */
export function nextOccurrenceIso(iso, freq) {
  const recurrence = normalizeRecurrence(freq);
  if (!recurrence) return iso || null;
  const d = new Date(iso || Date.now());
  if (Number.isNaN(d.getTime())) return null;
  if (recurrence === 'daily') d.setDate(d.getDate() + 1);
  else if (recurrence === 'weekly') d.setDate(d.getDate() + 7);
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (recurrence === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
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
 * @param {object} note
 * @param {(n: object) => object} markDone
 */
export function completeOrAdvanceNote(note, markDone) {
  const recurrence = normalizeRecurrence(note.recurrence);
  if (!recurrence) {
    return { note: markDone(note), advanced: false };
  }
  const base = note.scheduledAt || new Date().toISOString();
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

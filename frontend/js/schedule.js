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

export function normalizeRecurrence(value) {
  if (value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly') {
    return value;
  }
  return null;
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

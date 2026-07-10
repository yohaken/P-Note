/** Schedule / calendar helpers for notes. */

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

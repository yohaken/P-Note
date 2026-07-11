/**
 * Device notifications for note schedules.
 * Uses Notification API + a lightweight SW (no caching).
 */
import { notePriority, NOTE_PRIORITY } from './notes.js?v=61';
import { normalizeRemindBefore, reminderFireAtMs, remindBeforeLabel } from './schedule.js?v=80';

const NOTIFIED_KEY = 'pnote_notified_map';
const SW_URL = './sw-notify.js';
const MAX_TIMER_MS = 14 * 24 * 60 * 60 * 1000; // up to 2 weeks ahead
const PAST_GRACE_MS = 6 * 60 * 60 * 1000;

const PRIORITY_RANK = {
  [NOTE_PRIORITY.NORMAL]: 0,
  [NOTE_PRIORITY.IMPORTANT]: 1,
  [NOTE_PRIORITY.URGENT]: 2,
  [NOTE_PRIORITY.CRITICAL]: 3,
};

const timers = new Map();
let swReg = null;
let activePrefs = null;

function loadNotified() {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveNotified(map) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function notifyStamp(note) {
  return `${note.scheduledAt}::${normalizeRemindBefore(note.remindBefore)}`;
}

function markNotified(note) {
  const map = loadNotified();
  map[note.id] = notifyStamp(note);
  saveNotified(map);
}

function wasNotified(note) {
  return loadNotified()[note.id] === notifyStamp(note);
}

export function notificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission() {
  if (!notificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function registerNotifyServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    swReg = await navigator.serviceWorker.register(SW_URL, { scope: './' });
    return swReg;
  } catch (err) {
    console.warn('notify SW register failed', err);
    return null;
  }
}

export async function requestNotificationPermission() {
  if (!notificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function clearTimers() {
  timers.forEach((id) => clearTimeout(id));
  timers.clear();
}

function prefsOrDefault(prefs) {
  return prefs && typeof prefs === 'object' ? prefs : activePrefs || {};
}

function noteMatchesPrefs(note, prefs) {
  const p = prefsOrDefault(prefs);
  const min = PRIORITY_RANK[p.minPriority] ?? 0;
  const rank = PRIORITY_RANK[notePriority(note)] ?? 0;
  if (rank < min) return false;

  const tagIds = Array.isArray(p.tagIds) ? p.tagIds.filter(Boolean) : [];
  if (tagIds.length) {
    const noteTags = Array.isArray(note.tagIds) ? note.tagIds : [];
    if (!tagIds.some((id) => noteTags.includes(id))) return false;
  }
  return true;
}

function formatWhen(iso) {
  const when = iso ? new Date(iso) : null;
  if (!when || Number.isNaN(when.getTime())) return '';
  return when.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildTitle(note, prefs) {
  const p = prefsOrDefault(prefs);
  const label = String(p.label || 'P-Note').trim() || 'P-Note';
  const noteTitle = (note.title && String(note.title).trim()) || 'โน้ตถึงกำหนด';
  return `${label} · ${noteTitle}`;
}

function buildBody(note, prefs) {
  const p = prefsOrDefault(prefs);
  const previewMode = p.preview || 'full';
  const time = formatWhen(note.scheduledAt);
  const remind = remindBeforeLabel(note.remindBefore);
  const remindBit =
    normalizeRemindBefore(note.remindBefore) === 'at' ||
    normalizeRemindBefore(note.remindBefore) === 'default'
      ? ''
      : ` · ${remind}`;

  if (previewMode === 'hidden') {
    return time ? `ถึงกำหนด ${time}${remindBit}` : 'มีกำหนดการถึงเวลาแล้ว';
  }
  if (previewMode === 'title') {
    return (time || 'ถึงกำหนดแล้ว') + remindBit;
  }

  const preview = String(note.content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  if (time && preview) return `${time}${remindBit} · ${preview}`;
  if (time) return time + remindBit;
  return preview || 'ถึงกำหนดแล้ว';
}

function buildOptions(note, prefs, { test = false } = {}) {
  const p = prefsOrDefault(prefs);
  const silent = p.sound === false;
  const vibrateOn = p.vibrate !== false && !silent;
  const options = {
    body: test ? 'ทดสอบการแจ้งเตือนตามค่าที่ตั้งไว้' : buildBody(note, p),
    tag: test
      ? 'pnote-test'
      : `pnote-${note.id}-${note.scheduledAt}-${normalizeRemindBefore(note.remindBefore)}`,
    renotify: true,
    silent,
    requireInteraction: Boolean(p.persistent),
    data: {
      noteId: note?.id || null,
      scheduledAt: note?.scheduledAt || null,
      remindBefore: normalizeRemindBefore(note?.remindBefore),
      url: './note.html',
      label: String(p.label || 'P-Note'),
    },
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
  };
  if (vibrateOn) options.vibrate = [180, 80, 180];
  return options;
}

async function displayNotification(title, options) {
  const reg = swReg || (await navigator.serviceWorker?.getRegistration?.());
  if (reg?.showNotification) {
    await reg.showNotification(title, options);
    return true;
  }
  // eslint-disable-next-line no-new
  new Notification(title, options);
  return true;
}

async function showNoteNotification(note, prefs) {
  if (!notificationSupported() || Notification.permission !== 'granted') return false;
  if (!note?.id || !note.scheduledAt) return false;
  if (wasNotified(note)) return false;
  if (!noteMatchesPrefs(note, prefs)) return false;

  const p = prefsOrDefault(prefs);
  try {
    await displayNotification(buildTitle(note, p), buildOptions(note, p));
    markNotified(note);
    return true;
  } catch (err) {
    console.warn('show notification failed', err);
    return false;
  }
}

function fireAtForNote(note, prefs) {
  return reminderFireAtMs(
    note.scheduledAt,
    note.remindBefore,
    prefsOrDefault(prefs).earlyMinutes || 0,
  );
}

function scheduleOne(note, fireAt, prefs) {
  const delay = fireAt - Date.now();
  if (delay > MAX_TIMER_MS) return;
  if (timers.has(note.id)) {
    clearTimeout(timers.get(note.id));
    timers.delete(note.id);
  }
  if (delay <= 0) {
    showNoteNotification(note, prefs);
    return;
  }
  const id = setTimeout(() => {
    timers.delete(note.id);
    showNoteNotification(note, prefs);
  }, delay);
  timers.set(note.id, id);
}

/**
 * @param {Array} notes
 * @param {object} prefs notifyPrefs from settings
 */
export function syncNoteNotifications(notes, prefs = {}) {
  activePrefs = prefs;
  clearTimers();
  const enabled = Boolean(prefs?.enabled);
  if (!enabled || !notificationSupported() || Notification.permission !== 'granted') {
    return { scheduled: 0, dueNow: 0 };
  }

  const list = Array.isArray(notes) ? notes : [];
  const now = Date.now();
  let scheduled = 0;
  let dueNow = 0;

  list.forEach((note) => {
    if (!note?.scheduledAt) return;
    if (!noteMatchesPrefs(note, prefs)) return;
    if (wasNotified(note)) return;

    const fireAt = fireAtForNote(note, prefs);
    if (fireAt == null) return;
    const dueTime = new Date(note.scheduledAt).getTime();

    if (fireAt <= now) {
      // Still relevant until a few hours after the due time
      if (Number.isFinite(dueTime) && now <= dueTime + PAST_GRACE_MS) {
        dueNow += 1;
        showNoteNotification(note, prefs);
      }
      return;
    }

    if (fireAt - now <= MAX_TIMER_MS) {
      scheduleOne(note, fireAt, prefs);
      scheduled += 1;
    }
  });

  return { scheduled, dueNow };
}

export async function sendTestNotification(prefs = {}) {
  if (!notificationSupported()) return { ok: false, reason: 'unsupported' };
  let perm = Notification.permission;
  if (perm !== 'granted') {
    perm = await requestNotificationPermission();
  }
  if (perm !== 'granted') return { ok: false, reason: perm };

  await registerNotifyServiceWorker();
  const p = prefsOrDefault(prefs);
  const label = String(p.label || 'P-Note').trim() || 'P-Note';
  try {
    await displayNotification(
      `${label} · ทดสอบ`,
      buildOptions(
        {
          id: 'test',
          scheduledAt: new Date().toISOString(),
          title: 'ทดสอบ',
          content: '',
          remindBefore: 'at',
        },
        p,
        { test: true },
      ),
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

/** Exposed for automated checks. */
export function __debugReminderFireAt(note, prefs) {
  return fireAtForNote(note, prefs);
}

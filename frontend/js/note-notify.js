/**
 * Device notifications for note schedules.
 * Uses Notification API + a lightweight SW (no caching).
 *
 * ทำซ้ำประจำ (recurrence) = advances the note's due date when completed.
 * แจ้งเตือนซ้ำ (notifyRepeat) = nag interval until the note is done — separate.
 */
import { notePriority, NOTE_PRIORITY } from './notes.js?v=121';
import {
  advanceNotifyFireAt,
  normalizeNotifyRepeat,
  normalizeRemindBefore,
  notifyRepeatLabel,
  reminderFireAtMs,
  remindBeforeLabel,
} from './schedule.js?v=121';

const NOTIFIED_KEY = 'pnote_notified_map';
const SW_URL = './sw-notify.js';
const MAX_TIMER_MS = 14 * 24 * 60 * 60 * 1000;
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

function configKey(note) {
  return `${note.scheduledAt}::${normalizeRemindBefore(note.remindBefore)}::${normalizeNotifyRepeat(note.notifyRepeat)}`;
}

function getNotifyState(note) {
  const raw = loadNotified()[note.id];
  if (!raw) return null;
  if (typeof raw === 'string') {
    // legacy: just a stamp string
    return { key: raw, lastFireAt: null };
  }
  if (raw && typeof raw === 'object') {
    return {
      key: String(raw.key || ''),
      lastFireAt: Number.isFinite(raw.lastFireAt) ? raw.lastFireAt : null,
    };
  }
  return null;
}

function setNotifyState(note, lastFireAt) {
  const map = loadNotified();
  map[note.id] = { key: configKey(note), lastFireAt };
  saveNotified(map);
}

function configChanged(note) {
  const st = getNotifyState(note);
  if (!st) return false;
  return st.key !== configKey(note);
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
  const bits = [];
  const rb = normalizeRemindBefore(note.remindBefore);
  if (rb !== 'at' && rb !== 'default') bits.push(remindBeforeLabel(note.remindBefore));
  const nr = normalizeNotifyRepeat(note.notifyRepeat);
  if (nr !== 'none') bits.push(notifyRepeatLabel(note.notifyRepeat));
  const extra = bits.length ? ` · ${bits.join(' · ')}` : '';

  if (previewMode === 'hidden') {
    return time ? `ถึงกำหนด ${time}${extra}` : 'มีกำหนดการถึงเวลาแล้ว';
  }
  if (previewMode === 'title') {
    return (time || 'ถึงกำหนดแล้ว') + extra;
  }

  const preview = String(note.content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  if (time && preview) return `${time}${extra} · ${preview}`;
  if (time) return time + extra;
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
      : `pnote-${note.id}-${normalizeNotifyRepeat(note.notifyRepeat)}`,
    renotify: true,
    silent,
    requireInteraction: Boolean(p.persistent),
    data: {
      noteId: note?.id || null,
      scheduledAt: note?.scheduledAt || null,
      remindBefore: normalizeRemindBefore(note?.remindBefore),
      notifyRepeat: normalizeNotifyRepeat(note?.notifyRepeat),
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

function fireAtForNote(note, prefs) {
  return reminderFireAtMs(
    note.scheduledAt,
    note.remindBefore,
    prefsOrDefault(prefs).earlyMinutes || 0,
  );
}

/**
 * Next time this note should alert.
 * - none: once at base fire time
 * - repeat: after last fire, advance; keep nagging while note stays active
 */
function resolveNextFireAt(note, prefs) {
  const base = fireAtForNote(note, prefs);
  if (base == null) return null;

  const repeat = normalizeNotifyRepeat(note.notifyRepeat);
  const st = configChanged(note) ? null : getNotifyState(note);

  if (repeat === 'none') {
    if (st?.lastFireAt) return null; // already fired once for this config
    return base;
  }

  // Repeating nag
  if (!st?.lastFireAt) return base;

  let next = advanceNotifyFireAt(st.lastFireAt, repeat);
  if (next == null) return null;
  const now = Date.now();
  // Catch up if app was closed for a while — fire at the next upcoming slot
  let guard = 0;
  while (next < now - 30 * 1000 && guard < 400) {
    const advanced = advanceNotifyFireAt(next, repeat);
    if (advanced == null || advanced <= next) break;
    next = advanced;
    guard += 1;
  }
  return next;
}

async function showNoteNotification(note, prefs, fireAt) {
  if (!notificationSupported() || Notification.permission !== 'granted') return false;
  if (!note?.id || !note.scheduledAt) return false;
  if (!noteMatchesPrefs(note, prefs)) return false;

  const p = prefsOrDefault(prefs);
  try {
    await displayNotification(buildTitle(note, p), buildOptions(note, p));
    setNotifyState(note, fireAt || Date.now());
    return true;
  } catch (err) {
    console.warn('show notification failed', err);
    return false;
  }
}

function scheduleOne(note, fireAt, prefs) {
  const delay = fireAt - Date.now();
  if (timers.has(note.id)) {
    clearTimeout(timers.get(note.id));
    timers.delete(note.id);
  }
  // Far future: arm a wake timer, then re-resolve (covers >14d dues while page stays open).
  if (delay > MAX_TIMER_MS) {
    const id = setTimeout(() => {
      timers.delete(note.id);
      const next = resolveNextFireAt(note, prefs);
      if (next != null) scheduleOne(note, next, prefs);
    }, MAX_TIMER_MS);
    timers.set(note.id, id);
    return true;
  }
  if (delay <= 0) {
    showNoteNotification(note, prefs, fireAt).then(() => {
      // After a repeating fire, schedule the following one
      if (normalizeNotifyRepeat(note.notifyRepeat) !== 'none') {
        const next = resolveNextFireAt(note, prefs);
        if (next != null && next > Date.now()) scheduleOne(note, next, prefs);
      }
    });
    return true;
  }
  const id = setTimeout(() => {
    timers.delete(note.id);
    showNoteNotification(note, prefs, fireAt).then(() => {
      if (normalizeNotifyRepeat(note.notifyRepeat) !== 'none') {
        const next = resolveNextFireAt(note, prefs);
        if (next != null) scheduleOne(note, next, prefs);
      }
    });
  }, delay);
  timers.set(note.id, id);
  return true;
}

let keepaliveTimer = null;

/** Re-arm notifications periodically while the page stays open. */
export function startNotifyKeepalive(getNotes, getPrefs, intervalMs = 15 * 60 * 1000) {
  stopNotifyKeepalive();
  keepaliveTimer = setInterval(() => {
    try {
      const notes = typeof getNotes === 'function' ? getNotes() : getNotes;
      const prefs = typeof getPrefs === 'function' ? getPrefs() : getPrefs;
      syncNoteNotifications(notes, prefs);
    } catch (err) {
      console.warn('notify keepalive failed', err);
    }
  }, Math.max(60 * 1000, intervalMs));
}

export function stopNotifyKeepalive() {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
}

/**
 * @param {Array} notes active notes
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

    const fireAt = resolveNextFireAt(note, prefs);
    if (fireAt == null) return;

    const dueTime = new Date(note.scheduledAt).getTime();
    const repeating = normalizeNotifyRepeat(note.notifyRepeat) !== 'none';

    if (fireAt <= now) {
      // One-shot: only within grace around due. Repeating: always ok while active.
      const okWindow =
        repeating ||
        (Number.isFinite(dueTime) && now <= dueTime + PAST_GRACE_MS) ||
        now - fireAt <= PAST_GRACE_MS;
      if (okWindow) {
        dueNow += 1;
        scheduleOne(note, fireAt, prefs);
      }
      return;
    }

    if (fireAt - now <= MAX_TIMER_MS) {
      if (scheduleOne(note, fireAt, prefs)) scheduled += 1;
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
          notifyRepeat: 'none',
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

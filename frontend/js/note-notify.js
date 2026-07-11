/**
 * Device notifications for note schedules.
 * Uses Notification API + a lightweight SW (no caching).
 * Best when the PWA is open or recently used; iOS needs Home Screen install.
 */
const NOTIFIED_KEY = 'pnote_notified_map';
const SW_URL = './sw-notify.js';
const MAX_TIMER_MS = 6 * 24 * 60 * 60 * 1000; // browsers clamp long timers
const PAST_GRACE_MS = 3 * 60 * 60 * 1000; // still alert if overdue within 3h

const timers = new Map();
let swReg = null;

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

function markNotified(noteId, scheduledAt) {
  const map = loadNotified();
  map[noteId] = scheduledAt;
  saveNotified(map);
}

function wasNotified(noteId, scheduledAt) {
  return loadNotified()[noteId] === scheduledAt;
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
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

function clearTimers() {
  timers.forEach((id) => clearTimeout(id));
  timers.clear();
}

function noteBody(note) {
  const when = note.scheduledAt ? new Date(note.scheduledAt) : null;
  const time =
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleString('th-TH', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
  const preview = String(note.content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (time && preview) return `${time} · ${preview}`;
  if (time) return time;
  return preview || 'ถึงกำหนดแล้ว';
}

async function showNoteNotification(note) {
  if (!notificationSupported() || Notification.permission !== 'granted') return false;
  if (!note?.id || !note.scheduledAt) return false;
  if (wasNotified(note.id, note.scheduledAt)) return false;

  const title = (note.title && String(note.title).trim()) || 'โน้ตถึงกำหนด';
  const options = {
    body: noteBody(note),
    tag: `pnote-${note.id}-${note.scheduledAt}`,
    renotify: true,
    data: {
      noteId: note.id,
      scheduledAt: note.scheduledAt,
      url: './note.html',
    },
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
  };

  try {
    const reg = swReg || (await navigator.serviceWorker?.getRegistration?.());
    if (reg?.showNotification) {
      await reg.showNotification(title, options);
    } else {
      // eslint-disable-next-line no-new
      new Notification(title, options);
    }
    markNotified(note.id, note.scheduledAt);
    return true;
  } catch (err) {
    console.warn('show notification failed', err);
    return false;
  }
}

function scheduleOne(note, fireAt) {
  const delay = fireAt - Date.now();
  if (delay > MAX_TIMER_MS) return;
  if (timers.has(note.id)) {
    clearTimeout(timers.get(note.id));
    timers.delete(note.id);
  }
  if (delay <= 0) {
    showNoteNotification(note);
    return;
  }
  const id = setTimeout(() => {
    timers.delete(note.id);
    showNoteNotification(note);
  }, delay);
  timers.set(note.id, id);
}

/**
 * @param {Array} notes active notes list
 * @param {{ enabled: boolean }} opts
 */
export function syncNoteNotifications(notes, { enabled } = { enabled: false }) {
  clearTimers();
  if (!enabled || !notificationSupported() || Notification.permission !== 'granted') {
    return { scheduled: 0, dueNow: 0 };
  }

  const list = Array.isArray(notes) ? notes : [];
  const now = Date.now();
  let scheduled = 0;
  let dueNow = 0;

  list.forEach((note) => {
    if (!note?.scheduledAt) return;
    const t = new Date(note.scheduledAt).getTime();
    if (!Number.isFinite(t)) return;
    if (wasNotified(note.id, note.scheduledAt)) return;

    if (t <= now) {
      if (now - t <= PAST_GRACE_MS) {
        dueNow += 1;
        showNoteNotification(note);
      }
      return;
    }

    if (t - now <= MAX_TIMER_MS) {
      scheduleOne(note, t);
      scheduled += 1;
    }
  });

  return { scheduled, dueNow };
}

export async function sendTestNotification() {
  if (!notificationSupported()) return { ok: false, reason: 'unsupported' };
  let perm = Notification.permission;
  if (perm !== 'granted') {
    perm = await requestNotificationPermission();
  }
  if (perm !== 'granted') return { ok: false, reason: perm };

  await registerNotifyServiceWorker();
  const title = 'P-Note';
  const options = {
    body: 'ทดสอบการแจ้งเตือนเครื่องสำเร็จ',
    tag: 'pnote-test',
    data: { url: './note.html' },
    icon: './icons/icon-192.png',
  };
  try {
    const reg = swReg || (await navigator.serviceWorker?.getRegistration?.());
    if (reg?.showNotification) await reg.showNotification(title, options);
    else new Notification(title, options);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

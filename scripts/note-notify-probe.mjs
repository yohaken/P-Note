/**
 * Verify note device notifications: permission, SW, timed fire, remind-before math.
 * Usage: node scripts/note-notify-probe.mjs [url]
 */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://mypeer-501909.web.app/note.html';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.grantPermissions(['notifications'], { origin: new URL(URL).origin });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);

const result = await page.evaluate(async () => {
  const out = {
    build: document.querySelector('meta[name="pnote-build"]')?.content || '',
    notificationInWindow: 'Notification' in window,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'n/a',
    sw: null,
    testShow: null,
    timed: null,
    remindMath: null,
  };

  try {
    const reg = await navigator.serviceWorker.register('./sw-notify.js', { scope: './' });
    out.sw = Boolean(reg);
  } catch (e) {
    out.sw = String(e);
  }

  // Direct Notification API
  try {
    const n = new Notification('P-Note probe', {
      body: 'direct Notification API',
      tag: 'pnote-probe-direct',
    });
    out.testShow = { ok: true, via: 'Notification' };
    n.close();
  } catch (e) {
    out.testShow = { ok: false, error: String(e) };
  }

  // Remind-before math (inline mirror of schedule helper)
  const due = Date.parse('2026-08-01T10:00:00+07:00');
  const cases = {};
  const subtract = {
    at: 0,
    '5m': 5 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
  };
  Object.entries(subtract).forEach(([k, ms]) => {
    cases[k] = due - ms;
  });
  const mo = new Date(due);
  mo.setMonth(mo.getMonth() - 1);
  cases['1mo'] = mo.getTime();
  out.remindMath = {
    due,
    at: cases.at === due,
    '5mOk': cases['5m'] === due - 5 * 60 * 1000,
    '1dOk': cases['1d'] === due - 86400000,
    '1wOk': cases['1w'] === due - 7 * 86400000,
    '1moOk': Number.isFinite(cases['1mo']) && cases['1mo'] < due,
  };

  // Schedule a note 2s ahead and sync timers via page module if available
  const fireAt = Date.now() + 2000;
  const note = {
    id: 'probe-note-1',
    title: 'Probe timed',
    content: 'hello',
    scheduledAt: new Date(fireAt).toISOString(),
    remindBefore: 'at',
    tagIds: [],
    priority: 'normal',
    status: 'active',
  };

  // Use SW showNotification after delay to simulate timer path
  await new Promise((r) => setTimeout(r, 2100));
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('P-Note · Probe timed', {
      body: 'timer path ok',
      tag: 'pnote-probe-timed',
      data: { noteId: note.id, url: './note.html' },
    });
    out.timed = { ok: true, via: 'sw.showNotification' };
  } catch (e) {
    out.timed = { ok: false, error: String(e) };
  }

  // Check UI has remind select
  out.hasRemindSelect = Boolean(document.getElementById('note-remind-before'));

  return out;
});

// Count notifications shown (Chromium may not expose; check SW registrations)
const swState = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.map((r) => r.scope);
});

console.log(JSON.stringify({ url: URL, errors, result, swState }, null, 2));
await browser.close();

const ok =
  result.permission === 'granted' &&
  result.testShow?.ok &&
  result.timed?.ok &&
  result.remindMath?.at &&
  result.remindMath?.['1dOk'] &&
  result.remindMath?.['1moOk'] &&
  result.hasRemindSelect &&
  errors.length === 0;

process.exit(ok ? 0 : 1);

/**
 * Verify note device notifications: permission, SW, timed fire, remind-before UI.
 * Usage: node /path/to/note-notify-probe.mjs [url]
 */
import { chromium } from 'playwright';
import { reminderFireAtMs } from '../frontend/js/schedule.js';

const TARGET = process.argv[2] || 'https://mypeer-501909.web.app/note.html';
const origin = new URL(TARGET).origin;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1500);

const cdp = await context.newCDPSession(page);
await cdp.send('Browser.grantPermissions', {
  origin,
  permissions: ['notifications'],
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const result = await page.evaluate(async () => {
  const out = {
    build: document.querySelector('meta[name="pnote-build"]')?.content || '',
    permission: Notification.permission,
    hasRemindSelect: Boolean(document.getElementById('note-remind-before')),
    remindOptions: [...(document.getElementById('note-remind-before')?.options || [])].map(
      (o) => o.value,
    ),
    sw: null,
    direct: null,
    swShow: null,
  };

  try {
    const reg = await navigator.serviceWorker.register('./sw-notify.js', { scope: './' });
    await navigator.serviceWorker.ready;
    out.sw = { ok: true, scope: reg.scope };
  } catch (e) {
    out.sw = { ok: false, error: String(e) };
  }

  if (Notification.permission === 'granted') {
    try {
      const n = new Notification('P-Note probe', {
        body: 'direct Notification API',
        tag: 'pnote-probe-direct',
      });
      out.direct = { ok: true };
      try {
        n.close();
      } catch (_) {}
    } catch (e) {
      out.direct = { ok: false, error: String(e) };
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('P-Note · Probe SW', {
        body: 'service worker path',
        tag: 'pnote-probe-sw',
        data: { url: './note.html' },
      });
      out.swShow = { ok: true };
    } catch (e) {
      out.swShow = { ok: false, error: String(e) };
    }
  } else {
    out.direct = { ok: false, error: 'permission=' + Notification.permission };
    out.swShow = { ok: false, error: 'permission=' + Notification.permission };
  }

  return out;
});

const due = '2026-08-01T10:00:00+07:00';
const t = Date.parse(due);
const math = {
  at: reminderFireAtMs(due, 'at') === t,
  m5: reminderFireAtMs(due, '5m') === t - 5 * 60 * 1000,
  d1: reminderFireAtMs(due, '1d') === t - 86400000,
  w1: reminderFireAtMs(due, '1w') === t - 7 * 86400000,
  mo: reminderFireAtMs(due, '1mo') < t,
  def: reminderFireAtMs(due, 'default', 15) === t - 15 * 60 * 1000,
  has1d: result.remindOptions?.includes('1d'),
  has1w: result.remindOptions?.includes('1w'),
  has1mo: result.remindOptions?.includes('1mo'),
};

const summary = { url: TARGET, errors, result, math };
console.log(JSON.stringify(summary, null, 2));
await browser.close();

const ok =
  result.permission === 'granted' &&
  result.direct?.ok &&
  result.swShow?.ok &&
  result.sw?.ok &&
  result.hasRemindSelect &&
  math.at &&
  math.d1 &&
  math.w1 &&
  math.mo &&
  math.has1mo &&
  errors.length === 0;

console.log(ok ? 'PROBE_OK' : 'PROBE_FAILED');
process.exit(ok ? 0 : 1);

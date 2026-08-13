/**
 * Assert Apple-style calendar sheet: exclusive view, vertical months, year zoom.
 * Usage: TEST_URL=http://localhost:5000/note.html node scripts/test-calendar-sheet.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.TEST_URL || 'http://localhost:5000/note.html';
const outDir = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const auth = document.getElementById('auth-overlay');
  if (auth) auth.hidden = true;
  document.body.classList.remove('auth-required');
});

async function snap(name) {
  const p = path.join(outDir, name);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function sheetState() {
  return page.evaluate(() => {
    const list = document.getElementById('list-view');
    const cal = document.getElementById('calendar-view');
    const scroll = document.getElementById('cal-scroll');
    const year = document.getElementById('cal-year-view');
    const notes = document.getElementById('cal-notes');
    return {
      bodyCalendarMode: document.body.classList.contains('calendar-mode'),
      zoom: cal?.dataset?.calZoom || null,
      modeName: document.getElementById('mode-switch-name')?.textContent || '',
      listDisplay: list ? getComputedStyle(list).display : null,
      calDisplay: cal ? getComputedStyle(cal).display : null,
      monthBlocks: scroll ? scroll.querySelectorAll('.cal-month-block').length : 0,
      scrollHidden: Boolean(scroll?.hidden),
      yearHidden: Boolean(year?.hidden),
      yearMonths: year ? year.querySelectorAll('.cal-year-month').length : 0,
      notesHidden: Boolean(notes?.hidden),
      notesOpen: Boolean(cal?.classList.contains('cal-notes-open')),
      hasToday: Boolean(document.getElementById('cal-today-btn')),
      hasZoomOut: Boolean(document.getElementById('cal-zoom-out')),
      hasZoomIn: Boolean(document.getElementById('cal-zoom-in')),
    };
  });
}

await snap('cal-apple-work.png');
await page.click('#dock-mode-calendar');
await page.waitForTimeout(500);
const monthState = await sheetState();
await snap('cal-apple-month.png');

// Tap a day (prefer today, else first numbered cell)
await page.evaluate(() => {
  const today = document.querySelector('#cal-scroll .cal-cell.today:not(.empty)');
  const any = document.querySelector('#cal-scroll .cal-cell[data-date-key]');
  (today || any)?.click();
});
await page.waitForTimeout(300);
const dayState = await sheetState();
await snap('cal-apple-day-sheet.png');

await page.click('#cal-zoom-out');
await page.waitForTimeout(400);
const yearState = await sheetState();
await snap('cal-apple-year.png');

await page.click('#cal-zoom-in');
await page.waitForTimeout(400);
const backMonth = await sheetState();

await page.click('#dock-mode-work');
await page.waitForTimeout(300);
const workState = await sheetState();

const passExclusive =
  monthState.bodyCalendarMode &&
  monthState.listDisplay === 'none' &&
  monthState.calDisplay !== 'none' &&
  monthState.monthBlocks >= 12;

const passDaySheet = dayState.notesOpen === true && dayState.notesHidden === false;

const passYearZoom =
  yearState.zoom === 'year' &&
  yearState.yearHidden === false &&
  yearState.scrollHidden === true &&
  yearState.yearMonths === 12 &&
  backMonth.zoom === 'month' &&
  backMonth.scrollHidden === false;

const passWork =
  workState.bodyCalendarMode === false && workState.calDisplay === 'none';

const report = {
  url,
  passExclusive,
  passDaySheet,
  passYearZoom,
  passWork,
  monthState,
  dayState,
  yearState,
  backMonth,
  workState,
  pageErrors: errors.slice(0, 8),
};

console.log(JSON.stringify(report, null, 2));
if (!passExclusive || !passDaySheet || !passYearZoom || !passWork) process.exitCode = 1;
await browser.close();

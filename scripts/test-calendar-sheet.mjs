/**
 * Assert calendar is an exclusive sheet (not stacked on list-view).
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

// Dismiss auth gate if present (listeners should still be wired)
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
    const search = document.getElementById('note-search-row');
    const empty = document.getElementById('empty-state');
    const filters = document.getElementById('filter-dock-filters');
    return {
      bodyCalendarMode: document.body.classList.contains('calendar-mode'),
      modeName: document.getElementById('mode-switch-name')?.textContent || '',
      listHidden: Boolean(list?.hidden),
      listDisplay: list ? getComputedStyle(list).display : null,
      calHidden: Boolean(cal?.hidden),
      calDisplay: cal ? getComputedStyle(cal).display : null,
      searchDisplay: search ? getComputedStyle(search).display : null,
      emptyDisplay: empty ? getComputedStyle(empty).display : null,
      filtersDisplay: filters ? getComputedStyle(filters).display : null,
      calGridCells: document.querySelectorAll('#cal-grid .cal-cell').length,
      topbarHidden: Boolean(document.getElementById('board-topbar')?.hidden),
    };
  });
}

const workShot = await snap('calendar-sheet-work.png');
await page.click('#dock-mode-calendar');
await page.waitForTimeout(400);
const calState = await sheetState();
const calShot = await snap('calendar-sheet-calendar.png');

await page.click('#dock-mode-work');
await page.waitForTimeout(400);
const workState = await sheetState();
const workBackShot = await snap('calendar-sheet-work-back.png');

await page.click('#dock-mode-calendar');
await page.waitForTimeout(400);
// Simulate back-from-editor path
await page.evaluate(() => {
  document.body.classList.add('calendar-mode');
});
// Prefer calling showView if exported on module; fallback click already done
const afterCal = await sheetState();

const passExclusive =
  calState.bodyCalendarMode === true &&
  calState.listDisplay === 'none' &&
  calState.calDisplay !== 'none' &&
  calState.calHidden === false &&
  calState.calGridCells > 0;

const passNoListChrome =
  calState.searchDisplay === 'none' &&
  (calState.emptyDisplay === 'none' || calState.listDisplay === 'none') &&
  calState.filtersDisplay === 'none';

const passWorkRestored =
  workState.bodyCalendarMode === false &&
  workState.calDisplay === 'none' &&
  workState.listDisplay !== 'none';

const report = {
  url,
  passExclusive,
  passNoListChrome,
  passWorkRestored,
  calState,
  workState,
  afterCal,
  shots: { workShot, calShot, workBackShot },
  pageErrors: errors.slice(0, 8),
};

console.log(JSON.stringify(report, null, 2));

if (!passExclusive || !passNoListChrome || !passWorkRestored) {
  process.exitCode = 1;
}

await browser.close();

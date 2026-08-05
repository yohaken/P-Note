/**
 * Verifies list-first boot: work cards from localStorage before/without wiping data,
 * and that boot/list-paint load before app.js.
 *
 * Usage: TEST_URL=http://localhost:5000/note.html node scripts/test-list-first-boot.mjs
 */
import { chromium } from 'playwright';

const url = process.env.TEST_URL || 'http://localhost:5000/note.html';

const sample = {
  version: 7,
  updatedAt: new Date().toISOString(),
  tags: [{ id: 'tg1', name: 'Peerland', color: '#22c55e', icon: 'land', createdAt: new Date().toISOString() }],
  notes: [
    {
      id: 'n1',
      title: 'งานทดสอบโหลดเร็ว',
      details: 'รายละเอียด',
      status: 'active',
      priority: 'important',
      tagIds: ['tg1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  trash: [],
  workspaces: [{ id: 'ws-default', name: 'หลัก' }],
  notepads: [],
};

function modName(u) {
  const m = u.match(/\/js\/([^/?]+)/);
  return m ? m[1] : null;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.evaluate((data) => {
  localStorage.setItem('pnote_local_data', JSON.stringify(data));
  localStorage.setItem(
    'pnote_active_build',
    document.querySelector('meta[name="pnote-build"]')?.content || '',
  );
}, sample);

const jsOrder = [];
page.on('request', (req) => {
  const name = modName(req.url());
  if (name) jsOrder.push(name);
});

const t0 = Date.now();
await page.reload({ waitUntil: 'domcontentloaded' });

await page.waitForFunction(
  () => document.querySelectorAll('#notes-list .note-card').length >= 1,
  { timeout: 8000 },
);
const tCards = Date.now() - t0;

const early = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#notes-list .note-card')];
  const raw = localStorage.getItem('pnote_local_data');
  let notesLen = -1;
  try {
    notesLen = JSON.parse(raw || '{}').notes?.length ?? 0;
  } catch {
    notesLen = -2;
  }
  return {
    boot: document.documentElement.dataset.pnoteBoot,
    hydrated: document.documentElement.dataset.pnoteHydrated || null,
    cards: cards.length,
    titles: cards.map((c) => c.querySelector('.card-title')?.textContent?.trim()),
    notesLen,
    rawLen: raw?.length || 0,
  };
});

await page.waitForFunction(() => document.documentElement.dataset.pnoteHydrated === '1', {
  timeout: 15000,
});
const tHydrated = Date.now() - t0;
await page.waitForTimeout(300);

const late = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('#notes-list .note-card')];
  const raw = localStorage.getItem('pnote_local_data');
  let notesLen = -1;
  try {
    notesLen = JSON.parse(raw || '{}').notes?.length ?? 0;
  } catch {
    notesLen = -2;
  }
  return {
    cards: cards.length,
    titles: cards.map((c) => c.querySelector('.card-title')?.textContent?.trim()),
    notesLen,
    rawLen: raw?.length || 0,
  };
});

const idx = (name) => jsOrder.indexOf(name);
const order = {
  sequence: jsOrder.filter((n) =>
    /^(boot|list-paint|notes|local|settings|icons|schedule|app|sheet|gemini|camera)\.js$/.test(n),
  ),
  bootBeforeApp: idx('boot.js') >= 0 && idx('boot.js') < idx('app.js'),
  listPaintBeforeApp: idx('list-paint.js') >= 0 && idx('list-paint.js') < idx('app.js'),
  notesBeforeApp: idx('notes.js') >= 0 && idx('notes.js') < idx('app.js'),
  sheetNotBeforeApp: idx('sheet.js') < 0 || idx('sheet.js') >= idx('app.js'),
  noGemini: idx('gemini.js') < 0,
  noCamera: idx('camera.js') < 0,
};

console.log('TIMING_MS', { cards: tCards, hydrated: tHydrated });
console.log('EARLY', early);
console.log('LATE', late);
console.log('ORDER', order);

const ok =
  early.cards >= 1 &&
  early.notesLen >= 1 &&
  late.cards >= 1 &&
  late.notesLen >= 1 &&
  order.bootBeforeApp &&
  order.listPaintBeforeApp &&
  order.notesBeforeApp &&
  order.sheetNotBeforeApp &&
  order.noGemini &&
  order.noCamera &&
  early.titles?.some((t) => t?.includes('งานทดสอบ'));

console.log(ok ? 'PASS' : 'FAIL');
await browser.close();
process.exit(ok ? 0 : 1);

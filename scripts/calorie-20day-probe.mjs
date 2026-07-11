/**
 * Probe Calorie page quirks with 20 days of backfilled data.
 * Usage: node scripts/calorie-20day-probe.mjs [url]
 */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://mypeer-501909.web.app/index.html';

function localDateStr(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function shiftDate(iso, n) {
  const x = new Date(iso + 'T12:00:00');
  x.setDate(x.getDate() + n);
  return localDateStr(x);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const findings = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') findings.push({ type: 'console-error', text: msg.text() });
});
page.on('pageerror', (err) => findings.push({ type: 'pageerror', text: String(err) }));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1500);

// Scenario A: mimic "used app today first, then try to backfill"
const scenarioA = await page.evaluate(() => {
  const SETTINGS_KEY = 'calorieTracker:settings';
  const PREFIX = 'calorieTracker:';
  const today = (() => {
    const n = new Date();
    return (
      n.getFullYear() +
      '-' +
      String(n.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(n.getDate()).padStart(2, '0')
    );
  })();

  // wipe calorie day keys + settings for clean probe
  const kill = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) kill.push(k);
  }
  kill.forEach((k) => localStorage.removeItem(k));

  const settings = {
    proteinMultiplier: 1.6,
    theme: 'dark',
    lastCompensationPct: 0,
    programStartDate: today, // as if first use was today
    followToday: true,
    lastViewedDate: today,
    profile: {
      weight: '80',
      waist: '90',
      targetWeight: '70',
      targetWaist: '80',
      weightLog: { [today]: 80 },
      waistLog: { [today]: 90 },
      birthDate: '1990-01-01',
    },
    templates: [],
    exerciseTemplates: [],
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  localStorage.setItem(
    PREFIX + today,
    JSON.stringify({
      meals: [{ id: 'm1', calories: 1800, protein: 120, time: '12:00' }],
      exercises: [],
    }),
  );

  return { today, start: today };
});

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const afterTodayFirst = await page.evaluate(() => {
  const start = document.getElementById('programStartDate')?.value || '';
  const dateLabel = document.getElementById('dateDisplay')?.textContent || '';
  const prevDisabled = document.getElementById('btnPrevDay')?.disabled;
  const est = document.getElementById('estVal')?.textContent;
  const bal = document.getElementById('balance')?.textContent;
  const bsum = document.getElementById('bsumStrip')?.textContent;
  return { start, dateLabel, prevDisabled, est, bal, bsum };
});

// Try go back 19 days via UI (should be blocked if start=today)
for (let i = 0; i < 5; i++) {
  await page.click('#btnPrevDay').catch(() => {});
  await page.waitForTimeout(80);
}
const stuckAtStart = await page.evaluate(() => ({
  dateLabel: document.getElementById('dateDisplay')?.textContent || '',
  prevDisabled: document.getElementById('btnPrevDay')?.disabled,
  start: document.getElementById('programStartDate')?.value || '',
}));

// Scenario B: proper 20-day backfill (start = today-19)
const scenarioB = await page.evaluate(() => {
  const SETTINGS_KEY = 'calorieTracker:settings';
  const PREFIX = 'calorieTracker:';
  const localDateStr = (d) =>
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0');
  const shift = (iso, n) => {
    const x = new Date(iso + 'T12:00:00');
    x.setDate(x.getDate() + n);
    return localDateStr(x);
  };
  const today = localDateStr(new Date());
  const start = shift(today, -19);

  const kill = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) kill.push(k);
  }
  kill.forEach((k) => localStorage.removeItem(k));

  const weightLog = {};
  const waistLog = {};
  weightLog[start] = 82;
  waistLog[start] = 92;

  for (let i = 0; i < 20; i++) {
    const d = shift(start, i);
    const w = 82 - i * 0.05;
    if (i % 3 === 0) weightLog[d] = Math.round(w * 10) / 10;
    if (i % 5 === 0) waistLog[d] = Math.round((92 - i * 0.08) * 10) / 10;

    const meals = [
      { id: 'b' + i, calories: 450 + (i % 5) * 20, protein: 30 + (i % 4), time: '08:00' },
      { id: 'l' + i, calories: 650 + (i % 7) * 15, protein: 40, time: '12:30' },
      { id: 'd' + i, calories: 550, protein: 35, time: '19:00' },
    ];
    const exercises =
      i % 2 === 0
        ? [{ id: 'e' + i, calories: 200 + (i % 3) * 50, note: 'walk', time: '17:00' }]
        : [];
    localStorage.setItem(PREFIX + d, JSON.stringify({ meals, exercises }));
  }

  const settings = {
    proteinMultiplier: 1.6,
    theme: 'dark',
    lastCompensationPct: 5,
    programStartDate: start,
    followToday: true,
    lastViewedDate: today,
    chartPeriodDays: 30,
    profile: {
      weight: String(weightLog[Object.keys(weightLog).sort().pop()]),
      waist: String(waistLog[Object.keys(waistLog).sort().pop()] || 90),
      targetWeight: '70',
      targetWaist: '80',
      weightLog,
      waistLog,
      birthDate: '1990-01-01',
      age: '36',
    },
    templates: [],
    exerciseTemplates: [],
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  return { today, start, days: 20, weightLogDays: Object.keys(weightLog).length };
});

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const todaySnapshot = await page.evaluate(() => ({
  dateLabel: document.getElementById('dateDisplay')?.textContent || '',
  start: document.getElementById('programStartDate')?.value || '',
  weight: document.getElementById('profileWeight')?.value || '',
  est: document.getElementById('estVal')?.textContent,
  bal: document.getElementById('balance')?.textContent,
  cal: document.getElementById('totalCal')?.textContent,
  bsum: document.getElementById('bsumStrip')?.textContent,
  period: document.getElementById('periodGrid')?.innerText?.slice(0, 400) || '',
  prevDisabled: document.getElementById('btnPrevDay')?.disabled,
}));

// Walk back through all 20 days and collect anomalies
const walk = await page.evaluate(async () => {
  const out = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = document.getElementById('btnPrevDay');
  for (let i = 0; i < 25; i++) {
    const snap = {
      i,
      date: document.getElementById('dateDisplay')?.textContent || '',
      weight: document.getElementById('profileWeight')?.value || '',
      cal: document.getElementById('totalCal')?.textContent,
      bal: document.getElementById('balance')?.textContent,
      est: document.getElementById('estVal')?.textContent,
      prot: document.getElementById('protRemain')?.textContent,
      bsum: (document.getElementById('bsumStrip')?.textContent || '').slice(0, 120),
      prevDisabled: btn?.disabled,
      inactive: (document.getElementById('bsumStrip')?.textContent || '').includes('ก่อนวันเริ่ม'),
      noWeight: (document.getElementById('bsumStrip')?.textContent || '').includes('กรอกน้ำหนัก'),
    };
    out.push(snap);
    if (btn?.disabled) break;
    btn.click();
    await sleep(120);
  }
  return out;
});

// Scenario C: start=today but meals exist for past 20 days (orphan backfill)
const scenarioC = await page.evaluate(() => {
  const SETTINGS_KEY = 'calorieTracker:settings';
  const PREFIX = 'calorieTracker:';
  const localDateStr = (d) =>
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0');
  const shift = (iso, n) => {
    const x = new Date(iso + 'T12:00:00');
    x.setDate(x.getDate() + n);
    return localDateStr(x);
  };
  const today = localDateStr(new Date());
  const startWrong = today;
  const realStart = shift(today, -19);

  const kill = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) kill.push(k);
  }
  kill.forEach((k) => localStorage.removeItem(k));

  for (let i = 0; i < 20; i++) {
    const d = shift(realStart, i);
    localStorage.setItem(
      PREFIX + d,
      JSON.stringify({
        meals: [{ id: 'x' + i, calories: 1600, protein: 100, time: '12:00' }],
        exercises: [],
      }),
    );
  }

  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      proteinMultiplier: 1.6,
      theme: 'dark',
      lastCompensationPct: 0,
      programStartDate: startWrong,
      followToday: true,
      lastViewedDate: today,
      profile: {
        weight: '80',
        weightLog: { [today]: 80 },
        waistLog: {},
        targetWeight: '70',
      },
    }),
  );

  // How many day keys exist vs how many are "active"
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX) && /^\d{4}-\d{2}-\d{2}$/.test(k.slice(PREFIX.length))) {
      keys.push(k.slice(PREFIX.length));
    }
  }
  keys.sort();
  const active = keys.filter((d) => d >= startWrong);
  return {
    today,
    startWrong,
    realStart,
    dayKeys: keys.length,
    activeKeys: active.length,
    orphanKeys: keys.length - active.length,
  };
});

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const orphanUi = await page.evaluate(() => ({
  start: document.getElementById('programStartDate')?.value,
  prevDisabled: document.getElementById('btnPrevDay')?.disabled,
  periodText: document.getElementById('periodGrid')?.innerText || '',
  dateLabel: document.getElementById('dateDisplay')?.textContent,
}));

// Re-seed clean 20-day demo for the probe browser (not user's phone)
await page.evaluate(() => {
  const SETTINGS_KEY = 'calorieTracker:settings';
  const PREFIX = 'calorieTracker:';
  const localDateStr = (d) =>
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0');
  const shift = (iso, n) => {
    const x = new Date(iso + 'T12:00:00');
    x.setDate(x.getDate() + n);
    return localDateStr(x);
  };
  const today = localDateStr(new Date());
  const start = shift(today, -19);
  const kill = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) kill.push(k);
  }
  kill.forEach((k) => localStorage.removeItem(k));
  const weightLog = { [start]: 82 };
  const waistLog = { [start]: 92 };
  for (let i = 0; i < 20; i++) {
    const d = shift(start, i);
    if (i % 3 === 0) weightLog[d] = Math.round((82 - i * 0.05) * 10) / 10;
    localStorage.setItem(
      PREFIX + d,
      JSON.stringify({
        meals: [
          { id: 'b' + i, calories: 500, protein: 35, time: '08:00' },
          { id: 'l' + i, calories: 700, protein: 45, time: '12:30' },
          { id: 'd' + i, calories: 600, protein: 40, time: '19:00' },
        ],
        exercises: i % 2 === 0 ? [{ id: 'e' + i, calories: 250, note: 'run', time: '17:00' }] : [],
      }),
    );
  }
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      proteinMultiplier: 1.6,
      theme: 'dark',
      lastCompensationPct: 5,
      programStartDate: start,
      followToday: false,
      lastViewedDate: start,
      chartPeriodDays: 30,
      profile: {
        weight: '81',
        waist: '90',
        targetWeight: '70',
        targetWaist: '80',
        weightLog,
        waistLog,
        birthDate: '1990-01-01',
      },
    }),
  );
});

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const demoReady = await page.evaluate(() => ({
  start: document.getElementById('programStartDate')?.value,
  dateLabel: document.getElementById('dateDisplay')?.textContent,
  followHint: 'opened on start day',
  cal: document.getElementById('totalCal')?.textContent,
  est: document.getElementById('estVal')?.textContent,
  weight: document.getElementById('profileWeight')?.value,
}));

const anomalies = walk.filter(
  (s) =>
    s.inactive ||
    s.noWeight ||
    s.cal === '—' ||
    s.est === '—' ||
    s.prot === '—' ||
    !s.weight,
);

console.log(
  JSON.stringify(
    {
      url: URL,
      scenarioA,
      afterTodayFirst,
      stuckAtStart,
      scenarioB,
      todaySnapshot,
      walkCount: walk.length,
      walkFirst: walk[0],
      walkLast: walk[walk.length - 1],
      anomalies: anomalies.slice(0, 15),
      anomalyCount: anomalies.length,
      scenarioC,
      orphanUi,
      demoReady,
      findings,
    },
    null,
    2,
  ),
);

await browser.close();

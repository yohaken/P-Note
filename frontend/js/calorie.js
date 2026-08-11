/**
 * Calorie spreadsheet (Phase 1) — day rows matching the personal sheet layout.
 * Meals are "kcal,protein" cells; derived columns are computed, not stored.
 */

export const CALORIE_PAYLOAD_VERSION = 1;
export const DEFAULT_PROTEIN_FACTOR = 1.5;
export const DEFAULT_KCAL_PER_KG = 7700;
export const DEFAULT_BASE_KCAL = 1784;
export const MEAL_SLOTS = 7;

const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function nowIso() {
  return new Date().toISOString();
}

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function round(n, digits = 2) {
  if (!Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Parse "130,27" / "130 27" / "130" → { cal, prot }. */
export function parseMealCell(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { cal: 0, prot: 0, empty: true };
  const parts = s.split(/[,;\s]+/).filter(Boolean);
  const cal = Number(String(parts[0] || '').replace(/[^\d.-]/g, ''));
  const prot = parts.length > 1
    ? Number(String(parts[1] || '').replace(/[^\d.-]/g, ''))
    : 0;
  return {
    cal: Number.isFinite(cal) ? cal : 0,
    prot: Number.isFinite(prot) ? prot : 0,
    empty: false,
  };
}

export function formatMealCell(cal, prot) {
  if (!Number.isFinite(cal) && !Number.isFinite(prot)) return '';
  const c = Number.isFinite(cal) ? Math.round(cal) : 0;
  const p = Number.isFinite(prot) ? round(prot, 1) : 0;
  if (!c && !p) return '';
  return p ? `${c},${p}` : String(c);
}

/**
 * Quick-add meal text → { cal, prot, label }.
 * Accepts "130,27", "350", "ข้าวต้ม 180,12", "นม 120".
 */
export function parseQuickMeal(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)(?:\s*[,;]\s*(\d+(?:\.\d+)?))?/);
  if (!m) return null;
  const cal = Number(m[1]);
  const prot = m[2] != null ? Number(m[2]) : 0;
  if (!Number.isFinite(cal) || cal <= 0) return null;
  const label = s.replace(m[0], ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return {
    cal: Math.round(cal),
    prot: Number.isFinite(prot) ? round(prot, 1) : 0,
    label,
  };
}

/**
 * Quick-add exercise text → { burn, label }.
 * Accepts "150", "ไหล่ 30kg 150", "คาร์ดิโอ 200".
 */
export function parseQuickExercise(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const nums = [...s.matchAll(/(\d+(?:\.\d+)?)/g)].map((x) => Number(x[1]));
  if (!nums.length) return null;
  // Prefer the last number as burn kcal (names often have weights earlier).
  const burn = Math.round(nums[nums.length - 1]);
  if (!Number.isFinite(burn) || burn <= 0) return null;
  let label = s;
  const last = String(nums[nums.length - 1]);
  const idx = s.lastIndexOf(last);
  if (idx >= 0) label = `${s.slice(0, idx)}${s.slice(idx + last.length)}`;
  label = label.replace(/\s+/g, ' ').trim().replace(/[,\s]+$/g, '').slice(0, 80);
  return { burn, label: label || `ออกกำลัง ${burn}` };
}

/** Ensure a day exists (clone body from last), return { sheet, day }. */
export function ensureDay(calorie, dateKey = toDateKey(new Date())) {
  const { sheet, day, created } = addDayFromLast(calorie, dateKey);
  return { sheet, day, created };
}

/** Put meal into the first empty slot (1–7) for that day; append label to note. */
export function appendQuickMeal(calorie, text, dateKey = toDateKey(new Date())) {
  const parsed = parseQuickMeal(text);
  if (!parsed) {
    const err = new Error('ใส่แคลอรี่ เช่น 130,27 หรือ ข้าว 180,12');
    err.code = 'bad_meal';
    throw err;
  }
  const { sheet, day } = ensureDay(calorie, dateKey);
  const meals = [...(day.meals || [])];
  while (meals.length < MEAL_SLOTS) meals.push('');
  const slot = meals.findIndex((c) => parseMealCell(c).empty);
  if (slot < 0) {
    const err = new Error('มื้อครบ 7 ช่องแล้ว — แก้ในตารางหรือลบมื้อก่อน');
    err.code = 'meals_full';
    throw err;
  }
  meals[slot] = formatMealCell(parsed.cal, parsed.prot);
  let note = String(day.note || '');
  if (parsed.label) {
    note = note ? `${note} · ${parsed.label}` : parsed.label;
    note = note.slice(0, 200);
  }
  return {
    sheet: patchDay(sheet, day.id, { meals, note }),
    slot: slot + 1,
    parsed,
    dayId: day.id,
  };
}

/** Add exercise burn into mus; append label to note. */
export function appendQuickExercise(calorie, text, dateKey = toDateKey(new Date())) {
  const parsed = parseQuickExercise(text);
  if (!parsed) {
    const err = new Error('ใส่ออกกำลัง + แคล เช่น ไหล่ 150 หรือ คาร์ดิโอ 200');
    err.code = 'bad_exercise';
    throw err;
  }
  const { sheet, day } = ensureDay(calorie, dateKey);
  const mus = (Number.isFinite(day.mus) ? day.mus : 0) + parsed.burn;
  let note = String(day.note || '');
  const bit = parsed.label;
  note = note ? `${note} · ${bit}` : bit;
  note = note.slice(0, 200);
  return {
    sheet: patchDay(sheet, day.id, { mus, note }),
    parsed,
    dayId: day.id,
  };
}

/** YYYY-MM-DD in local timezone. */
export function toDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return toDateKey(new Date());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key) {
  const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Compact date: D/M/YY (no leading zeros). */
export function formatDateDisplay(dateKey) {
  const d = parseDateKey(dateKey);
  if (!d) return String(dateKey || '');
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
}

export function thaiDayName(dateKey) {
  const d = parseDateKey(dateKey);
  if (!d) return '';
  return THAI_DAYS_SHORT[d.getDay()] || '';
}

/** 'YYYY-MM' from a date key. */
export function monthKeyFromDate(dateKey) {
  const d = parseDateKey(dateKey);
  if (!d) return String(dateKey || '').slice(0, 7);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

export function formatMonthLabel(monthKey) {
  const m = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(monthKey || '');
  const month = Number(m[2]);
  const name = THAI_MONTHS_SHORT[month - 1] || m[2];
  return `${name} ${m[1].slice(-2)}`;
}

function emptyTotals() {
  return {
    addCal: 0,
    prot: 0,
    balance: 0,
    blKg: null,
    base: 0,
    bsum: 0,
    mus: 0,
    days: 0,
  };
}

function accumulateTotals(into, metrics) {
  into.addCal += metrics.addCal || 0;
  into.prot += metrics.prot || 0;
  into.balance += metrics.balance || 0;
  into.base += metrics.base || 0;
  into.bsum += metrics.bsum || 0;
  into.mus += metrics.mus || 0;
  into.days += 1;
}

function finalizeTotals(raw, kcalPerKg, proteinFactor) {
  const balance = raw.balance;
  return {
    addCal: round(raw.addCal, 0),
    prot: round(raw.prot, 1),
    balance: round(balance, 0),
    blKg: kcalPerKg ? round(balance / kcalPerKg, 2) : null,
    base: round(raw.base, 0),
    bsum: round(raw.bsum, 0),
    mus: round(raw.mus, 0),
    days: raw.days,
    proteinFactor,
  };
}

/** Last non-null waist / weight / base walking newest → oldest. */
export function lastKnownBody(calorie) {
  const sheet = normalizeCalorie(calorie);
  let waist = null;
  let weight = null;
  let base = null;
  for (let i = sheet.days.length - 1; i >= 0; i -= 1) {
    const d = sheet.days[i];
    if (waist == null && Number.isFinite(d.waist)) waist = d.waist;
    if (weight == null && Number.isFinite(d.weight)) weight = d.weight;
    if (base == null && Number.isFinite(d.base)) base = d.base;
    if (waist != null && weight != null && base != null) break;
  }
  return { waist, weight, base: base ?? sheet.defaultBase };
}

export function createEmptyCalorie(overrides = {}) {
  return normalizeCalorie({
    version: CALORIE_PAYLOAD_VERSION,
    updatedAt: nowIso(),
    proteinFactor: DEFAULT_PROTEIN_FACTOR,
    kcalPerKg: DEFAULT_KCAL_PER_KG,
    defaultBase: DEFAULT_BASE_KCAL,
    days: [],
    ...overrides,
  });
}

function normalizeMeals(raw) {
  const src = Array.isArray(raw) ? raw : [];
  const out = [];
  for (let i = 0; i < MEAL_SLOTS; i += 1) {
    out.push(String(src[i] ?? '').trim().slice(0, 32));
  }
  return out;
}

export function createDayRow(partial = {}) {
  const date = partial.date ? toDateKey(partial.date) : toDateKey(new Date());
  return {
    id: String(partial.id || crypto.randomUUID()),
    date,
    waist: partial.waist == null || partial.waist === '' ? null : Number(partial.waist),
    weight: partial.weight == null || partial.weight === '' ? null : Number(partial.weight),
    meals: normalizeMeals(partial.meals),
    mus: partial.mus == null || partial.mus === '' ? null : Number(partial.mus),
    base: partial.base == null || partial.base === '' ? null : Number(partial.base),
    note: String(partial.note || '').slice(0, 200),
    updatedAt: partial.updatedAt || nowIso(),
  };
}

export function normalizeDayRow(raw, fallbackBase = DEFAULT_BASE_KCAL) {
  if (!raw || typeof raw !== 'object') {
    return createDayRow({ base: fallbackBase });
  }
  const row = createDayRow(raw);
  if (!Number.isFinite(row.waist)) row.waist = null;
  if (!Number.isFinite(row.weight)) row.weight = null;
  if (!Number.isFinite(row.mus)) row.mus = null;
  if (!Number.isFinite(row.base)) row.base = null;
  return row;
}

export function normalizeCalorie(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const proteinFactor = clampNum(src.proteinFactor, 0.5, 4, DEFAULT_PROTEIN_FACTOR);
  const kcalPerKg = clampNum(src.kcalPerKg, 1000, 20000, DEFAULT_KCAL_PER_KG);
  const defaultBase = clampNum(src.defaultBase, 800, 5000, DEFAULT_BASE_KCAL);
  const days = (Array.isArray(src.days) ? src.days : [])
    .filter((d) => d && typeof d === 'object')
    .map((d) => normalizeDayRow(d, defaultBase))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-400);
  return {
    version: CALORIE_PAYLOAD_VERSION,
    updatedAt: src.updatedAt || nowIso(),
    proteinFactor: round(proteinFactor, 2),
    kcalPerKg: Math.round(kcalPerKg),
    defaultBase: Math.round(defaultBase),
    days,
  };
}

/** Per-day derived metrics (matches sheet columns). */
export function computeDayMetrics(day, { proteinFactor, kcalPerKg, defaultBase } = {}) {
  const pf = Number.isFinite(proteinFactor) ? proteinFactor : DEFAULT_PROTEIN_FACTOR;
  const kpkg = Number.isFinite(kcalPerKg) ? kcalPerKg : DEFAULT_KCAL_PER_KG;
  const baseFallback = Number.isFinite(defaultBase) ? defaultBase : DEFAULT_BASE_KCAL;

  let addCal = 0;
  let prot = 0;
  (day?.meals || []).forEach((cell) => {
    const m = parseMealCell(cell);
    addCal += m.cal;
    prot += m.prot;
  });

  const weight = Number.isFinite(day?.weight) ? day.weight : null;
  const waist = Number.isFinite(day?.waist) ? day.waist : null;
  const mus = Number.isFinite(day?.mus) ? day.mus : 0;
  const base = Number.isFinite(day?.base) ? day.base : baseFallback;
  const bsum = base + mus;
  const protTarget = weight != null ? weight * pf : null;
  const pRm = protTarget != null ? prot - protTarget : null;
  const balance = addCal - bsum;
  const blKg = kpkg ? balance / kpkg : null;
  const pctBl = bsum ? (balance / bsum) * 100 : null;

  return {
    addCal: round(addCal, 0),
    prot: round(prot, 1),
    pRm: pRm == null ? null : round(pRm, 1),
    balance: round(balance, 0),
    blKg: blKg == null ? null : round(blKg, 2),
    mus: round(mus, 0),
    base: round(base, 0),
    bsum: round(bsum, 0),
    pctBl: pctBl == null ? null : round(pctBl, 1),
    weight,
    waist,
    protTarget: protTarget == null ? null : round(protTarget, 1),
  };
}

export function computeTotals(calorie) {
  const sheet = normalizeCalorie(calorie);
  const all = emptyTotals();
  const byMonth = new Map();
  const monthIndex = new Map();
  const rows = sheet.days.map((day) => {
    const metrics = computeDayMetrics(day, sheet);
    const monthKey = monthKeyFromDate(day.date);
    const mi = (monthIndex.get(monthKey) || 0) + 1;
    monthIndex.set(monthKey, mi);
    accumulateTotals(all, metrics);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, emptyTotals());
    accumulateTotals(byMonth.get(monthKey), metrics);
    return {
      ...day,
      count: mi,
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      metrics,
      dayName: thaiDayName(day.date),
      dateDisplay: formatDateDisplay(day.date),
    };
  });
  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, totals]) => ({
      key,
      label: formatMonthLabel(key),
      totals: finalizeTotals(totals, sheet.kcalPerKg, sheet.proteinFactor),
      rows: rows.filter((r) => r.monthKey === key),
    }));
  return {
    sheet,
    rows,
    months,
    totals: finalizeTotals(all, sheet.kcalPerKg, sheet.proteinFactor),
  };
}

export function totalsForMonth(calorie, monthKey) {
  const { months, totals, sheet } = computeTotals(calorie);
  if (!monthKey) {
    const last = months[months.length - 1];
    return {
      monthKey: last?.key || monthKeyFromDate(toDateKey()),
      label: last?.label || formatMonthLabel(monthKeyFromDate(toDateKey())),
      totals: last ? last.totals : { ...emptyTotals(), proteinFactor: sheet.proteinFactor },
      months,
    };
  }
  const hit = months.find((m) => m.key === monthKey);
  return {
    monthKey,
    label: hit?.label || formatMonthLabel(monthKey),
    totals: hit
      ? hit.totals
      : { ...emptyTotals(), proteinFactor: sheet.proteinFactor },
    months,
  };
}

export function upsertDay(calorie, dayPartial) {
  const sheet = normalizeCalorie(calorie);
  const next = normalizeDayRow(
    { ...dayPartial, updatedAt: nowIso() },
    sheet.defaultBase,
  );
  const idx = sheet.days.findIndex((d) => d.id === next.id || d.date === next.date);
  const days = [...sheet.days];
  if (idx >= 0) {
    days[idx] = { ...days[idx], ...next, id: days[idx].id };
  } else {
    days.push(next);
  }
  days.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { ...sheet, days, updatedAt: nowIso() };
}

export function patchDay(calorie, dayId, patch) {
  const sheet = normalizeCalorie(calorie);
  const days = sheet.days.map((d) => {
    if (d.id !== dayId) return d;
    return normalizeDayRow({ ...d, ...patch, id: d.id, updatedAt: nowIso() }, sheet.defaultBase);
  });
  return { ...sheet, days, updatedAt: nowIso() };
}

export function deleteDay(calorie, dayId) {
  const sheet = normalizeCalorie(calorie);
  return {
    ...sheet,
    days: sheet.days.filter((d) => d.id !== dayId),
    updatedAt: nowIso(),
  };
}

/** Add today (or next empty date) cloning last known waist/weight/base. */
export function addDayFromLast(calorie, dateKey = toDateKey(new Date())) {
  const sheet = normalizeCalorie(calorie);
  const existing = sheet.days.find((d) => d.date === dateKey);
  if (existing) return { sheet, day: existing, created: false };
  const known = lastKnownBody(sheet);
  const day = createDayRow({
    date: dateKey,
    waist: known.waist,
    weight: known.weight,
    base: known.base,
    meals: [],
    mus: null,
    note: '',
  });
  const next = upsertDay(sheet, day);
  return { sheet: next, day: next.days.find((d) => d.date === dateKey), created: true };
}

export function mergeCalorieByUpdatedAt(localRaw, remoteRaw) {
  const local = normalizeCalorie(localRaw);
  const remote = normalizeCalorie(remoteRaw);
  const byId = new Map();
  const takeNewer = (a, b) => {
    const at = new Date(a?.updatedAt || 0).getTime();
    const bt = new Date(b?.updatedAt || 0).getTime();
    if (bt > at) return b;
    if (at > bt) return a;
    return b;
  };
  local.days.forEach((d) => byId.set(d.id, d));
  remote.days.forEach((d) => {
    const prev = byId.get(d.id);
    byId.set(d.id, prev ? takeNewer(prev, d) : d);
  });
  // Also merge by date when ids differ (same calendar day)
  const byDate = new Map();
  [...byId.values()].forEach((d) => {
    const prev = byDate.get(d.date);
    byDate.set(d.date, prev ? takeNewer(prev, d) : d);
  });
  const localAt = new Date(local.updatedAt || 0).getTime();
  const remoteAt = new Date(remote.updatedAt || 0).getTime();
  const metaSrc = remoteAt >= localAt ? remote : local;
  return normalizeCalorie({
    ...metaSrc,
    days: [...byDate.values()],
    updatedAt: new Date(Math.max(localAt, remoteAt, Date.now())).toISOString(),
  });
}

export function formatSigned(n, digits = 0) {
  if (n == null || !Number.isFinite(n)) return '';
  const v = round(n, digits);
  if (v > 0) return `+${v}`;
  return String(v);
}

function toneClass(n) {
  if (n == null || !Number.isFinite(n) || n === 0) return 'is-zero';
  return n > 0 ? 'is-pos' : 'is-neg';
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderCalorieTotalsHtml(totals, { monthLabel = '' } = {}) {
  const items = [
    ['cal', totals.addCal, null],
    ['prot', totals.prot, null],
    ['bal', totals.balance, toneClass(totals.balance)],
    ['kg', totals.blKg, toneClass(totals.blKg)],
    ['Σ', totals.bsum, null],
    ['วัน', totals.days, null],
  ];
  const month = monthLabel
    ? `<span class="ct-month">${esc(monthLabel)}</span>`
    : '';
  const body = items
    .map(([label, val, cls]) => {
      const v = val == null || val === '' ? '—' : val;
      return `<span class="ct-item ${cls || ''}">${esc(label)} <strong>${esc(v)}</strong></span>`;
    })
    .join('');
  return `${month}${body}`;
}

const COL_COUNT = 23;

export function renderCalorieRowsHtml(rows, todayKey = toDateKey(new Date())) {
  if (!rows.length) return '';
  let lastMonth = '';
  return rows
    .map((row) => {
      const m = row.metrics;
      const today = row.date === todayKey ? ' cal-row-today' : '';
      const meals = (row.meals || [])
        .map(
          (cell, i) =>
            `<td class="cal-col-meal"><input class="cal-cell cal-cell-meal" data-cal-field="meal" data-meal-index="${i}" data-day-id="${esc(row.id)}" value="${esc(cell)}" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="มื้อ ${i + 1}"></td>`,
        )
        .join('');
      let sep = '';
      if (row.monthKey && row.monthKey !== lastMonth) {
        lastMonth = row.monthKey;
        sep = `<tr class="cal-month-sep" data-month="${esc(row.monthKey)}" aria-label="${esc(row.monthLabel)}">
          <td colspan="${COL_COUNT}"><span>${esc(row.monthLabel)}</span></td>
        </tr>`;
      }
      return `${sep}<tr class="cal-row${today}" data-day-id="${esc(row.id)}" data-month="${esc(row.monthKey || '')}">
        <td class="cal-col-sticky cal-col-n">${row.count}</td>
        <td class="cal-col-sticky cal-col-date">
          <button type="button" class="cal-date-btn" data-cal-date-open="${esc(row.id)}" aria-label="วันที่ ${esc(row.dateDisplay)}">${esc(row.dateDisplay)}</button>
          <input class="cal-date-picker" type="date" data-cal-field="date" data-day-id="${esc(row.id)}" value="${esc(row.date)}" tabindex="-1" aria-hidden="true">
        </td>
        <td class="cal-col-day">${esc(row.dayName)}</td>
        <td class="cal-col-body"><input class="cal-cell" data-cal-field="waist" data-day-id="${esc(row.id)}" value="${row.waist ?? ''}" inputmode="decimal" aria-label="รอบเอว"></td>
        <td class="cal-col-body"><input class="cal-cell" data-cal-field="weight" data-day-id="${esc(row.id)}" value="${row.weight ?? ''}" inputmode="decimal" aria-label="น้ำหนัก"></td>
        <td class="cal-col-sum cal-col-add cal-derived">${m.addCal ?? ''}</td>
        <td class="cal-col-sum cal-derived">${m.prot ?? ''}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.pRm)}">${m.pRm == null ? '' : formatSigned(m.pRm, 1)}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.balance)}">${m.balance == null ? '' : formatSigned(m.balance, 0)}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.blKg)}">${m.blKg == null ? '' : formatSigned(m.blKg, 2)}</td>
        ${meals}
        <td class="cal-col-burn"><input class="cal-cell" data-cal-field="mus" data-day-id="${esc(row.id)}" value="${row.mus ?? ''}" inputmode="numeric" aria-label="ออกกำลัง"></td>
        <td class="cal-col-burn"><input class="cal-cell" data-cal-field="base" data-day-id="${esc(row.id)}" value="${row.base ?? ''}" inputmode="numeric" aria-label="base"></td>
        <td class="cal-col-sum cal-derived">${m.bsum ?? ''}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.pctBl)}">${m.pctBl == null ? '' : `${m.pctBl}%`}</td>
        <td class="cal-col-note"><input class="cal-cell cal-cell-note" data-cal-field="note" data-day-id="${esc(row.id)}" value="${esc(row.note)}" autocomplete="off" aria-label="หลัก"></td>
        <td class="cal-col-del"><button type="button" class="cal-del-btn" data-cal-delete="${esc(row.id)}" aria-label="ลบวัน">×</button></td>
      </tr>`;
    })
    .join('');
}

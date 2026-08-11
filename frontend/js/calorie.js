/**
 * Calorie spreadsheet (Phase 1) — day rows matching the personal sheet layout.
 * Meals are "kcal,protein" cells; derived columns are computed, not stored.
 */

export const CALORIE_PAYLOAD_VERSION = 1;
export const DEFAULT_PROTEIN_FACTOR = 1.5;
export const DEFAULT_KCAL_PER_KG = 7700;
export const DEFAULT_BASE_KCAL = 1784;
export const MEAL_SLOTS = 7;

const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

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

export function formatDateDisplay(dateKey) {
  const d = parseDateKey(dateKey);
  if (!d) return String(dateKey || '');
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
}

export function thaiDayName(dateKey) {
  const d = parseDateKey(dateKey);
  if (!d) return '';
  return THAI_DAYS[d.getDay()] || '';
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
  let addCal = 0;
  let prot = 0;
  let balance = 0;
  let base = 0;
  let bsum = 0;
  let mus = 0;
  const rows = sheet.days.map((day, index) => {
    const metrics = computeDayMetrics(day, sheet);
    addCal += metrics.addCal || 0;
    prot += metrics.prot || 0;
    balance += metrics.balance || 0;
    base += metrics.base || 0;
    bsum += metrics.bsum || 0;
    mus += metrics.mus || 0;
    return {
      ...day,
      count: index + 1,
      metrics,
      dayName: thaiDayName(day.date),
      dateDisplay: formatDateDisplay(day.date),
    };
  });
  return {
    sheet,
    rows,
    totals: {
      addCal: round(addCal, 0),
      prot: round(prot, 1),
      balance: round(balance, 0),
      blKg: sheet.kcalPerKg ? round(balance / sheet.kcalPerKg, 2) : null,
      base: round(base, 0),
      bsum: round(bsum, 0),
      mus: round(mus, 0),
      proteinFactor: sheet.proteinFactor,
      days: rows.length,
    },
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

/** Add today (or next empty date) cloning last weight/waist/base. */
export function addDayFromLast(calorie, dateKey = toDateKey(new Date())) {
  const sheet = normalizeCalorie(calorie);
  const existing = sheet.days.find((d) => d.date === dateKey);
  if (existing) return { sheet, day: existing, created: false };
  const last = sheet.days[sheet.days.length - 1];
  const day = createDayRow({
    date: dateKey,
    waist: last?.waist ?? null,
    weight: last?.weight ?? null,
    base: last?.base ?? sheet.defaultBase,
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

export function renderCalorieTotalsHtml(totals) {
  const items = [
    ['Add cal', totals.addCal, null],
    ['prot', totals.prot, null],
    ['balance', totals.balance, toneClass(totals.balance)],
    ['bl-kg', totals.blKg, toneClass(totals.blKg)],
    ['base', totals.base, null],
    ['bsum', totals.bsum, null],
    ['วัน', totals.days, null],
  ];
  return items
    .map(([label, val, cls]) => {
      const v = val == null || val === '' ? '—' : val;
      return `<span class="ct-item ${cls || ''}">${esc(label)} <strong>${esc(v)}</strong></span>`;
    })
    .join('');
}

export function renderCalorieRowsHtml(rows, todayKey = toDateKey(new Date())) {
  if (!rows.length) return '';
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
      return `<tr class="cal-row${today}" data-day-id="${esc(row.id)}">
        <td class="cal-col-sticky cal-col-n">${row.count}</td>
        <td class="cal-col-sticky cal-col-date"><input class="cal-cell cal-cell-date" type="date" data-cal-field="date" data-day-id="${esc(row.id)}" value="${esc(row.date)}" aria-label="วันที่"></td>
        <td class="cal-col-day">${esc(row.dayName)}</td>
        <td class="cal-col-num"><input class="cal-cell" data-cal-field="waist" data-day-id="${esc(row.id)}" value="${row.waist ?? ''}" inputmode="decimal" aria-label="รอบเอว"></td>
        <td class="cal-col-num"><input class="cal-cell" data-cal-field="weight" data-day-id="${esc(row.id)}" value="${row.weight ?? ''}" inputmode="decimal" aria-label="น้ำหนัก"></td>
        <td class="cal-col-sum cal-col-add cal-derived">${m.addCal ?? ''}</td>
        <td class="cal-col-sum cal-derived">${m.prot ?? ''}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.pRm)}">${m.pRm == null ? '' : formatSigned(m.pRm, 1)}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.balance)}">${m.balance == null ? '' : formatSigned(m.balance, 0)}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.blKg)}">${m.blKg == null ? '' : formatSigned(m.blKg, 2)}</td>
        ${meals}
        <td class="cal-col-num"><input class="cal-cell" data-cal-field="mus" data-day-id="${esc(row.id)}" value="${row.mus ?? ''}" inputmode="numeric" aria-label="ออกกำลัง"></td>
        <td class="cal-col-num"><input class="cal-cell" data-cal-field="base" data-day-id="${esc(row.id)}" value="${row.base ?? ''}" inputmode="numeric" aria-label="base"></td>
        <td class="cal-col-sum cal-derived">${m.bsum ?? ''}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.pctBl)}">${m.pctBl == null ? '' : `${m.pctBl}%`}</td>
        <td class="cal-col-note"><input class="cal-cell cal-cell-note" data-cal-field="note" data-day-id="${esc(row.id)}" value="${esc(row.note)}" autocomplete="off" aria-label="หลัก"></td>
        <td class="cal-col-del"><button type="button" class="cal-del-btn" data-cal-delete="${esc(row.id)}" aria-label="ลบวัน">×</button></td>
      </tr>`;
    })
    .join('');
}

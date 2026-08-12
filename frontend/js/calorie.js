/**
 * Calorie spreadsheet (Phase 1) — day rows matching the personal sheet layout.
 * Meals are "kcal,protein" cells; derived columns are computed, not stored.
 */

export const CALORIE_PAYLOAD_VERSION = 1;
export const DEFAULT_PROTEIN_FACTOR = 1.5;
export const DEFAULT_KCAL_PER_KG = 7700;
/** Fallback base when profile (สูง/วันเกิด) or weight is incomplete. */
export const DEFAULT_BASE_KCAL = 1784;
export const DEFAULT_HEIGHT_CM = 170;
export const DEFAULT_AGE = 30;
export const DEFAULT_SEX = 'male';
/** Default birthday ≈ age 30 on Jan 1 (only used when migrating old `age`). */
export const DEFAULT_BIRTH_DATE = `${new Date().getFullYear() - DEFAULT_AGE}-01-01`;
/** Visible meal columns start at 7; grow when full up to max. */
export const MIN_MEAL_SLOTS = 7;
export const MAX_MEAL_SLOTS = 14;
/** @deprecated use MIN_MEAL_SLOTS — kept for older imports */
export const MEAL_SLOTS = MIN_MEAL_SLOTS;
/** Compact frequent-use lists (meal / exercise). */
export const FREQ_TOP = 5;

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

/** Put meal into the first empty slot; grow slots up to MAX_MEAL_SLOTS. */
export function appendQuickMeal(calorie, text, dateKey = toDateKey(new Date())) {
  const parsed = parseQuickMeal(text);
  if (!parsed) {
    const err = new Error('ใส่แคลอรี่ เช่น 130,27 หรือ ข้าว 180,12');
    err.code = 'bad_meal';
    throw err;
  }
  const { sheet, day } = ensureDay(calorie, dateKey);
  const meals = expandMealsForEdit(day.meals);
  let slot = meals.findIndex((c) => parseMealCell(c).empty);
  if (slot < 0) {
    if (meals.length >= MAX_MEAL_SLOTS) {
      const err = new Error(`มื้อครบ ${MAX_MEAL_SLOTS} ช่องแล้ว`);
      err.code = 'meals_full';
      throw err;
    }
    meals.push('');
    slot = meals.length - 1;
  }
  meals[slot] = formatMealCell(parsed.cal, parsed.prot);
  let note = String(day.note || '');
  if (parsed.label) {
    note = note ? `${note} · ${parsed.label}` : parsed.label;
    note = note.slice(0, 200);
  }
  const textKey = String(text || '').trim().slice(0, 48);
  let next = patchDay(sheet, day.id, { meals: normalizeMeals(meals), note });
  next = recordFrequent(next, 'meal', textKey, parsed);
  return {
    sheet: next,
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
  const textKey = String(text || '').trim().slice(0, 48);
  let next = patchDay(sheet, day.id, { mus, note });
  next = recordFrequent(next, 'mus', textKey, parsed);
  return {
    sheet: next,
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

/** Age in full years on a given date (Date or YYYY-MM-DD). */
export function ageFromBirthDate(birthDate, onDate = new Date()) {
  const b = typeof birthDate === 'string' ? parseDateKey(birthDate) : birthDate;
  if (!b) return null;
  let on = onDate instanceof Date ? onDate : parseDateKey(onDate);
  if (!on) on = new Date();
  let age = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

/** Prefer birthDate; migrate legacy `age` → approx Jan 1. */
export function resolveBirthDate(src = {}) {
  if (src.birthDate && parseDateKey(src.birthDate)) {
    return toDateKey(parseDateKey(src.birthDate));
  }
  const age = clampNum(src.age, 10, 100, DEFAULT_AGE);
  const y = new Date().getFullYear() - Math.round(age);
  return `${y}-01-01`;
}

function normalizeFreqList(raw) {
  const src = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();
  for (const item of src) {
    if (!item || typeof item !== 'object') continue;
    const text = String(item.text || '').trim().slice(0, 48);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const label = String(item.label || text).trim().slice(0, 28);
    const count = Math.max(1, Math.round(Number(item.count) || 1));
    const lastAt = String(item.lastAt || nowIso()).slice(0, 40);
    out.push({ text, label, count, lastAt });
    if (out.length >= FREQ_TOP) break;
  }
  return out;
}

/** Record a successful quick-add; keep only top FREQ_TOP by count then recency. */
export function recordFrequent(calorie, kind, text, parsed) {
  const sheet = normalizeCalorie(calorie);
  const key = kind === 'mus' ? 'freqMus' : 'freqMeals';
  const t = String(text || '').trim().slice(0, 48);
  if (!t) return sheet;
  let label = '';
  if (kind === 'mus') {
    label = parsed?.label
      ? `${String(parsed.label).slice(0, 16)} ${parsed.burn}`
      : String(parsed?.burn ?? t);
  } else {
    const cal = parsed?.cal ?? '';
    const prot = parsed?.prot ? `,${parsed.prot}` : '';
    label = parsed?.label
      ? `${String(parsed.label).slice(0, 14)} ${cal}${prot}`
      : `${cal}${prot}`;
  }
  label = String(label).trim().slice(0, 28);
  const list = [...(sheet[key] || [])];
  const idx = list.findIndex((x) => x.text === t);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      label: label || list[idx].label,
      count: (list[idx].count || 0) + 1,
      lastAt: nowIso(),
    };
  } else {
    list.push({ text: t, label: label || t, count: 1, lastAt: nowIso() });
  }
  list.sort((a, b) => {
    if ((b.count || 0) !== (a.count || 0)) return (b.count || 0) - (a.count || 0);
    return String(b.lastAt || '').localeCompare(String(a.lastAt || ''));
  });
  return {
    ...sheet,
    [key]: list.slice(0, FREQ_TOP),
    updatedAt: nowIso(),
  };
}

export function topFrequent(calorie, kind) {
  const sheet = normalizeCalorie(calorie);
  return kind === 'mus' ? sheet.freqMus : sheet.freqMeals;
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

/**
 * Mifflin–St Jeor BMR (kcal/day).
 * male: 10w + 6.25h - 5a + 5 · female: 10w + 6.25h - 5a - 161
 */
export function computeBmr({ weightKg, heightCm, ageYears, sex } = {}) {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!Number.isFinite(heightCm) || heightCm < 100) return null;
  if (!Number.isFinite(ageYears) || ageYears < 10) return null;
  const offset = sex === 'female' ? -161 : 5;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageYears + offset);
}

export function computeBmi(weightKg, heightCm) {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!Number.isFinite(heightCm) || heightCm < 100) return null;
  const m = heightCm / 100;
  return round(weightKg / (m * m), 1);
}

/** Weight for a day: own value, else nearest older day, else any known. */
export function resolveDayWeight(day, sheet) {
  if (Number.isFinite(day?.weight) && day.weight > 0) return day.weight;
  const days = Array.isArray(sheet?.days) ? sheet.days : [];
  const older = days
    .filter((d) => d.date < day?.date && Number.isFinite(d.weight) && d.weight > 0)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (older[0]) return older[0].weight;
  const any = days.find((d) => Number.isFinite(d.weight) && d.weight > 0);
  return any?.weight ?? null;
}

/** Auto base (BMR) for a day from that day's weight + body profile. */
export function resolveDayBase(day, sheet) {
  const weight = resolveDayWeight(day, sheet);
  const ageYears =
    ageFromBirthDate(sheet?.birthDate, day?.date || toDateKey())
    ?? (Number.isFinite(sheet?.age) ? sheet.age : null);
  const bmr = computeBmr({
    weightKg: weight,
    heightCm: sheet?.heightCm,
    ageYears,
    sex: sheet?.sex,
  });
  if (bmr != null) return bmr;
  const fb = Number.isFinite(sheet?.defaultBase) ? sheet.defaultBase : DEFAULT_BASE_KCAL;
  return Math.round(fb);
}

/** Last non-null waist / weight walking newest → oldest. Base is always derived. */
export function lastKnownBody(calorie) {
  const sheet = normalizeCalorie(calorie);
  let waist = null;
  let weight = null;
  for (const d of sheet.days) {
    if (waist == null && Number.isFinite(d.waist)) waist = d.waist;
    if (weight == null && Number.isFinite(d.weight)) weight = d.weight;
    if (waist != null && weight != null) break;
  }
  const base = resolveDayBase({ weight, waist, date: toDateKey() }, sheet);
  return { waist, weight, base };
}

export function createEmptyCalorie(overrides = {}) {
  return normalizeCalorie({
    version: CALORIE_PAYLOAD_VERSION,
    updatedAt: nowIso(),
    proteinFactor: DEFAULT_PROTEIN_FACTOR,
    kcalPerKg: DEFAULT_KCAL_PER_KG,
    defaultBase: DEFAULT_BASE_KCAL,
    heightCm: DEFAULT_HEIGHT_CM,
    birthDate: DEFAULT_BIRTH_DATE,
    sex: DEFAULT_SEX,
    days: [],
    freqMeals: [],
    freqMus: [],
    ...overrides,
  });
}

/** Compact store: keep used meals + pad to MIN; drop trailing empties beyond MIN. */
export function normalizeMeals(raw) {
  const src = Array.isArray(raw) ? raw : [];
  const cells = src
    .slice(0, MAX_MEAL_SLOTS)
    .map((s) => String(s ?? '').trim().slice(0, 32));
  let lastUsed = -1;
  cells.forEach((c, i) => {
    if (!parseMealCell(c).empty) lastUsed = i;
  });
  const need = Math.min(MAX_MEAL_SLOTS, Math.max(MIN_MEAL_SLOTS, lastUsed + 2));
  const out = [];
  for (let i = 0; i < need; i += 1) out.push(cells[i] || '');
  return out;
}

/** Ensure editable length with one empty slot when possible. */
export function expandMealsForEdit(raw) {
  const meals = normalizeMeals(raw);
  const full = meals.every((c) => !parseMealCell(c).empty);
  if (full && meals.length < MAX_MEAL_SLOTS) meals.push('');
  return meals;
}

/** Shared column count for table header across all days. */
export function mealColumnCount(calorie) {
  const sheet = normalizeCalorie(calorie);
  let maxUsed = 0;
  for (const d of sheet.days) {
    (d.meals || []).forEach((c, i) => {
      if (!parseMealCell(c).empty) maxUsed = Math.max(maxUsed, i + 1);
    });
  }
  return Math.min(MAX_MEAL_SLOTS, Math.max(MIN_MEAL_SLOTS, maxUsed + 1));
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
  const heightCm = clampNum(src.heightCm, 100, 250, DEFAULT_HEIGHT_CM);
  const birthDate = resolveBirthDate(src);
  const age =
    ageFromBirthDate(birthDate, new Date())
    ?? clampNum(src.age, 10, 100, DEFAULT_AGE);
  const sex = src.sex === 'female' ? 'female' : 'male';
  const days = (Array.isArray(src.days) ? src.days : [])
    .filter((d) => d && typeof d === 'object')
    .map((d) => normalizeDayRow(d, defaultBase))
    // Newest first — easier to log today at the top.
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 400);
  return {
    version: CALORIE_PAYLOAD_VERSION,
    updatedAt: src.updatedAt || nowIso(),
    proteinFactor: round(proteinFactor, 2),
    kcalPerKg: Math.round(kcalPerKg),
    defaultBase: Math.round(defaultBase),
    heightCm: Math.round(heightCm),
    birthDate,
    age: Math.round(age),
    sex,
    freqMeals: normalizeFreqList(src.freqMeals),
    freqMus: normalizeFreqList(src.freqMus),
    days,
  };
}

/** Per-day derived metrics (matches sheet columns). Base = auto BMR. */
export function computeDayMetrics(day, sheet = {}) {
  const pf = Number.isFinite(sheet.proteinFactor) ? sheet.proteinFactor : DEFAULT_PROTEIN_FACTOR;
  const kpkg = Number.isFinite(sheet.kcalPerKg) ? sheet.kcalPerKg : DEFAULT_KCAL_PER_KG;

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
  const base = resolveDayBase(day, sheet);
  const bsum = base + mus;
  const weightForProt = resolveDayWeight(day, sheet);
  const protTarget = weightForProt != null ? weightForProt * pf : null;
  const pRm = protTarget != null ? prot - protTarget : null;
  const balance = addCal - bsum;
  const blKg = kpkg ? balance / kpkg : null;
  const pctBl = bsum ? (balance / bsum) * 100 : null;
  const bmi = computeBmi(weightForProt, sheet.heightCm);

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
    bmi,
    protTarget: protTarget == null ? null : round(protTarget, 1),
  };
}

/**
 * Rolling 7-day summary ending on endKey (inclusive).
 * Simple numbers + spark series for a lightweight dashboard.
 */
export function computeWeekSummary(calorie, endKey = toDateKey()) {
  const sheet = normalizeCalorie(calorie);
  const end = parseDateKey(endKey) || new Date();
  const keys = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    keys.push(toDateKey(d));
  }
  const byDate = new Map(sheet.days.map((d) => [d.date, d]));
  const series = keys.map((date) => {
    const day = byDate.get(date) || null;
    const metrics = day ? computeDayMetrics(day, sheet) : null;
    return { date, day, metrics, dayName: thaiDayName(date) };
  });
  const logged = series.filter((x) => x.day);
  let addCalSum = 0;
  let balSum = 0;
  let musSum = 0;
  let protSum = 0;
  let protTargetSum = 0;
  let protTargetDays = 0;
  const weights = [];
  const balBars = [];
  logged.forEach((x) => {
    const m = x.metrics;
    addCalSum += m.addCal || 0;
    balSum += m.balance || 0;
    musSum += m.mus || 0;
    protSum += m.prot || 0;
    if (m.protTarget != null) {
      protTargetSum += m.protTarget;
      protTargetDays += 1;
    }
    if (Number.isFinite(x.day.weight)) weights.push(x.day.weight);
    balBars.push({
      date: x.date,
      dayName: x.dayName,
      bal: m.balance || 0,
    });
  });
  // Fill bal bars for all 7 calendar days (0 if no log) for a stable strip.
  const balSpark = series.map((x) => ({
    date: x.date,
    dayName: x.dayName,
    bal: x.metrics ? x.metrics.balance || 0 : null,
    hasDay: Boolean(x.day),
  }));
  const weightSpark = series.map((x) =>
    x.day && Number.isFinite(x.day.weight) ? x.day.weight : null,
  );
  const n = logged.length;
  const weightDelta =
    weights.length >= 2 ? round(weights[weights.length - 1] - weights[0], 1) : null;
  const startLabel = formatDateDisplay(keys[0]);
  const endLabel = formatDateDisplay(keys[6]);
  const protRemain =
    protTargetDays > 0 ? round(protTargetSum - protSum, 1) : null;
  // Today's protein (end of window) for a clear “ยังขาดอีก…” cue.
  const todayEntry = series[series.length - 1];
  const todayProt = todayEntry?.metrics?.prot ?? null;
  const todayProtTarget = todayEntry?.metrics?.protTarget ?? null;
  const todayProtRemain =
    todayProtTarget != null && todayProt != null
      ? round(todayProtTarget - todayProt, 1)
      : null;
  return {
    startKey: keys[0],
    endKey: keys[6],
    label: `${startLabel}–${endLabel}`,
    daysLogged: n,
    avgCal: n ? Math.round(addCalSum / n) : null,
    balSum: n ? round(balSum, 0) : null,
    musSum: n ? round(musSum, 0) : null,
    protSum: n ? round(protSum, 1) : null,
    protTargetSum: protTargetDays ? round(protTargetSum, 1) : null,
    protRemain,
    todayProt,
    todayProtTarget,
    todayProtRemain,
    weightDelta,
    weightLast: weights.length ? weights[weights.length - 1] : null,
    weightSpark,
    balSpark,
    balBars,
  };
}

/** Tiny SVG sparkline for weight (nulls skipped / gaps). */
export function renderWeightSparkSvg(values, { width = 120, height = 28 } = {}) {
  const pts = [];
  values.forEach((v, i) => {
    if (v != null && Number.isFinite(v)) pts.push({ i, v });
  });
  if (pts.length < 2) {
    return `<svg class="cd-spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"></svg>`;
  }
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const n = values.length;
  const pad = 2;
  const coords = pts.map((p) => {
    const x = pad + (p.i / Math.max(1, n - 1)) * (width - pad * 2);
    const y = height - pad - ((p.v - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `<svg class="cd-spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">
    <polyline fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" points="${coords.join(' ')}"/>
  </svg>`;
}

/** Compact HTML for the week dashboard strip. */
export function renderWeekDashHtml(summary) {
  if (!summary) return '';
  const avg = summary.avgCal == null ? '—' : summary.avgCal;
  const bal =
    summary.balSum == null ? '—' : formatSigned(summary.balSum, 0);
  const mus = summary.musSum == null ? '—' : summary.musSum;
  const balTone =
    summary.balSum == null || summary.balSum === 0
      ? ''
      : summary.balSum > 0
        ? 'is-pos'
        : 'is-neg';
  const wDelta =
    summary.weightDelta == null
      ? '—'
      : `${summary.weightDelta > 0 ? '+' : ''}${summary.weightDelta}`;
  const wTone =
    summary.weightDelta == null || summary.weightDelta === 0
      ? ''
      : summary.weightDelta > 0
        ? 'is-pos'
        : 'is-neg';
  const spark = renderWeightSparkSvg(summary.weightSpark || []);
  const maxAbs = Math.max(
    1,
    ...(summary.balSpark || []).map((b) => (b.bal == null ? 0 : Math.abs(b.bal))),
  );
  const bars = (summary.balSpark || [])
    .map((b) => {
      if (!b.hasDay || b.bal == null) {
        return `<span class="cd-bar is-empty" title="${esc(b.dayName)}"><i style="height:2px"></i><em>${esc(b.dayName)}</em></span>`;
      }
      const h = Math.max(4, Math.round((Math.abs(b.bal) / maxAbs) * 22));
      const cls = b.bal > 0 ? 'is-pos' : b.bal < 0 ? 'is-neg' : 'is-zero';
      return `<span class="cd-bar ${cls}" title="${esc(b.dayName)} ${formatSigned(b.bal, 0)}"><i style="height:${h}px"></i><em>${esc(b.dayName)}</em></span>`;
    })
    .join('');

  const todayP = summary.todayProt == null ? '—' : summary.todayProt;
  const todayGoal = summary.todayProtTarget == null ? '—' : summary.todayProtTarget;
  const todayNeed =
    summary.todayProtRemain == null
      ? '—'
      : summary.todayProtRemain > 0
        ? `ขาด ${summary.todayProtRemain}`
        : summary.todayProtRemain < 0
          ? `เกิน ${Math.abs(summary.todayProtRemain)}`
          : 'ครบเป้า';
  const todayPTone =
    summary.todayProtRemain == null
      ? ''
      : summary.todayProtRemain > 0
        ? 'is-neg'
        : summary.todayProtRemain < 0
          ? 'is-pos'
          : '';
  const weekP = summary.protSum == null ? '—' : summary.protSum;
  const weekGoal = summary.protTargetSum == null ? '—' : summary.protTargetSum;
  const weekNeed =
    summary.protRemain == null
      ? '—'
      : summary.protRemain > 0
        ? `ขาด ${summary.protRemain}`
        : summary.protRemain < 0
          ? `เกิน ${Math.abs(summary.protRemain)}`
          : 'ครบ';
  const weekPTone =
    summary.protRemain == null
      ? ''
      : summary.protRemain > 0
        ? 'is-neg'
        : summary.protRemain < 0
          ? 'is-pos'
          : '';

  return `
    <div class="cd-head">
      <span class="cd-title">7 วันล่าสุด</span>
      <span class="cd-sub">${esc(summary.label)} · ${summary.daysLogged} วัน</span>
    </div>
    <div class="cd-metrics">
      <span class="cd-metric">cal เฉลี่ย <strong>${esc(avg)}</strong></span>
      <span class="cd-metric ${balTone}">bal รวม <strong>${esc(bal)}</strong></span>
      <span class="cd-metric">mus <strong>${esc(mus)}</strong></span>
      <span class="cd-metric ${wTone}">กก <strong>${esc(wDelta)}</strong></span>
    </div>
    <div class="cd-prot">
      <div class="cd-prot-block">
        <span class="cd-prot-label">โปรตีนวันนี้</span>
        <span class="cd-prot-line">กิน <strong>${esc(todayP)}</strong> / เป้า <strong>${esc(todayGoal)}</strong> ก.</span>
        <span class="cd-prot-need ${todayPTone}">${esc(todayNeed)}</span>
      </div>
      <div class="cd-prot-block">
        <span class="cd-prot-label">โปรตีน 7 วัน</span>
        <span class="cd-prot-line">กิน <strong>${esc(weekP)}</strong> / เป้า <strong>${esc(weekGoal)}</strong> ก.</span>
        <span class="cd-prot-need ${weekPTone}">${esc(weekNeed)}</span>
      </div>
    </div>
    <div class="cd-spark-row">
      <span class="cd-spark-label">กก</span>
      ${spark}
      <span class="cd-spark-delta ${wTone}">${esc(wDelta)}</span>
    </div>
    <div class="cd-spark-row cd-spark-row-bars">
      <span class="cd-spark-label">bal</span>
      <div class="cd-bars">${bars}</div>
    </div>`;
}

/** Waist risk (Asian cutoffs): male ≥90, female ≥80 cm. */
export function waistRiskZone(waistCm, sex) {
  if (!Number.isFinite(waistCm) || waistCm <= 0) return null;
  const limit = sex === 'female' ? 80 : 90;
  if (waistCm < limit - 5) return { level: 'ok', label: 'ปกติ', limit };
  if (waistCm < limit) return { level: 'watch', label: 'ใกล้เกณฑ์', limit };
  return { level: 'high', label: 'เสี่ยง', limit };
}

/** Ideal weight range from height at BMI 18.5–24.9 */
export function idealWeightRange(heightCm) {
  if (!Number.isFinite(heightCm) || heightCm < 100) return null;
  const m = heightCm / 100;
  return {
    low: round(18.5 * m * m, 1),
    high: round(24.9 * m * m, 1),
  };
}

/** Rolling calendar window of day metrics for summary charts. */
export function computeTrendSeries(calorie, dayCount = 14, endKey = toDateKey()) {
  const n = Math.max(1, Math.min(366, Math.round(dayCount) || 14));
  const sheet = normalizeCalorie(calorie);
  const end = parseDateKey(endKey) || new Date();
  const keys = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    keys.push(toDateKey(d));
  }
  const byDate = new Map(sheet.days.map((d) => [d.date, d]));
  const dates = [];
  const labels = [];
  const waist = [];
  const weight = [];
  const cal = [];
  const prot = [];
  const balance = [];
  const blKg = [];
  const mus = [];
  let logged = 0;
  keys.forEach((date) => {
    const day = byDate.get(date) || null;
    const m = day ? computeDayMetrics(day, sheet) : null;
    dates.push(date);
    labels.push(thaiDayName(date));
    if (day) logged += 1;
    waist.push(day && Number.isFinite(day.waist) ? day.waist : null);
    weight.push(day && Number.isFinite(day.weight) ? day.weight : null);
    cal.push(m ? m.addCal : null);
    prot.push(m ? m.prot : null);
    balance.push(m ? m.balance : null);
    blKg.push(m ? m.blKg : null);
    mus.push(m && (m.mus || 0) > 0 ? m.mus : day ? 0 : null);
  });
  return {
    dayCount: n,
    dates,
    labels,
    waist,
    weight,
    cal,
    prot,
    balance,
    blKg,
    mus,
    logged,
    startLabel: formatDateDisplay(keys[0]),
    endLabel: formatDateDisplay(keys[keys.length - 1]),
  };
}

/** Skip meal-cell-like note fragments when mining exercise poses. */
function looksLikeMealFragment(s) {
  const t = String(s || '').trim();
  if (!t) return true;
  if (/^\d+(\.\d+)?\s*,\s*\d+(\.\d+)?$/.test(t)) return true;
  if (/^\d+(\.\d+)?$/.test(t) && Number(t) > 50) return true;
  return false;
}

/**
 * Exercise group stats from live day rows only (no freqMus chip fallback —
 * cleared mus/notes must disappear from สรุป).
 */
export function computeExerciseStats(calorie, dayCount = 14, endKey = toDateKey()) {
  const sheet = normalizeCalorie(calorie);
  const trend = computeTrendSeries(sheet, dayCount, endKey);
  const poseMap = new Map();
  const bump = (label, burn = 0) => {
    const key = String(label || '').trim().slice(0, 40);
    if (!key || looksLikeMealFragment(key)) return;
    const prev = poseMap.get(key) || { label: key, count: 0, burn: 0 };
    prev.count += 1;
    if (Number.isFinite(burn) && burn > 0) prev.burn += burn;
    poseMap.set(key, prev);
  };
  const end = parseDateKey(endKey) || new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (trend.dayCount - 1));
  const startKey = toDateKey(start);
  sheet.days.forEach((day) => {
    if (!day?.date || day.date < startKey || day.date > endKey) return;
    if (!Number.isFinite(day.mus) || day.mus <= 0) return;
    const bits = String(day.note || '')
      .split(/\s*·\s*/)
      .map((x) => x.trim())
      .filter((bit) => bit && !looksLikeMealFragment(bit));
    if (!bits.length) {
      bump('ออกกำลัง', day.mus);
      return;
    }
    const share = day.mus / bits.length;
    bits.forEach((bit) => {
      const parsed = parseQuickExercise(bit);
      bump(parsed?.label || bit, parsed?.burn || share);
    });
  });
  const poses = [...poseMap.values()]
    .sort((a, b) => b.count - a.count || b.burn - a.burn)
    .slice(0, 8)
    .map((p) => ({
      label: p.label,
      count: p.count,
      burn: round(p.burn, 0),
    }));
  const musSum = trend.mus.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  return {
    poses,
    mus: trend.mus,
    labels: trend.labels,
    musSum: round(musSum, 0),
    dayCount: trend.dayCount,
    startLabel: trend.startLabel,
    endLabel: trend.endLabel,
  };
}

/** Drop freqMus chips when no day still has burn logged. */
export function pruneFrequentMus(calorie) {
  const sheet = normalizeCalorie(calorie);
  const hasMus = sheet.days.some((d) => Number.isFinite(d.mus) && d.mus > 0);
  if (hasMus) return sheet;
  if (!(sheet.freqMus || []).length) return sheet;
  return { ...sheet, freqMus: [], updatedAt: nowIso() };
}

/** Preset ranges for health trend charts (days back, inclusive). */
export const HEALTH_TREND_RANGES = [
  { days: 1, label: '1 วัน' },
  { days: 3, label: '3 วัน' },
  { days: 7, label: '7 วัน' },
  { days: 14, label: '14 วัน' },
  { days: 90, label: '3 เดือน' },
  { days: 180, label: '6 เดือน' },
  { days: 365, label: '1 ปี' },
];

export function normalizeTrendDays(raw, fallback = 7) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const allowed = new Set(HEALTH_TREND_RANGES.map((r) => r.days));
  if (allowed.has(n)) return n;
  return fallback;
}

/** Line / area SVG for a numeric series (nulls = gaps). */
export function renderSeriesChartSvg(
  values,
  {
    width = 300,
    height = 64,
    signed = false,
    className = 'chs-chart-svg',
  } = {},
) {
  const pts = [];
  values.forEach((v, i) => {
    if (v != null && Number.isFinite(v)) pts.push({ i, v });
  });
  const w = width;
  const h = height;
  if (pts.length < 1) {
    return `<svg class="${esc(className)}" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" aria-hidden="true"></svg>`;
  }
  let min = Math.min(...pts.map((p) => p.v));
  let max = Math.max(...pts.map((p) => p.v));
  if (signed) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min || 1;
  const n = Math.max(values.length, 2);
  const padX = 4;
  const padY = 6;
  const xAt = (i) => padX + (i / (n - 1)) * (w - padX * 2);
  const yAt = (v) => h - padY - ((v - min) / span) * (h - padY * 2);
  const coords = pts.map((p) => `${xAt(p.i).toFixed(1)},${yAt(p.v).toFixed(1)}`);
  const last = pts[pts.length - 1];
  let zeroLine = '';
  if (signed && min < 0 && max > 0) {
    const y0 = yAt(0);
    zeroLine = `<line class="chs-chart-zero" x1="${padX}" x2="${w - padX}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}" />`;
  }
  let area = '';
  if (pts.length >= 2) {
    const baseY = signed && min < 0 && max > 0 ? yAt(0) : h - padY;
    area = `<polygon class="chs-chart-area" points="${xAt(pts[0].i).toFixed(1)},${baseY.toFixed(1)} ${coords.join(' ')} ${xAt(last.i).toFixed(1)},${baseY.toFixed(1)}" />`;
  }
  const line =
    pts.length >= 2
      ? `<polyline class="chs-chart-line" fill="none" points="${coords.join(' ')}" />`
      : '';
  const dot = `<circle class="chs-chart-dot" cx="${xAt(last.i).toFixed(1)}" cy="${yAt(last.v).toFixed(1)}" r="2.4" />`;
  return `<svg class="${esc(className)}${signed ? ' is-signed' : ''}" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" aria-hidden="true">${area}${zeroLine}${line}${dot}</svg>`;
}

/** Horizontal bar list for exercise poses. */
export function renderPoseBarsHtml(poses) {
  if (!poses?.length) {
    return `<p class="chs-chart-empty">ยังไม่มีประวัติท่าออกกำลัง — เพิ่มจากปุ่ม ออกกำลัง</p>`;
  }
  const max = Math.max(1, ...poses.map((p) => p.count || 0));
  const rows = poses
    .map((p) => {
      const pct = Math.max(6, Math.round(((p.count || 0) / max) * 100));
      const burn = p.burn ? ` · ${p.burn} kcal` : '';
      return `<div class="chs-pose-row" title="${esc(p.label)} ×${p.count}${burn}">
        <span class="chs-pose-label">${esc(p.label)}</span>
        <span class="chs-pose-track"><i style="width:${pct}%"></i></span>
        <span class="chs-pose-count">${esc(p.count)}</span>
      </div>`;
    })
    .join('');
  return `<div class="chs-pose-bars">${rows}</div>`;
}

function chartCardHtml(title, values, { signed = false, unit = '', digits = 0 } = {}) {
  const pts = values.filter((v) => v != null && Number.isFinite(v));
  const last = pts.length ? pts[pts.length - 1] : null;
  const lastLabel =
    last == null
      ? '—'
      : signed
        ? formatSigned(last, digits)
        : String(round(last, digits));
  const tone =
    !signed || last == null || last === 0 ? '' : last > 0 ? 'is-pos' : 'is-neg';
  const svg = renderSeriesChartSvg(values, { signed });
  return `<article class="chs-chart-card ${tone}">
    <div class="chs-chart-top">
      <h3>${esc(title)}</h3>
      <p class="chs-chart-last">${esc(lastLabel)}${unit ? `<span class="chs-chart-unit">${esc(unit)}</span>` : ''}</p>
    </div>
    ${svg}
  </article>`;
}

/**
 * Health snapshot for a separate sheet (not on the logging home).
 * WHtR, waist zone, ideal kg, week kg from balance + trend/exercise charts.
 */
export function computeHealthSnapshot(calorie, endKey = toDateKey(), trendDays = 7) {
  const sheet = normalizeCalorie(calorie);
  const days = normalizeTrendDays(trendDays, 7);
  const week = computeWeekSummary(sheet, endKey);
  const trends = computeTrendSeries(sheet, days, endKey);
  const exercise = computeExerciseStats(sheet, days, endKey);
  const known = lastKnownBody(sheet);
  const weight = known.weight;
  const waist = known.waist;
  const height = sheet.heightCm;
  const bmi = computeBmi(weight, height);
  const whtr =
    Number.isFinite(waist) && Number.isFinite(height) && height > 0
      ? round(waist / height, 2)
      : null;
  const whtrLevel =
    whtr == null ? null : whtr < 0.5 ? 'ok' : whtr < 0.6 ? 'watch' : 'high';
  const waistZone = waistRiskZone(waist, sheet.sex);
  const ideal = idealWeightRange(height);
  const weekKg =
    week.balSum != null && sheet.kcalPerKg
      ? round(week.balSum / sheet.kcalPerKg, 2)
      : null;
  const age = ageFromBirthDate(sheet.birthDate, endKey) ?? sheet.age;
  const rangeMeta = HEALTH_TREND_RANGES.find((r) => r.days === days) || { days, label: `${days} วัน` };
  return {
    heightCm: height,
    weight,
    waist,
    sex: sheet.sex,
    age,
    birthDate: sheet.birthDate,
    bmi,
    whtr,
    whtrLevel,
    waistZone,
    ideal,
    week,
    weekKg,
    proteinFactor: sheet.proteinFactor,
    trends,
    exercise,
    trendDays: days,
    trendRangeLabel: rangeMeta.label,
  };
}

export function renderHealthSheetHtml(snap) {
  if (!snap) return '';
  const sexLabel = snap.sex === 'female' ? 'หญิง' : 'ชาย';
  const bmiV = snap.bmi == null ? '—' : snap.bmi;
  const whtrV = snap.whtr == null ? '—' : snap.whtr;
  const whtrHint =
    snap.whtrLevel === 'ok'
      ? 'ต่ำกว่า 0.5 — ช่วงกลางตัวโอเค'
      : snap.whtrLevel === 'watch'
        ? '0.5–0.6 — ควรลดไขมันช่วงกลางตัว'
        : snap.whtrLevel === 'high'
          ? '≥ 0.6 — เสี่ยงสูงขึ้น'
          : 'เอว ÷ ส่วนสูง';
  const waistV = snap.waist == null ? '—' : snap.waist;
  const waistHint = snap.waistZone
    ? `${snap.waistZone.label} (เกณฑ์เอเชีย ${snap.sex === 'female' ? 'หญิง ≥80' : 'ชาย ≥90'} ซม.)`
    : 'ยังไม่มีรอบเอว';
  const idealV = snap.ideal
    ? `${snap.ideal.low}–${snap.ideal.high} กก.`
    : '—';
  const weekKgV =
    snap.weekKg == null
      ? '—'
      : `${snap.weekKg > 0 ? '+' : ''}${snap.weekKg} กก.`;
  const weekKgTone =
    snap.weekKg == null || snap.weekKg === 0
      ? ''
      : snap.weekKg > 0
        ? 'is-pos'
        : 'is-neg';
  const levelClass = (lv) =>
    lv === 'ok' ? 'is-ok' : lv === 'watch' ? 'is-watch' : lv === 'high' ? 'is-high' : '';

  const activeDays = normalizeTrendDays(snap.trendDays, 7);
  const rangeChips = HEALTH_TREND_RANGES.map((r) => {
    const on = r.days === activeDays ? ' is-active' : '';
    return `<button type="button" class="chs-range-btn${on}" data-chs-range="${r.days}" aria-pressed="${r.days === activeDays ? 'true' : 'false'}">${esc(r.label)}</button>`;
  }).join('');

  const t = snap.trends;
  const ex = snap.exercise;
  const rangeLabel = t
    ? `${t.startLabel}–${t.endLabel} · ${t.logged || 0} วันที่มีบันทึก`
    : '';
  const trendBlock = t
    ? `<section class="chs-section">
      <header class="chs-section-head">
        <h3 class="chs-section-title">แนวโน้ม</h3>
        <p class="chs-section-sub">${esc(rangeLabel)}</p>
      </header>
      <div class="chs-chart-grid">
        ${chartCardHtml('เอว', t.waist, { unit: 'ซม.', digits: 1 })}
        ${chartCardHtml('น้ำหนัก', t.weight, { unit: 'กก.', digits: 1 })}
        ${chartCardHtml('แคล', t.cal, { unit: 'kcal', digits: 0 })}
        ${chartCardHtml('โปรตีน', t.prot, { unit: 'ก.', digits: 1 })}
        ${chartCardHtml('Balance แคล', t.balance, { signed: true, unit: 'kcal', digits: 0 })}
        ${chartCardHtml('น้ำหนักบวกลบ', t.blKg, { signed: true, unit: 'กก.', digits: 2 })}
      </div>
    </section>`
    : '';
  const musPts = (ex?.mus || []).filter((v) => v != null && Number.isFinite(v) && v > 0);
  const musLast = musPts.length ? musPts[musPts.length - 1] : null;
  const musTone =
    musLast == null || musLast === 0 ? '' : musLast > 0 ? 'is-pos' : '';
  const exerciseBlock = ex
    ? `<section class="chs-section">
      <header class="chs-section-head">
        <h3 class="chs-section-title">กลุ่มออกกำลังกาย</h3>
        <p class="chs-section-sub">เบิร์นรวม ${esc(ex.musSum || 0)} kcal · ${esc(ex.startLabel)}–${esc(ex.endLabel)}</p>
      </header>
      <article class="chs-chart-card chs-chart-card-wide">
        <div class="chs-chart-top">
          <h3>ท่าที่เล่น</h3>
          <p class="chs-chart-last">${esc(ex.poses?.length || 0)}<span class="chs-chart-unit">ท่า</span></p>
        </div>
        ${renderPoseBarsHtml(ex.poses)}
      </article>
      <article class="chs-chart-card chs-chart-card-wide ${musTone}">
        <div class="chs-chart-top">
          <h3>แคลอรีเบิร์น</h3>
          <p class="chs-chart-last">${esc(musLast ?? '—')}<span class="chs-chart-unit">kcal</span></p>
        </div>
        ${renderSeriesChartSvg(ex.mus || [], { className: 'chs-chart-svg is-burn' })}
      </article>
    </section>`
    : '';

  return `
    <header class="chs-head">
      <h2 class="chs-title">สรุปสุขภาพ</h2>
      <p class="chs-sub">ตัวเลขจากข้อมูลที่มี · เลือกช่วงเวลากราฟด้านล่าง</p>
      <div class="chs-range" role="toolbar" aria-label="ช่วงเวลากราฟ">${rangeChips}</div>
    </header>
    <div class="chs-grid">
      <article class="chs-card">
        <h3>ร่างกายล่าสุด</h3>
        <p>สูง <strong>${esc(snap.heightCm ?? '—')}</strong> ซม. · ${esc(sexLabel)} · อายุ <strong>${esc(snap.age ?? '—')}</strong> ปี</p>
        <p>น้ำหนัก <strong>${esc(snap.weight ?? '—')}</strong> กก. · เอว <strong>${esc(waistV)}</strong> ซม.</p>
      </article>
      <article class="chs-card">
        <h3>BMI</h3>
        <p class="chs-big">${esc(bmiV)}</p>
        <p class="chs-hint">น้ำหนัก ÷ ส่วนสูง²</p>
      </article>
      <article class="chs-card ${levelClass(snap.whtrLevel)}">
        <h3>WHtR เอว/สูง</h3>
        <p class="chs-big">${esc(whtrV)}</p>
        <p class="chs-hint">${esc(whtrHint)}</p>
      </article>
      <article class="chs-card ${levelClass(snap.waistZone?.level)}">
        <h3>โซนรอบเอว</h3>
        <p class="chs-big">${esc(snap.waistZone?.label || '—')}</p>
        <p class="chs-hint">${esc(waistHint)}</p>
      </article>
      <article class="chs-card">
        <h3>ช่วง กก. แนะนำ</h3>
        <p class="chs-big chs-big-sm">${esc(idealV)}</p>
        <p class="chs-hint">BMI 18.5–24.9 จากส่วนสูง</p>
      </article>
      <article class="chs-card ${weekKgTone}">
        <h3>แนวโน้ม 7 วัน</h3>
        <p class="chs-big chs-big-sm">${esc(weekKgV)}</p>
        <p class="chs-hint">จาก bal รวม ÷ 7700 · คร่าวๆ เท่านั้น</p>
      </article>
    </div>
    ${trendBlock}
    ${exerciseBlock}
    <p class="chs-foot">โปรตีนเป้า ≈ น้ำหนัก × ${esc(snap.proteinFactor)} ก./กก. · กราฟช่วง ${esc(snap.trendRangeLabel || '')}</p>`;
}

export function computeTotals(calorie) {
  const sheet = normalizeCalorie(calorie);
  const all = emptyTotals();
  const byMonth = new Map();
  // Day# within month counts oldest→newest even though display is newest-first.
  const monthIndex = new Map();
  const countById = new Map();
  [...sheet.days]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .forEach((day) => {
      const mk = monthKeyFromDate(day.date);
      const mi = (monthIndex.get(mk) || 0) + 1;
      monthIndex.set(mk, mi);
      countById.set(day.id, mi);
    });
  const rows = sheet.days.map((day) => {
    const metrics = computeDayMetrics(day, sheet);
    const monthKey = monthKeyFromDate(day.date);
    accumulateTotals(all, metrics);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, emptyTotals());
    accumulateTotals(byMonth.get(monthKey), metrics);
    return {
      ...day,
      count: countById.get(day.id) || 0,
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
  days.sort((a, b) => String(b.date).localeCompare(String(a.date)));
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

/** @deprecated Days are not deleted — use clearDayValues. Kept for rare data repair. */
export function deleteDay(calorie, dayId) {
  const sheet = normalizeCalorie(calorie);
  return {
    ...sheet,
    days: sheet.days.filter((d) => d.id !== dayId),
    updatedAt: nowIso(),
  };
}

/** Clear meal/mus/note on a day (keep date row + optional body fields). */
export function clearDayValues(calorie, dayId, { clearBody = false } = {}) {
  const sheet = normalizeCalorie(calorie);
  const patch = {
    meals: Array.from({ length: MIN_MEAL_SLOTS }, () => ''),
    mus: null,
    note: '',
  };
  if (clearBody) {
    patch.waist = null;
    patch.weight = null;
  }
  return pruneFrequentMus(patchDay(sheet, dayId, patch));
}

/** Add today (or date) cloning last known waist/weight. Base is auto from BMR. */
export function addDayFromLast(calorie, dateKey = toDateKey(new Date())) {
  const sheet = normalizeCalorie(calorie);
  const existing = sheet.days.find((d) => d.date === dateKey);
  if (existing) return { sheet, day: existing, created: false };
  const known = lastKnownBody(sheet);
  const day = createDayRow({
    date: dateKey,
    waist: known.waist,
    weight: known.weight,
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

/** Fixed fit-width grid: 10 columns (no horizontal scroll). */
const CAL_FIT_COLS = 10;

function colCountForMeals(_mealCols) {
  return CAL_FIT_COLS;
}

export function renderCalorieMealHeaderHtml(mealCols = MIN_MEAL_SLOTS) {
  const n = clampNum(mealCols, MIN_MEAL_SLOTS, MAX_MEAL_SLOTS, MIN_MEAL_SLOTS);
  return `<colgroup>
              <col class="cal-cg-n">
              <col class="cal-cg-date">
              <col class="cal-cg-mealband">
              <col class="cal-cg-mealband">
              <col class="cal-cg-mealband">
              <col class="cal-cg-mealband">
              <col class="cal-cg-mealband">
              <col class="cal-cg-mealband">
              <col class="cal-cg-tail">
              <col class="cal-cg-del">
            </colgroup>
            <tr class="cal-head-a">
              <th class="cal-col-n" scope="col">#</th>
              <th class="cal-col-date" scope="col">ว/ด/ป</th>
              <th class="cal-col-day" scope="col">ว</th>
              <th class="cal-col-body" scope="col">เอว</th>
              <th class="cal-col-body" scope="col">กก</th>
              <th class="cal-col-sum cal-col-add" scope="col">cal</th>
              <th class="cal-col-sum" scope="col">P</th>
              <th class="cal-col-sum" scope="col">p±</th>
              <th class="cal-col-sum" scope="col">bal</th>
              <th class="cal-col-sum" scope="col">kg</th>
            </tr>
            <tr class="cal-head-b">
              <th class="cal-col-burn" scope="col">mus</th>
              <th class="cal-col-burn" scope="col" title="base · Σ · %">เบิร์น</th>
              <th class="cal-col-meals" colspan="6" scope="col">มื้อ 1–${n}</th>
              <th class="cal-col-note" scope="col">หลัก</th>
              <th class="cal-col-del" scope="col"><span class="sr-only">เคลียร์</span>×</th>
            </tr>`;
}

export function renderCalorieRowsHtml(rows, todayKey = toDateKey(new Date()), mealCols = MIN_MEAL_SLOTS) {
  if (!rows.length) return '';
  const cols = clampNum(mealCols, MIN_MEAL_SLOTS, MAX_MEAL_SLOTS, MIN_MEAL_SLOTS);
  const span = CAL_FIT_COLS;
  let lastMonth = '';
  return rows
    .map((row) => {
      const m = row.metrics;
      const today = row.date === todayKey ? ' cal-row-today' : '';
      const rawMeals = expandMealsForEdit(row.meals);
      const mealInputs = [];
      for (let i = 0; i < cols; i += 1) {
        const cell = rawMeals[i] || '';
        const has = cell ? ' has-value' : '';
        mealInputs.push(
          `<span class="cal-input-wrap cal-input-wrap-meal${has}"><input class="cal-cell cal-cell-meal" data-cal-field="meal" data-meal-index="${i}" data-day-id="${esc(row.id)}" value="${esc(cell)}" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="มื้อ ${i + 1}" placeholder="${i + 1}"><button type="button" class="cal-field-clear" data-cal-clear-field="meal" data-meal-index="${i}" data-day-id="${esc(row.id)}" aria-label="เคลียร์มื้อ ${i + 1}" title="เคลียร์">×</button></span>`,
        );
      }
      let sep = '';
      if (row.monthKey && row.monthKey !== lastMonth) {
        lastMonth = row.monthKey;
        sep = `<tr class="cal-month-sep" data-month="${esc(row.monthKey)}" aria-label="${esc(row.monthLabel)}">
          <td colspan="${span}"><span>${esc(row.monthLabel)}</span></td>
        </tr>`;
      }
      const id = esc(row.id);
      const month = esc(row.monthKey || '');
      return `${sep}<tr class="cal-row cal-day-a${today}" data-day-id="${id}" data-month="${month}">
        <td class="cal-col-n">${row.count}</td>
        <td class="cal-col-date">
          <button type="button" class="cal-date-btn" data-cal-date-open="${id}" aria-label="วันที่ ${esc(row.dateDisplay)}">${esc(row.dateDisplay)}</button>
          <input class="cal-date-picker" type="date" data-cal-field="date" data-day-id="${id}" value="${esc(row.date)}" tabindex="-1" aria-hidden="true">
        </td>
        <td class="cal-col-day">${esc(row.dayName)}</td>
        <td class="cal-col-body"><input class="cal-cell" data-cal-field="waist" data-day-id="${id}" value="${row.waist ?? ''}" inputmode="decimal" aria-label="รอบเอว"></td>
        <td class="cal-col-body"><input class="cal-cell" data-cal-field="weight" data-day-id="${id}" value="${row.weight ?? ''}" inputmode="decimal" aria-label="น้ำหนัก"></td>
        <td class="cal-col-sum cal-col-add cal-derived" data-cal-derived="addCal">${m.addCal ?? ''}</td>
        <td class="cal-col-sum cal-derived" data-cal-derived="prot">${m.prot ?? ''}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.pRm)}" data-cal-derived="pRm">${m.pRm == null ? '' : formatSigned(m.pRm, 1)}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.balance)}" data-cal-derived="balance">${m.balance == null ? '' : formatSigned(m.balance, 0)}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.blKg)}" data-cal-derived="blKg">${m.blKg == null ? '' : formatSigned(m.blKg, 2)}</td>
      </tr>
      <tr class="cal-row cal-day-b${today}" data-day-id="${id}" data-month="${month}">
        <td class="cal-col-burn"><span class="cal-input-wrap${row.mus != null && row.mus !== '' ? ' has-value' : ''}"><input class="cal-cell" data-cal-field="mus" data-day-id="${id}" value="${row.mus ?? ''}" inputmode="numeric" aria-label="ออกกำลัง"><button type="button" class="cal-field-clear" data-cal-clear-field="mus" data-day-id="${id}" aria-label="เคลียร์ออกกำลัง" title="เคลียร์">×</button></span></td>
        <td class="cal-col-burn cal-burn-stack" title="BMR · รวมเบิร์น · %bal">
          <span class="cal-derived cal-base-auto" data-cal-derived="base">${m.base ?? ''}</span>
          <span class="cal-burn-stack-sub">
            <span class="cal-derived" data-cal-derived="bsum">${m.bsum ?? ''}</span>
            <span class="cal-derived ${toneClass(m.pctBl)}" data-cal-derived="pctBl">${m.pctBl == null ? '' : `${m.pctBl}%`}</span>
          </span>
        </td>
        <td class="cal-col-meals" colspan="6"><div class="cal-meals-fit" style="--cal-meal-n:${cols}">${mealInputs.join('')}</div></td>
        <td class="cal-col-note"><input class="cal-cell cal-cell-note" data-cal-field="note" data-day-id="${id}" value="${esc(row.note)}" autocomplete="off" aria-label="หลัก"></td>
        <td class="cal-col-del"><button type="button" class="cal-del-btn" data-cal-clear="${id}" aria-label="เคลียร์ค่าวันนี้" title="เคลียร์ค่า">×</button></td>
      </tr>`;
    })
    .join('');
}

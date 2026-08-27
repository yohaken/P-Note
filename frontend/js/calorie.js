/**
 * Calorie spreadsheet (Phase 1) — day rows matching the personal sheet layout.
 * Meals are "kcal,protein" cells; derived columns are computed, not stored.
 */

import { nowIso, compareStamp, newerStampIso } from './clock.js?v=227';

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
  const p = Number.isFinite(prot) ? Math.round(prot) : 0;
  if (!c && !p) return '';
  // Always store "cal,prot" so the comma pattern stays consistent.
  return `${c},${p}`;
}

/** Thai copy when meal text fails the required "int,int" pattern. */
export const MEAL_PATTERN_HINT = 'รูปแบบไม่ถูก — ต้องเป็นจำนวนเต็มคั่นด้วยคอมมา เช่น 130,27';

/**
 * Quick-add meal text → { cal, prot, label }.
 * Required pattern: integers with a comma — "130,27" or "ข้าวต้ม 180,12".
 * Rejects decimals, spaces/semicolons as separators, and cal-only ("350").
 */
export function parseQuickMeal(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  // Optional label before the pair; pair must be digits,digits at end.
  const m = s.match(/^(?:(.+?)\s+)?(\d+),(\d+)$/);
  if (!m) return null;
  const cal = Number(m[2]);
  const prot = Number(m[3]);
  if (!Number.isInteger(cal) || !Number.isInteger(prot) || cal <= 0 || prot < 0) return null;
  const label = String(m[1] || '').trim().slice(0, 80);
  return { cal, prot, label };
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
    const err = new Error(MEAL_PATTERN_HINT);
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
    const cal = Number.isFinite(parsed?.cal) ? Math.round(parsed.cal) : '';
    const prot = Number.isFinite(parsed?.prot) ? Math.round(parsed.prot) : 0;
    const pair = cal === '' ? t : `${cal},${prot}`;
    label = parsed?.label
      ? `${String(parsed.label).slice(0, 14)} ${pair}`
      : pair;
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

/** Day-of-month (1–31) only — month/year come from the month header above. */
export function dayNumberFromKey(dateKey) {
  const d = parseDateKey(dateKey);
  if (!d) return '';
  return String(d.getDate());
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
    goalWaistCm: null,
    goalWeightKg: null,
    days: [],
    freqMeals: [],
    freqMus: [],
    ...overrides,
  });
}

/** Optional numeric goal — empty/invalid → null (unset). */
function normalizeOptionalGoal(raw, min, max) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return round(n, 1);
}

/**
 * Progress toward a lower-is-better body goal (waist / weight).
 * remaining > 0 = still above goal; ≤ 0 = at/under goal.
 */
export function computeBodyGoalProgress(current, goal) {
  if (!Number.isFinite(goal) || goal <= 0) {
    return { set: false, current: Number.isFinite(current) ? current : null, goal: null };
  }
  const cur = Number.isFinite(current) ? current : null;
  if (cur == null) {
    return { set: true, current: null, goal, remaining: null, met: false, pct: null };
  }
  const remaining = round(cur - goal, 1);
  const met = remaining <= 0;
  // How far from a soft start (goal + 20% or +10 units) — for a simple bar.
  const span = Math.max(goal * 0.2, 10);
  const pct = met ? 100 : Math.max(0, Math.min(99, round((1 - remaining / span) * 100, 0)));
  return { set: true, current: cur, goal, remaining, met, pct };
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
  const updatedAt = partial.updatedAt || '';
  const meals = normalizeMeals(partial.meals);
  return {
    id: String(partial.id || crypto.randomUUID()),
    date,
    waist: partial.waist == null || partial.waist === '' ? null : Number(partial.waist),
    weight: partial.weight == null || partial.weight === '' ? null : Number(partial.weight),
    meals,
    mealsAt: normalizeMealsAt(partial.mealsAt, meals, updatedAt),
    mus: partial.mus == null || partial.mus === '' ? null : Number(partial.mus),
    base: partial.base == null || partial.base === '' ? null : Number(partial.base),
    note: String(partial.note || '').slice(0, 200),
    waistAt: partial.waistAt || '',
    weightAt: partial.weightAt || '',
    musAt: partial.musAt || '',
    noteAt: partial.noteAt || '',
    // Do NOT fabricate a "now" stamp for existing rows — that lets stale
    // legacy data win merges against genuinely newer cloud content.
    updatedAt,
  };
}

/**
 * Align per-slot meal edit times to the meal cells. A provided stamp is kept
 * even for an empty cell (that empty = an intentional clear), while a slot
 * with no stamp falls back to the day stamp only when it has content.
 */
function normalizeMealsAt(mealsAt, meals, fallbackAt) {
  const at = Array.isArray(mealsAt) ? mealsAt : [];
  return meals.map((cell, i) => {
    if (at[i]) return String(at[i]).slice(0, 40);
    if (!String(cell || '').trim()) return '';
    return fallbackAt ? String(fallbackAt).slice(0, 40) : '';
  });
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
    // Do NOT fabricate "now" — existing sheets without a stamp must merge as
    // "oldest", not as "newest".
    updatedAt: src.updatedAt || '',
    // Profile/goal edits carry their own stamp so a meal/day edit on the other
    // device cannot clobber height/sex/goals (and vice versa).
    profileAt: src.profileAt || '',
    proteinFactor: round(proteinFactor, 2),
    kcalPerKg: Math.round(kcalPerKg),
    defaultBase: Math.round(defaultBase),
    heightCm: Math.round(heightCm),
    birthDate,
    age: Math.round(age),
    sex,
    goalWaistCm: normalizeOptionalGoal(src.goalWaistCm, 40, 200),
    goalWeightKg: normalizeOptionalGoal(src.goalWeightKg, 30, 300),
    freqMeals: normalizeFreqList(src.freqMeals),
    freqMus: normalizeFreqList(src.freqMus),
    /** Pinned health widgets on home dash — synced via Firestore with calorie payload */
    homePins: normalizeHomePins(src.homePins),
    /**
     * Bumped only when homePins change. Do NOT fall back to sheet updatedAt —
     * a later meal edit must not look like a newer pin layout.
     * Legacy: if pins exist without a stamp, borrow updatedAt once so they still merge.
     */
    homePinsAt: (() => {
      const pins = normalizeHomePins(src.homePins);
      const stamped = String(src.homePinsAt || '').trim();
      if (stamped) return stamped;
      return pins.length ? String(src.updatedAt || '') : '';
    })(),
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
  { days: 30, label: '1 เดือน' },
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

/** Nice step for axis ticks (1 / 2 / 5 × 10^n). */
function niceNum(range, roundUp) {
  const r = Math.abs(Number(range)) || 1;
  const exp = Math.floor(Math.log10(r));
  const base = 10 ** exp;
  const frac = r / base;
  let nice;
  if (roundUp) {
    if (frac <= 1) nice = 1;
    else if (frac <= 2) nice = 2;
    else if (frac <= 5) nice = 5;
    else nice = 10;
  } else if (frac < 1.5) nice = 1;
  else if (frac < 3) nice = 2;
  else if (frac < 7) nice = 5;
  else nice = 10;
  return nice * base;
}

/**
 * Axis scale from data min/max. Signed series always include 0.
 * @returns {{ min: number, max: number, ticks: number[] }}
 */
export function niceAxisScale(minV, maxV, { signed = false, tickTarget = 3 } = {}) {
  let lo = Number(minV);
  let hi = Number(maxV);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return { min: signed ? -1 : 0, max: 1, ticks: signed ? [-1, 0, 1] : [0, 1] };
  }
  if (signed) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (lo === hi) {
    if (signed && lo === 0) {
      lo = -1;
      hi = 1;
    } else {
      const pad = Math.abs(lo) * 0.05 || 1;
      lo -= pad;
      hi += pad;
    }
  } else {
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
  }
  if (signed) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  const span = niceNum(hi - lo, false);
  const step = niceNum(span / Math.max(1, tickTarget - 1), true) || 1;
  let niceMin = Math.floor(lo / step) * step;
  let niceMax = Math.ceil(hi / step) * step;
  if (signed) {
    niceMin = Math.min(niceMin, 0);
    niceMax = Math.max(niceMax, 0);
  }
  if (niceMin === niceMax) {
    niceMin -= step;
    niceMax += step;
  }
  const ticks = [];
  const maxIter = 12;
  for (let i = 0, v = niceMin; i < maxIter && v <= niceMax + step * 0.5; i += 1, v += step) {
    ticks.push(round(v, 6));
  }
  if (!ticks.length) ticks.push(niceMin, niceMax);
  return { min: niceMin, max: niceMax, ticks };
}

function formatAxisTick(v, digits = 0) {
  if (!Number.isFinite(v)) return '';
  if (digits <= 0) {
    const n = Math.round(v);
    return Math.abs(n) >= 1000 ? `${round(n / 1000, 1)}k` : String(n);
  }
  return String(round(v, digits));
}

function shortDateTick(dateKey) {
  const d = parseDateKey(dateKey);
  if (!d) return '';
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** Pick start / mid / end indices for X ticks. */
function xTickIndices(n) {
  if (n <= 1) return [0];
  if (n === 2) return [0, 1];
  if (n <= 5) return Array.from({ length: n }, (_, i) => i);
  const mid = Math.floor((n - 1) / 2);
  return [...new Set([0, mid, n - 1])].sort((a, b) => a - b);
}

/**
 * Line / area SVG with labeled X/Y axes and a readable value scale.
 * nulls in values = gaps. X = day; Y = metric unit (กก. / ซม. / kcal / …).
 */
export function renderSeriesChartSvg(
  values,
  {
    width = 300,
    height = 96,
    signed = false,
    className = 'chs-chart-svg',
    unit = '',
    digits = 0,
    labels = null,
    dates = null,
    xLabel = 'วัน',
    yLabel = '',
  } = {},
) {
  const pts = [];
  (values || []).forEach((v, i) => {
    if (v != null && Number.isFinite(v)) pts.push({ i, v });
  });
  const w = width;
  const h = height;
  const yAxisName = yLabel || unit || '';
  if (pts.length < 1) {
    return `<svg class="${esc(className)}" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="ยังไม่มีข้อมูลกราฟ">
      <text class="chs-chart-empty-text" x="${w / 2}" y="${h / 2}" text-anchor="middle">ไม่มีข้อมูล</text>
    </svg>`;
  }

  const rawMin = Math.min(...pts.map((p) => p.v));
  const rawMax = Math.max(...pts.map((p) => p.v));
  const scale = niceAxisScale(rawMin, rawMax, { signed, tickTarget: 3 });
  const { min, max, ticks: yTicks } = scale;
  const span = max - min || 1;
  const n = Math.max((values || []).length, 2);

  // Plot box leaves room for Y ticks (left), X ticks (bottom), unit (top).
  const padL = 30;
  const padR = 6;
  const padT = 14;
  const padB = 18;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const xAt = (i) => padL + (i / (n - 1)) * plotW;
  const yAt = (v) => padT + (1 - (v - min) / span) * plotH;

  const coords = pts.map((p) => `${xAt(p.i).toFixed(1)},${yAt(p.v).toFixed(1)}`);
  const last = pts[pts.length - 1];

  // Grid + Y ticks
  const grid = yTicks
    .map((tv) => {
      const y = yAt(tv).toFixed(1);
      return `<line class="chs-chart-grid" x1="${padL}" x2="${(padL + plotW).toFixed(1)}" y1="${y}" y2="${y}" />`;
    })
    .join('');
  const yTickLabels = yTicks
    .map((tv) => {
      const y = yAt(tv).toFixed(1);
      return `<text class="chs-chart-tick chs-chart-tick-y" x="${padL - 3}" y="${y}" text-anchor="end" dominant-baseline="middle">${esc(formatAxisTick(tv, digits))}</text>`;
    })
    .join('');

  // X ticks from dates (preferred) or day-name labels
  const xIdx = xTickIndices(n);
  const xTickLabels = xIdx
    .map((i) => {
      const dateKey = Array.isArray(dates) ? dates[i] : null;
      const dayName = Array.isArray(labels) ? labels[i] : '';
      const text = dateKey ? shortDateTick(dateKey) : String(dayName || i + 1);
      if (!text) return '';
      const x = xAt(i).toFixed(1);
      const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      return `<text class="chs-chart-tick chs-chart-tick-x" x="${x}" y="${(h - 4).toFixed(1)}" text-anchor="${anchor}">${esc(text)}</text>`;
    })
    .join('');

  const axisLines = `
    <line class="chs-chart-axis" x1="${padL}" y1="${padT}" x2="${padL}" y2="${(padT + plotH).toFixed(1)}" />
    <line class="chs-chart-axis" x1="${padL}" y1="${(padT + plotH).toFixed(1)}" x2="${(padL + plotW).toFixed(1)}" y2="${(padT + plotH).toFixed(1)}" />`;

  const yTitle = yAxisName
    ? `<text class="chs-chart-axis-label chs-chart-axis-y" x="${padL}" y="9">${esc(`Y · ${yAxisName}`)}</text>`
    : '';

  let zeroLine = '';
  if (signed && min < 0 && max > 0) {
    const y0 = yAt(0);
    zeroLine = `<line class="chs-chart-zero" x1="${padL}" x2="${(padL + plotW).toFixed(1)}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}" />`;
  }

  let area = '';
  if (pts.length >= 2) {
    const baseY = signed && min < 0 && max > 0 ? yAt(0) : padT + plotH;
    area = `<polygon class="chs-chart-area" points="${xAt(pts[0].i).toFixed(1)},${baseY.toFixed(1)} ${coords.join(' ')} ${xAt(last.i).toFixed(1)},${baseY.toFixed(1)}" />`;
  }
  const line =
    pts.length >= 2
      ? `<polyline class="chs-chart-line" fill="none" points="${coords.join(' ')}" />`
      : '';
  const dot = `<circle class="chs-chart-dot" cx="${xAt(last.i).toFixed(1)}" cy="${yAt(last.v).toFixed(1)}" r="2.4" />`;

  const scaleHint = `${yAxisName || 'ค่า'} ${formatAxisTick(min, digits)}–${formatAxisTick(max, digits)} · แกน X วัน`;
  return `<svg class="${esc(className)}${signed ? ' is-signed' : ''} has-axes" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="${esc(scaleHint)}">${yTitle}${grid}${axisLines}${zeroLine}${area}${line}${dot}${yTickLabels}${xTickLabels}</svg>
  <p class="chs-chart-scale"><span>Y: ${esc(yAxisName || 'ค่า')} (${esc(formatAxisTick(min, digits))}–${esc(formatAxisTick(max, digits))})</span><span>X: ${esc(xLabel || 'วัน')}</span></p>`;
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

/** Pinnable widgets from health sheet → home dash (unique ids, 2 per row). */
export const HOME_PIN_IDS = [
  'goal-waist',
  'goal-weight',
  'card-body',
  'card-bmi',
  'card-whtr',
  'card-waistZone',
  'card-ideal',
  'card-weekKg',
  'chart-waist',
  'chart-weight',
  'chart-cal',
  'chart-prot',
  'chart-balance',
  'chart-blKg',
  'ex-poses',
  'ex-mus',
];
/** Soft cap = all pinnable widgets (no arbitrary 4-box limit). */
export const HOME_PIN_MAX = HOME_PIN_IDS.length;

const HOME_PIN_LABELS = {
  'goal-waist': 'เป้าเอว',
  'goal-weight': 'เป้าน้ำหนัก',
  'card-body': 'ร่างกายล่าสุด',
  'card-bmi': 'BMI',
  'card-whtr': 'WHtR เอว/สูง',
  'card-waistZone': 'โซนรอบเอว',
  'card-ideal': 'ช่วง กก. แนะนำ',
  'card-weekKg': 'แนวโน้มกก.',
  'chart-waist': 'เอว',
  'chart-weight': 'น้ำหนัก',
  'chart-cal': 'แคล',
  'chart-prot': 'โปรตีน',
  'chart-balance': 'Balance แคล',
  'chart-blKg': 'น้ำหนักบวกลบ',
  'ex-poses': 'ท่าที่เล่น',
  'ex-mus': 'แคลอรีเบิร์น',
};

export function homePinLabel(id) {
  return HOME_PIN_LABELS[id] || String(id || '');
}

export function normalizeHomePins(raw) {
  const allowed = new Set(HOME_PIN_IDS);
  const seen = new Set();
  const out = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const item of list) {
    const id = String(item || '').trim();
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function chartCardHtml(
  title,
  values,
  {
    signed = false,
    unit = '',
    digits = 0,
    pinId = '',
    className = '',
    labels = null,
    dates = null,
  } = {},
) {
  const pts = (values || []).filter((v) => v != null && Number.isFinite(v));
  const last = pts.length ? pts[pts.length - 1] : null;
  const lastLabel =
    last == null
      ? '—'
      : signed
        ? formatSigned(last, digits)
        : String(round(last, digits));
  const tone =
    !signed || last == null || last === 0 ? '' : last > 0 ? 'is-pos' : 'is-neg';
  const svg = renderSeriesChartSvg(values, {
    signed,
    unit,
    digits,
    labels,
    dates,
    yLabel: unit,
    xLabel: 'วัน',
  });
  const pinAttr = pinId ? ` data-pin-id="${esc(pinId)}"` : '';
  const pinClass = pinId ? ' is-pinnable' : '';
  return `<article class="chs-chart-card ${tone}${pinClass} ${esc(className)}"${pinAttr}>
    <div class="chs-chart-top">
      <h3>${esc(title)}</h3>
      <p class="chs-chart-last">${esc(lastLabel)}${unit ? `<span class="chs-chart-unit">${esc(unit)}</span>` : ''}</p>
    </div>
    ${svg}
  </article>`;
}

/**
 * Home-dash card with the same inner details as the health-sheet widget.
 */
export function renderHomePinCardHtml(pinId, snap) {
  const id = String(pinId || '');
  if (!snap || !HOME_PIN_LABELS[id]) return '';
  const t = snap.trends || {};
  const ex = snap.exercise || {};
  const levelClass = (lv) =>
    lv === 'ok' ? 'is-ok' : lv === 'watch' ? 'is-watch' : lv === 'high' ? 'is-high' : '';

  if (id.startsWith('chart-')) {
    const map = {
      'chart-waist': { title: 'เอว', values: t.waist, unit: 'ซม.', digits: 1 },
      'chart-weight': { title: 'น้ำหนัก', values: t.weight, unit: 'กก.', digits: 1 },
      'chart-cal': { title: 'แคล', values: t.cal, unit: 'kcal', digits: 0 },
      'chart-prot': { title: 'โปรตีน', values: t.prot, unit: 'ก.', digits: 1 },
      'chart-balance': { title: 'Balance แคล', values: t.balance, signed: true, unit: 'kcal', digits: 0 },
      'chart-blKg': { title: 'น้ำหนักบวกลบ', values: t.blKg, signed: true, unit: 'กก.', digits: 2 },
    };
    const cfg = map[id];
    return chartCardHtml(cfg.title, cfg.values || [], {
      ...cfg,
      labels: t.labels,
      dates: t.dates,
      pinId: id,
      className: 'cd-pin-card',
    });
  }
  if (id === 'ex-poses') {
    return `<article class="chs-chart-card cd-pin-card is-pinnable" data-pin-id="${esc(id)}">
      <div class="chs-chart-top">
        <h3>ท่าที่เล่น</h3>
        <p class="chs-chart-last">${esc(ex.poses?.length || 0)}<span class="chs-chart-unit">ท่า</span></p>
      </div>
      ${renderPoseBarsHtml(ex.poses)}
    </article>`;
  }
  if (id === 'ex-mus') {
    const musPts = (ex.mus || []).filter((v) => v != null && Number.isFinite(v) && v > 0);
    const musLast = musPts.length ? musPts[musPts.length - 1] : null;
    const musTone = musLast == null || musLast === 0 ? '' : 'is-pos';
    const burnSum = ex.musSum == null ? '' : `รวม ${ex.musSum} kcal`;
    return `<article class="chs-chart-card cd-pin-card ${musTone} is-pinnable" data-pin-id="${esc(id)}">
      <div class="chs-chart-top">
        <h3>แคลอรีเบิร์น</h3>
        <p class="chs-chart-last">${esc(musLast ?? '—')}<span class="chs-chart-unit">kcal</span></p>
      </div>
      ${renderSeriesChartSvg(ex.mus || [], {
        className: 'chs-chart-svg is-burn',
        unit: 'kcal',
        digits: 0,
        labels: ex.labels,
        dates: t.dates,
        yLabel: 'kcal',
        xLabel: 'วัน',
      })}
      ${burnSum ? `<p class="chs-hint">${esc(burnSum)}</p>` : ''}
    </article>`;
  }
  if (id === 'goal-waist' || id === 'goal-weight') {
    const isWaist = id === 'goal-waist';
    const html = renderGoalCardHtml(
      isWaist ? 'เอว' : 'น้ำหนัก',
      isWaist ? 'ซม.' : 'กก.',
      isWaist ? snap.goalWaist : snap.goalWeight,
      { primary: isWaist, hint: isWaist ? 'หัวใจหลัก' : 'กล้ามเนื้อทำให้น้ำหนักขึ้นได้' },
    );
    return html
      .replace('class="chs-card chs-goal-card', `class="chs-card chs-goal-card cd-pin-card is-pinnable`)
      .replace('<article ', `<article data-pin-id="${esc(id)}" `);
  }

  const sexLabel = snap.sex === 'female' ? 'หญิง' : 'ชาย';
  const waistV = snap.waist == null ? '—' : snap.waist;
  const whtrV = snap.whtr == null ? '—' : snap.whtr;
  const whtrHint =
    snap.whtrLevel === 'ok'
      ? 'ต่ำกว่า 0.5 — ช่วงกลางตัวโอเค'
      : snap.whtrLevel === 'watch'
        ? '0.5–0.6 — ควรลดไขมันช่วงกลางตัว'
        : snap.whtrLevel === 'high'
          ? '≥ 0.6 — เสี่ยงสูงขึ้น'
          : 'เอว ÷ ส่วนสูง';
  const waistHint = snap.waistZone
    ? `${snap.waistZone.label} (เกณฑ์เอเชีย ${snap.sex === 'female' ? 'หญิง ≥80' : 'ชาย ≥90'} ซม.)`
    : 'ยังไม่มีรอบเอว';
  const idealV = snap.ideal ? `${snap.ideal.low}–${snap.ideal.high} กก.` : '—';
  const weekKgV =
    snap.weekKg == null
      ? '—'
      : `${snap.weekKg > 0 ? '+' : ''}${snap.weekKg} กก.`;
  const weekKgTone =
    snap.weekKg == null || snap.weekKg === 0 ? '' : snap.weekKg > 0 ? 'is-pos' : 'is-neg';

  if (id === 'card-body') {
    return `<article class="chs-card cd-pin-card is-pinnable" data-pin-id="${esc(id)}">
      <h3>ร่างกายล่าสุด</h3>
      <p>สูง <strong>${esc(snap.heightCm ?? '—')}</strong> ซม. · ${esc(sexLabel)} · อายุ <strong>${esc(snap.age ?? '—')}</strong> ปี</p>
      <p>น้ำหนัก <strong>${esc(snap.weight ?? '—')}</strong> กก. · เอว <strong>${esc(waistV)}</strong> ซม.</p>
    </article>`;
  }
  if (id === 'card-bmi') {
    return `<article class="chs-card cd-pin-card is-pinnable" data-pin-id="${esc(id)}">
      <h3>BMI</h3>
      <p class="chs-big">${esc(snap.bmi == null ? '—' : snap.bmi)}</p>
      <p class="chs-hint">น้ำหนัก ÷ ส่วนสูง²</p>
    </article>`;
  }
  if (id === 'card-whtr') {
    return `<article class="chs-card cd-pin-card is-pinnable ${levelClass(snap.whtrLevel)}" data-pin-id="${esc(id)}">
      <h3>WHtR เอว/สูง</h3>
      <p class="chs-big">${esc(whtrV)}</p>
      <p class="chs-hint">${esc(whtrHint)}</p>
    </article>`;
  }
  if (id === 'card-waistZone') {
    return `<article class="chs-card cd-pin-card is-pinnable ${levelClass(snap.waistZone?.level)}" data-pin-id="${esc(id)}">
      <h3>โซนรอบเอว</h3>
      <p class="chs-big">${esc(snap.waistZone?.label || '—')}</p>
      <p class="chs-hint">${esc(waistHint)}</p>
    </article>`;
  }
  if (id === 'card-ideal') {
    return `<article class="chs-card cd-pin-card is-pinnable" data-pin-id="${esc(id)}">
      <h3>ช่วง กก. แนะนำ</h3>
      <p class="chs-big chs-big-sm">${esc(idealV)}</p>
      <p class="chs-hint">BMI 18.5–24.9 จากส่วนสูง</p>
    </article>`;
  }
  if (id === 'card-weekKg') {
    return `<article class="chs-card cd-pin-card is-pinnable ${weekKgTone}" data-pin-id="${esc(id)}">
      <h3>แนวโน้ม 7 วัน</h3>
      <p class="chs-big chs-big-sm">${esc(weekKgV)}</p>
      <p class="chs-hint">จาก bal รวม ÷ 7700 · คร่าวๆ เท่านั้น</p>
    </article>`;
  }
  return '';
}

/**
 * Home dash: range control + pinned cards (2 per row, grows as needed).
 * @param {{ rangeOpen?: boolean }} opts
 */
export function renderHomeDashHtml(snap, pins, opts = {}) {
  const days = normalizeTrendDays(snap?.trendDays, 7);
  const rangeMeta = HEALTH_TREND_RANGES.find((r) => r.days === days) || { days, label: `${days} วัน` };
  const rangeOpen = Boolean(opts.rangeOpen);
  const list = normalizeHomePins(pins);
  const rangeChips = HEALTH_TREND_RANGES.map((r) => {
    const on = r.days === days ? ' is-active' : '';
    return `<button type="button" class="chs-range-btn cd-range-btn${on}" data-cd-range="${r.days}" aria-pressed="${r.days === days ? 'true' : 'false'}">${esc(r.label)}</button>`;
  }).join('');
  const cards = list.map((id) => renderHomePinCardHtml(id, snap)).filter(Boolean).join('');
  const grid = list.length
    ? `<div class="cd-pin-grid">${cards}</div>`
    : `<p class="cd-pin-empty">แตะกล่องในหน้าสรุป → ส่งไปหน้าแรก<br>จัดเรียงแถวละ 2 กล่อง · sync คลาวด์อัตโนมัติ</p>`;
  const rangeLabel = snap?.trends
    ? `${snap.trends.startLabel}–${snap.trends.endLabel}`
    : rangeMeta.label;
  return `
    <div class="cd-head">
      <span class="cd-title">แนวโน้ม</span>
      <button type="button" class="cd-range-toggle" data-cd-range-toggle="1" aria-expanded="${rangeOpen ? 'true' : 'false'}" title="เปลี่ยนช่วงเวลา">
        ${esc(rangeMeta.label)} <span aria-hidden="true">${rangeOpen ? '▴' : '▾'}</span>
      </button>
    </div>
    <p class="cd-sub cd-range-sub">${esc(rangeLabel)}${list.length ? ` · ${list.length} กล่อง` : ''}</p>
    <div class="cd-range-panel${rangeOpen ? ' is-open' : ''}" ${rangeOpen ? '' : 'hidden'}>
      <div class="chs-range cd-range" role="toolbar" aria-label="ช่วงเวลากราฟ">${rangeChips}</div>
    </div>
    ${grid}`;
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
  const goalWaist = computeBodyGoalProgress(waist, sheet.goalWaistCm);
  const goalWeight = computeBodyGoalProgress(weight, sheet.goalWeightKg);
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
    goalWaist,
    goalWeight,
  };
}

/** Compact pursuit line for section summary (lower-is-better goals). */
function bodyGoalAimLine(label, unit, progress) {
  if (!progress?.set) return `${label}: ยังไม่ตั้งทิศ`;
  if (progress.current == null) return `${label}: มุ่ง ${progress.goal} ${unit}`;
  if (progress.met) return `${label}: ทำได้แล้ว ${progress.goal} ${unit}`;
  const rem = formatSigned(progress.remaining, 1).replace(/^\+/, '');
  return `${label}: มุ่ง ${progress.goal} · อีก ${rem} ${unit}`;
}

function summarizeBodyGoals(goalWaist, goalWeight) {
  const waistSet = Boolean(goalWaist?.set);
  const weightSet = Boolean(goalWeight?.set);
  if (!waistSet && !weightSet) {
    return 'ยังไม่มีทิศที่มุ่ง — ตั้งเป้าในตั้งค่า แล้วกลับมาดูความคืบหน้าที่นี่';
  }
  const aiming = [goalWaist, goalWeight].filter((g) => g?.set && !g.met).length;
  const metCount = [goalWaist, goalWeight].filter((g) => g?.set && g.met).length;
  const head =
    aiming === 0 && metCount > 0
      ? 'ทำตามเป้าได้แล้ว'
      : aiming > 0
        ? `กำลังมุ่งไป ${aiming} ทิศ`
        : 'กำลังมุ่งไป';
  return `${head} · ${bodyGoalAimLine('เอว', 'ซม.', goalWaist)} · ${bodyGoalAimLine('น้ำหนัก', 'กก.', goalWeight)}`;
}

/**
 * Goal card framed as a destination you're aiming for (not just a deficit).
 * Shows: เป้าใหญ่ → ตอนนี้ → ระยะที่เหลือ + แถบใกล้เป้า
 */
function renderGoalCardHtml(title, unit, progress, { primary = false, hint = '' } = {}) {
  const role = primary ? 'หลัก' : 'รอง';
  if (!progress?.set) {
    return `<article class="chs-card chs-goal-card chs-goal-aim${primary ? ' is-primary-goal' : ''}">
      <div class="chs-goal-role">${esc(role)}</div>
      <h3>${esc(title)}</h3>
      <p class="chs-goal-dest">ยังไม่มีทิศ</p>
      <p class="chs-hint">ตั้งเป้าที่มุ่งไปในตั้งค่า</p>
      <button type="button" class="chs-goal-set" data-calorie-action="open-settings">ตั้งทิศในตั้งค่า</button>
    </article>`;
  }
  const goal = progress.goal;
  const cur = progress.current;
  const hasCur = cur != null;
  let status;
  let tone = '';
  if (!hasCur) {
    status = `มุ่งไปที่ ${goal} ${unit} · รอค่าปัจจุบัน`;
  } else if (progress.met) {
    status = `ทำได้แล้ว · อยู่ที่ ${cur} ${unit}`;
    tone = 'is-ok';
  } else {
    const rem = formatSigned(progress.remaining, 1).replace(/^\+/, '');
    status = `กำลังมุ่งไป · อีก ${rem} ${unit}`;
    tone = 'is-aiming';
  }
  const barPct = progress.pct == null ? null : progress.pct;
  const barLabel =
    barPct == null ? '' : progress.met ? 'ถึงเป้า' : `ใกล้เป้า ${barPct}%`;
  const bar =
    barPct == null
      ? ''
      : `<div class="chs-goal-bar-wrap">
          <div class="chs-goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${barPct}" aria-label="${esc(barLabel)}"><i style="width:${barPct}%"></i></div>
          <span class="chs-goal-bar-label">${esc(barLabel)}</span>
        </div>`;
  const nowLine = hasCur
    ? `<p class="chs-goal-path"><span class="chs-goal-now">ตอนนี้ ${esc(cur)}</span><span class="chs-goal-arrow" aria-hidden="true">→</span><span class="chs-goal-target">เป้า ${esc(goal)}</span> <span class="chs-chart-unit">${esc(unit)}</span></p>`
    : `<p class="chs-goal-path"><span class="chs-goal-target">เป้า ${esc(goal)}</span> <span class="chs-chart-unit">${esc(unit)}</span><span class="chs-goal-now is-muted"> · ยังไม่มีค่าตอนนี้</span></p>`;
  return `<article class="chs-card chs-goal-card chs-goal-aim ${tone}${primary ? ' is-primary-goal' : ''}">
    <div class="chs-goal-role">${esc(role)}</div>
    <h3>${esc(title)}</h3>
    <p class="chs-goal-dest">${esc(goal)} <span class="chs-chart-unit">${esc(unit)}</span></p>
    ${nowLine}
    <p class="chs-hint chs-goal-status">${esc(status)}${hint ? ` · ${esc(hint)}` : ''}</p>
    ${bar}
  </article>`;
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
        <p class="chs-section-sub">${esc(rangeLabel)} · แตะกล่องเพื่อส่งไปหน้าแรก</p>
      </header>
      <div class="chs-chart-grid">
        ${chartCardHtml('เอว', t.waist, { unit: 'ซม.', digits: 1, pinId: 'chart-waist', labels: t.labels, dates: t.dates })}
        ${chartCardHtml('น้ำหนัก', t.weight, { unit: 'กก.', digits: 1, pinId: 'chart-weight', labels: t.labels, dates: t.dates })}
        ${chartCardHtml('แคล', t.cal, { unit: 'kcal', digits: 0, pinId: 'chart-cal', labels: t.labels, dates: t.dates })}
        ${chartCardHtml('โปรตีน', t.prot, { unit: 'ก.', digits: 1, pinId: 'chart-prot', labels: t.labels, dates: t.dates })}
        ${chartCardHtml('Balance แคล', t.balance, { signed: true, unit: 'kcal', digits: 0, pinId: 'chart-balance', labels: t.labels, dates: t.dates })}
        ${chartCardHtml('น้ำหนักบวกลบ', t.blKg, { signed: true, unit: 'กก.', digits: 2, pinId: 'chart-blKg', labels: t.labels, dates: t.dates })}
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
      <article class="chs-chart-card chs-chart-card-wide is-pinnable" data-pin-id="ex-poses">
        <div class="chs-chart-top">
          <h3>ท่าที่เล่น</h3>
          <p class="chs-chart-last">${esc(ex.poses?.length || 0)}<span class="chs-chart-unit">ท่า</span></p>
        </div>
        ${renderPoseBarsHtml(ex.poses)}
      </article>
      <article class="chs-chart-card chs-chart-card-wide ${musTone} is-pinnable" data-pin-id="ex-mus">
        <div class="chs-chart-top">
          <h3>แคลอรีเบิร์น</h3>
          <p class="chs-chart-last">${esc(musLast ?? '—')}<span class="chs-chart-unit">kcal</span></p>
        </div>
        ${renderSeriesChartSvg(ex.mus || [], {
          className: 'chs-chart-svg is-burn',
          unit: 'kcal',
          digits: 0,
          labels: ex.labels,
          dates: t?.dates,
          yLabel: 'kcal',
          xLabel: 'วัน',
        })}
      </article>
    </section>`
    : '';

  const goalSummary = summarizeBodyGoals(snap.goalWaist, snap.goalWeight);
  const goalWaistHtml = renderGoalCardHtml('เอว', 'ซม.', snap.goalWaist, {
    primary: true,
    hint: 'หัวใจหลัก',
  })
    .replace('class="chs-card chs-goal-card', 'class="chs-card chs-goal-card is-pinnable')
    .replace('<article ', '<article data-pin-id="goal-waist" ');
  const goalWeightHtml = renderGoalCardHtml('น้ำหนัก', 'กก.', snap.goalWeight, {
    primary: false,
    hint: 'กล้ามเนื้อทำให้น้ำหนักขึ้นได้',
  })
    .replace('class="chs-card chs-goal-card', 'class="chs-card chs-goal-card is-pinnable')
    .replace('<article ', '<article data-pin-id="goal-weight" ');
  const goalBlock = `<section class="chs-section chs-goals-section" aria-label="เป้าหมายที่มุ่งไป">
      <header class="chs-section-head">
        <h3 class="chs-section-title">กำลังมุ่งไป</h3>
        <p class="chs-section-sub">${esc(goalSummary)}</p>
      </header>
      <p class="chs-goals-lead">ทิศที่ตั้งใจทำให้ได้ · เอวเป็นหัวใจหลัก · น้ำหนักเป็นเป้าเสริม</p>
      <div class="chs-grid chs-goal-grid">
        ${goalWaistHtml}
        ${goalWeightHtml}
      </div>
    </section>`;

  return `
    <header class="chs-head">
      <h2 class="chs-title">สรุปสุขภาพ</h2>
      <p class="chs-sub">แตะกล่องเพื่อส่งไปหน้าแรก · เลือกช่วงเวลากราฟด้านล่าง</p>
      <div class="chs-range" role="toolbar" aria-label="ช่วงเวลากราฟ">${rangeChips}</div>
    </header>
    ${goalBlock}
    <div class="chs-grid">
      <article class="chs-card is-pinnable" data-pin-id="card-body">
        <h3>ร่างกายล่าสุด</h3>
        <p>สูง <strong>${esc(snap.heightCm ?? '—')}</strong> ซม. · ${esc(sexLabel)} · อายุ <strong>${esc(snap.age ?? '—')}</strong> ปี</p>
        <p>น้ำหนัก <strong>${esc(snap.weight ?? '—')}</strong> กก. · เอว <strong>${esc(waistV)}</strong> ซม.</p>
      </article>
      <article class="chs-card is-pinnable" data-pin-id="card-bmi">
        <h3>BMI</h3>
        <p class="chs-big">${esc(bmiV)}</p>
        <p class="chs-hint">น้ำหนัก ÷ ส่วนสูง²</p>
      </article>
      <article class="chs-card is-pinnable ${levelClass(snap.whtrLevel)}" data-pin-id="card-whtr">
        <h3>WHtR เอว/สูง</h3>
        <p class="chs-big">${esc(whtrV)}</p>
        <p class="chs-hint">${esc(whtrHint)}</p>
      </article>
      <article class="chs-card is-pinnable ${levelClass(snap.waistZone?.level)}" data-pin-id="card-waistZone">
        <h3>โซนรอบเอว</h3>
        <p class="chs-big">${esc(snap.waistZone?.label || '—')}</p>
        <p class="chs-hint">${esc(waistHint)}</p>
      </article>
      <article class="chs-card is-pinnable" data-pin-id="card-ideal">
        <h3>ช่วง กก. แนะนำ</h3>
        <p class="chs-big chs-big-sm">${esc(idealV)}</p>
        <p class="chs-hint">BMI 18.5–24.9 จากส่วนสูง</p>
      </article>
      <article class="chs-card is-pinnable ${weekKgTone}" data-pin-id="card-weekKg">
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
  const rows = sheet.days.map((day) => {
    const metrics = computeDayMetrics(day, sheet);
    const monthKey = monthKeyFromDate(day.date);
    accumulateTotals(all, metrics);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, emptyTotals());
    accumulateTotals(byMonth.get(monthKey), metrics);
    return {
      ...day,
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      metrics,
      dayName: thaiDayName(day.date),
      dayDisplay: dayNumberFromKey(day.date),
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
  const now = nowIso();
  const next = normalizeDayRow(
    { ...dayPartial, updatedAt: dayPartial.updatedAt || now },
    sheet.defaultBase,
  );
  // Stamp per-field edit times for anything with content lacking a stamp.
  next.mealsAt = normalizeMealsAt(next.mealsAt, next.meals, next.updatedAt || now);
  if (hasValue(next.waist) && !next.waistAt) next.waistAt = next.updatedAt || now;
  if (hasValue(next.weight) && !next.weightAt) next.weightAt = next.updatedAt || now;
  if (next.mus != null && !next.musAt) next.musAt = next.updatedAt || now;
  if (String(next.note || '').trim() && !next.noteAt) next.noteAt = next.updatedAt || now;
  const idx = sheet.days.findIndex((d) => d.id === next.id || d.date === next.date);
  const days = [...sheet.days];
  if (idx >= 0) {
    days[idx] = { ...days[idx], ...next, id: days[idx].id };
  } else {
    days.push(next);
  }
  days.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { ...sheet, days, updatedAt: now };
}

export function patchDay(calorie, dayId, patch) {
  const sheet = normalizeCalorie(calorie);
  const now = nowIso();
  const days = sheet.days.map((d) => {
    if (d.id !== dayId) return d;
    const meals = normalizeMeals(patch.meals !== undefined ? patch.meals : d.meals);
    return normalizeDayRow(
      {
        ...d,
        ...patch,
        id: d.id,
        meals,
        mealsAt: stampMealsAt(d, meals, now),
        waistAt: patch.waist !== undefined ? now : (d.waistAt || ''),
        weightAt: patch.weight !== undefined ? now : (d.weightAt || ''),
        musAt: patch.mus !== undefined ? now : (d.musAt || ''),
        noteAt: patch.note !== undefined ? now : (d.noteAt || ''),
        updatedAt: now,
      },
      sheet.defaultBase,
    );
  });
  return { ...sheet, days, updatedAt: now };
}

/**
 * Stamp `now` for meal slots that changed (added, edited, or cleared).
 * Unchanged non-empty slots keep their prior stamp; never-edited empty slots
 * stay unstamped so a blank auto-today shell can't beat real content.
 */
function stampMealsAt(prev, nextMeals, now) {
  const prevAt = Array.isArray(prev?.mealsAt) ? prev.mealsAt : [];
  const prevMeals = Array.isArray(prev?.meals) ? prev.meals : [];
  return nextMeals.map((cell, i) => {
    const cur = String(cell || '').trim();
    const prevCell = String(prevMeals[i] || '').trim();
    if (!cur) {
      // Cleared slot → stamp the clear so it can win over older content.
      return prevCell ? now : '';
    }
    const prevStamp = prevAt[i] || prev?.updatedAt || '';
    if (prevCell === cur && prevStamp) return String(prevStamp).slice(0, 40);
    return now;
  });
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

/**
 * Home pins use their own stamp (homePinsAt) so logging a meal later cannot
 * wipe pins from the other device — and an intentional clear still wins.
 */
function pinStampMs(raw) {
  const t = new Date(raw || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function mergeHomePinsField(local, remote) {
  const lp = normalizeHomePins(local?.homePins);
  const rp = normalizeHomePins(remote?.homePins);
  const lAt = pinStampMs(local?.homePinsAt);
  const rAt = pinStampMs(remote?.homePinsAt);
  if (lAt > rAt) return { homePins: lp, homePinsAt: local.homePinsAt || '' };
  if (rAt > lAt) return { homePins: rp, homePinsAt: remote.homePinsAt || '' };
  // Same stamp / both missing: prefer non-empty, else local.
  if (!lp.length && rp.length) {
    return { homePins: rp, homePinsAt: remote.homePinsAt || local.homePinsAt || '' };
  }
  return { homePins: lp, homePinsAt: local.homePinsAt || remote.homePinsAt || '' };
}

export function mergeCalorieByUpdatedAt(localRaw, remoteRaw) {
  const local = normalizeCalorie(localRaw);
  const remote = normalizeCalorie(remoteRaw);

  // Union days by calendar date, merging each row field-by-field. Meals keep
  // per-slot edit stamps so a same-day edit on one device never wipes the
  // other device's meals/body/note.
  const byDate = new Map();
  [...local.days, ...remote.days].forEach((d) => {
    const key = String(d.date || d.id || '');
    const prev = byDate.get(key);
    byDate.set(key, prev ? mergeDayFields(prev, d) : normalizeDayRow(d));
  });
  const days = [...byDate.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const meta = pickMeta(local, remote);
  const pinField = mergeHomePinsField(local, remote);
  return normalizeCalorie({
    ...meta,
    homePins: pinField.homePins,
    homePinsAt: pinField.homePinsAt,
    days,
    // Max of the two stamps only — never Date.now() (avoids watch-echo loops).
    updatedAt: newerStampIso(local.updatedAt, remote.updatedAt),
  });
}

/** True when a scalar/string field carries a meaningful value. */
function hasValue(v) {
  return v != null && v !== '';
}

/**
 * Merge one scalar field. Newer field-stamp wins (including an intentional
 * clear). On a tie, prefer the non-empty side so content is never dropped.
 * A side only falls back to its day stamp when that side actually has content
 * — a blank auto-today shell must never look "newer" than a filled day.
 */
function mergeScalarField(aVal, bVal, aAt, bAt, aDayAt, bDayAt) {
  const aHas = hasValue(aVal);
  const bHas = hasValue(bVal);
  const aStamp = aAt || (aHas ? aDayAt : '');
  const bStamp = bAt || (bHas ? bDayAt : '');
  const cmp = compareStamp(aStamp, bStamp);
  if (cmp > 0) return aVal;
  if (cmp < 0) return bVal;
  if (aHas) return aVal;
  if (bHas) return bVal;
  return aVal;
}

/** Merge two meal slot arrays slot-by-slot, keeping per-slot edit times. */
function mergeMealsField(a, b) {
  const aMeals = Array.isArray(a?.meals) ? a.meals : [];
  const bMeals = Array.isArray(b?.meals) ? b.meals : [];
  const aAt = Array.isArray(a?.mealsAt) ? a.mealsAt : [];
  const bAt = Array.isArray(b?.mealsAt) ? b.mealsAt : [];
  const len = Math.max(aMeals.length, bMeals.length);
  const meals = [];
  const mealsAt = [];
  for (let i = 0; i < len; i += 1) {
    const ac = String(aMeals[i] || '').trim();
    const bc = String(bMeals[i] || '').trim();
    // Only fall back to the day stamp when that side's slot has content.
    const aStamp = aAt[i] || (ac ? (a?.updatedAt || '') : '');
    const bStamp = bAt[i] || (bc ? (b?.updatedAt || '') : '');
    if (!ac && !bc) { meals.push(''); mealsAt.push(''); continue; }
    const cmp = compareStamp(aStamp, bStamp);
    if (cmp > 0) { meals.push(ac || bc); mealsAt.push(aStamp); }
    else if (cmp < 0) { meals.push(bc || ac); mealsAt.push(bStamp); }
    else { meals.push(ac || bc); mealsAt.push(aStamp || bStamp); }
  }
  const normMeals = normalizeMeals(meals);
  return { meals: normMeals, mealsAt: normalizeMealsAt(mealsAt, normMeals, '') };
}

/** Merge two day rows field-by-field (waist/weight/meals/mus/note independently). */
function mergeDayFields(a, b) {
  const waist = mergeScalarField(a.waist, b.waist, a.waistAt, b.waistAt, a.updatedAt, b.updatedAt);
  const weight = mergeScalarField(a.weight, b.weight, a.weightAt, b.weightAt, a.updatedAt, b.updatedAt);
  const mus = mergeScalarField(a.mus, b.mus, a.musAt, b.musAt, a.updatedAt, b.updatedAt);
  const note = mergeScalarField(a.note, b.note, a.noteAt, b.noteAt, a.updatedAt, b.updatedAt);
  const base = mergeScalarField(a.base, b.base, a.updatedAt, b.updatedAt, a.updatedAt, b.updatedAt);
  const meals = mergeMealsField(a, b);
  return normalizeDayRow({
    id: a.id || b.id,
    date: a.date || b.date,
    waist,
    weight,
    meals: meals.meals,
    mealsAt: meals.mealsAt,
    mus,
    base,
    note,
    waistAt: newerStampIso(a.waistAt, b.waistAt),
    weightAt: newerStampIso(a.weightAt, b.weightAt),
    musAt: newerStampIso(a.musAt, b.musAt),
    noteAt: newerStampIso(a.noteAt, b.noteAt),
    updatedAt: newerStampIso(a.updatedAt, b.updatedAt),
  });
}

/**
 * Pick sheet meta (height/sex/goals/factors) by the newer profile stamp so
 * meal/day edits on the other device can't clobber these choices.
 */
function pickMeta(local, remote) {
  const lAt = new Date(local.profileAt || local.updatedAt || 0).getTime();
  const rAt = new Date(remote.profileAt || remote.updatedAt || 0).getTime();
  if (rAt > lAt) return remote;
  return local;
}

export function formatSigned(n, digits = 0) {
  if (n == null || !Number.isFinite(n)) return '';
  const v = round(n, digits);
  if (v > 0) return `+${v}`;
  return String(v);
}

/** Parentheses for mus / burn column so they read apart from meal-row metrics. */
export function formatBurnMusDisplay(val, { percent = false } = {}) {
  if (val == null || val === '') return '';
  const inner = percent ? `${val}%` : String(val);
  return `(${inner})`;
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

/** Fixed fit-width grid: 9 columns (no #; date shows day-of-month only). */
const CAL_FIT_COLS = 9;

function colCountForMeals(_mealCols) {
  return CAL_FIT_COLS;
}

export function renderCalorieMealHeaderHtml(mealCols = MIN_MEAL_SLOTS) {
  const n = clampNum(mealCols, MIN_MEAL_SLOTS, MAX_MEAL_SLOTS, MIN_MEAL_SLOTS);
  return `<colgroup>
              <col class="cal-cg-date">
              <col class="cal-cg-mealband">
              <col class="cal-cg-mealband">
              <col class="cal-cg-mealband">
              <col class="cal-cg-mealband">
              <col class="cal-cg-mealband">
              <col class="cal-cg-mealband">
              <col class="cal-cg-tail">
              <col class="cal-cg-tail">
            </colgroup>
            <tr class="cal-head-a">
              <th class="cal-col-date" scope="col">วันที่</th>
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
              <th class="cal-col-meals" colspan="5" scope="col" title="${n > 7 ? 'ปัดซ้ายในแถบมื้อเพื่อดูมื้อที่ซ่อน' : ''}">มื้อ 1–${n}${n > 7 ? ' · ปัด→' : ''}</th>
              <th class="cal-col-note" colspan="2" scope="col">หลัก</th>
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
      const isPast = Boolean(row.date && row.date < todayKey);
      const past = isPast ? ' cal-row-past' : '';
      const pastLock = isPast ? ' readonly data-past-lock="1"' : '';
      const pastTitle = isPast ? ' title="วันก่อน · แตะเพื่อปลดล็อกแก้"' : '';
      const cellTitle = isPast ? 'วันก่อน · แตะเพื่อปลดล็อกแก้' : 'แตะเพื่อแก้ / เคลียร์แล้วบันทึก';
      const rawMeals = expandMealsForEdit(row.meals);
      const mealInputs = [];
      for (let i = 0; i < cols; i += 1) {
        const cell = rawMeals[i] || '';
        const has = cell ? ' has-value' : '';
        mealInputs.push(
          `<span class="cal-input-wrap cal-input-wrap-meal${has}"><input class="cal-cell cal-cell-meal" data-cal-field="meal" data-meal-index="${i}" data-day-id="${esc(row.id)}" value="${esc(cell)}" inputmode="numeric" autocomplete="off" spellcheck="false" readonly aria-label="มื้อ ${i + 1}" placeholder="${i + 1}" title="${cellTitle}"></span>`,
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
      return `${sep}<tr class="cal-row cal-day-a${today}${past}" data-day-id="${id}" data-month="${month}" data-date="${esc(row.date)}">
        <td class="cal-col-date">
          <button type="button" class="cal-date-btn" data-cal-date-open="${id}" aria-label="วันที่ ${esc(row.dateDisplay)}" title="${esc(row.dateDisplay)}${isPast ? ' · วันก่อน' : ''}">${esc(row.dayDisplay)}</button>
          <input class="cal-date-picker" type="date" data-cal-field="date" data-day-id="${id}" value="${esc(row.date)}" tabindex="-1" aria-hidden="true"${pastLock}>
        </td>
        <td class="cal-col-day">${esc(row.dayName)}</td>
        <td class="cal-col-body"><input class="cal-cell" data-cal-field="waist" data-day-id="${id}" value="${row.waist ?? ''}" inputmode="decimal" aria-label="รอบเอว"${pastLock}${pastTitle}></td>
        <td class="cal-col-body"><input class="cal-cell" data-cal-field="weight" data-day-id="${id}" value="${row.weight ?? ''}" inputmode="decimal" aria-label="น้ำหนัก"${pastLock}${pastTitle}></td>
        <td class="cal-col-sum cal-col-add cal-derived" data-cal-derived="addCal">${m.addCal ?? ''}</td>
        <td class="cal-col-sum cal-derived" data-cal-derived="prot">${m.prot ?? ''}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.pRm)}" data-cal-derived="pRm">${m.pRm == null ? '' : formatSigned(m.pRm, 1)}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.balance)}" data-cal-derived="balance">${m.balance == null ? '' : formatSigned(m.balance, 0)}</td>
        <td class="cal-col-sum cal-derived ${toneClass(m.blKg)}" data-cal-derived="blKg">${m.blKg == null ? '' : formatSigned(m.blKg, 2)}</td>
      </tr>
      <tr class="cal-row cal-day-b${today}${past}" data-day-id="${id}" data-month="${month}" data-date="${esc(row.date)}">
        <td class="cal-col-burn"><span class="cal-input-wrap${row.mus != null && row.mus !== '' ? ' has-value' : ''}"><input class="cal-cell" data-cal-field="mus" data-day-id="${id}" value="${row.mus ?? ''}" inputmode="numeric" readonly aria-label="ออกกำลัง" title="${cellTitle}"></span></td>
        <td class="cal-col-burn cal-burn-stack" title="BMR · รวมเบิร์น · %bal">
          <span class="cal-derived cal-base-auto" data-cal-derived="base">${formatBurnMusDisplay(m.base)}</span>
          <span class="cal-burn-stack-sub">
            <span class="cal-derived" data-cal-derived="bsum">${formatBurnMusDisplay(m.bsum)}</span>
            <span class="cal-derived ${toneClass(m.pctBl)}" data-cal-derived="pctBl">${formatBurnMusDisplay(m.pctBl, { percent: true })}</span>
          </span>
        </td>
        <td class="cal-col-meals" colspan="5"><div class="cal-meals-fit${cols > 7 ? ' is-scrollable' : ''}" style="--cal-meal-n:${cols}" title="${cols > 7 ? 'ปัดซ้ายเพื่อดูมื้อเพิ่ม' : ''}">${mealInputs.join('')}</div></td>
        <td class="cal-col-note" colspan="2"><input class="cal-cell cal-cell-note" data-cal-field="note" data-day-id="${id}" value="${esc(row.note)}" autocomplete="off" aria-label="หลัก"${pastLock}${pastTitle}></td>
      </tr>`;
    })
    .join('');
}

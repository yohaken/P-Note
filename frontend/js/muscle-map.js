/**
 * Sports-science muscle regions on a front/back body map, a seed exercise library
 * (primary/secondary muscles), per-region recovery defaults and readiness math.
 * Pure data + string rendering; no DOM and no imports from muscle-tree.js.
 */
import { BODY_FRONT, BODY_BACK } from './vendor/body-muscles.js?v=314';

export const MUSCLE_GROUPS = [
  { id: 'chest', name: 'อก' },
  { id: 'shoulders', name: 'ไหล่' },
  { id: 'back', name: 'หลัง' },
  { id: 'arms', name: 'แขน' },
  { id: 'core', name: 'แกนกลาง' },
  { id: 'legs', name: 'ขา' },
];

/** rest = [beginner, trained] days until "ready". parts = body-muscles ids without -left/-right. */
export const MUSCLE_REGIONS = [
  { id: 'chest-upper', name: 'อกบน', sci: 'Pectoralis major (clavicular)', group: 'chest', parts: ['chest-upper'], rest: [3, 2] },
  { id: 'chest-lower', name: 'อกกลาง/ล่าง', sci: 'Pectoralis major (sternal)', group: 'chest', parts: ['chest-lower'], rest: [3, 2] },
  { id: 'serratus', name: 'ซี่โครงข้าง', sci: 'Serratus anterior', group: 'chest', parts: ['serratus-anterior'], rest: [2, 1.5] },
  { id: 'delt-front', name: 'ไหล่หน้า', sci: 'Anterior deltoid', group: 'shoulders', parts: ['shoulder-front'], rest: [2.5, 2] },
  { id: 'delt-side', name: 'ไหล่ข้าง', sci: 'Lateral deltoid', group: 'shoulders', parts: ['shoulder-side'], rest: [2.5, 2] },
  { id: 'delt-rear', name: 'ไหล่หลัง', sci: 'Posterior deltoid', group: 'shoulders', parts: ['deltoid-rear'], rest: [2.5, 2] },
  { id: 'traps-upper', name: 'บ่า', sci: 'Upper trapezius', group: 'shoulders', parts: ['traps-upper'], rest: [2, 1.5] },
  { id: 'neck', name: 'คอ', sci: 'Neck (SCM, splenius)', group: 'shoulders', parts: ['neck', 'nape'], rest: [2, 1] },
  { id: 'lats', name: 'ปีก (หลังกว้าง)', sci: 'Latissimus dorsi', group: 'back', parts: ['lats-upper', 'lats-mid', 'lats-lower'], rest: [3, 2] },
  { id: 'mid-back', name: 'หลังกลาง/สะบัก', sci: 'Middle & lower trapezius, rhomboids', group: 'back', parts: ['traps-mid', 'traps-lower'], rest: [3, 2] },
  { id: 'lower-back', name: 'หลังล่าง', sci: 'Erector spinae, quadratus lumborum', group: 'back', parts: ['lower-back-erectors', 'lower-back-ql', 'spine'], rest: [3, 2] },
  { id: 'biceps', name: 'แขนหน้า (ไบเซป)', sci: 'Biceps brachii, brachialis', group: 'arms', parts: ['biceps'], rest: [3, 2] },
  { id: 'triceps', name: 'แขนหลัง (ไตรเซป)', sci: 'Triceps brachii', group: 'arms', parts: ['triceps-long', 'triceps-lateral'], rest: [3, 2] },
  { id: 'forearms', name: 'แขนท่อนล่าง', sci: 'Forearm flexors & extensors', group: 'arms', parts: ['forearm', 'forearm-flexors', 'forearm-extensors'], rest: [2, 1] },
  { id: 'abs', name: 'หน้าท้อง', sci: 'Rectus abdominis', group: 'core', parts: ['abs-upper', 'abs-lower'], rest: [2, 1] },
  { id: 'obliques', name: 'ท้องข้าง', sci: 'Obliques', group: 'core', parts: ['obliques'], rest: [2, 1] },
  { id: 'hip-flexor', name: 'สะโพกหน้า', sci: 'Iliopsoas (hip flexors)', group: 'core', parts: ['hip-flexor'], rest: [2, 1.5] },
  { id: 'glutes', name: 'ก้น', sci: 'Gluteus maximus', group: 'legs', parts: ['gluteus-maximus'], rest: [3, 2] },
  { id: 'glute-med', name: 'ก้นข้าง', sci: 'Gluteus medius/minimus', group: 'legs', parts: ['gluteus-medius'], rest: [2, 1.5] },
  { id: 'quads', name: 'ต้นขาหน้า', sci: 'Quadriceps', group: 'legs', parts: ['quads'], rest: [3, 2] },
  { id: 'hamstrings', name: 'ต้นขาหลัง', sci: 'Hamstrings', group: 'legs', parts: ['hamstrings-medial', 'hamstrings-lateral'], rest: [3.5, 2.5] },
  { id: 'adductors', name: 'ต้นขาด้านใน', sci: 'Adductors', group: 'legs', parts: ['adductors'], rest: [3, 2] },
  { id: 'calves', name: 'น่อง', sci: 'Gastrocnemius, soleus', group: 'legs', parts: ['calves-gastroc-medial', 'calves-gastroc-lateral', 'calves-soleus'], rest: [2, 1] },
  { id: 'tibialis', name: 'หน้าแข้ง', sci: 'Tibialis anterior', group: 'legs', parts: ['tibialis-anterior'], rest: [2, 1] },
];

const REGION_BY_ID = new Map(MUSCLE_REGIONS.map((r) => [r.id, r]));
const REGION_BY_PART = new Map();
MUSCLE_REGIONS.forEach((r) => r.parts.forEach((p) => REGION_BY_PART.set(p, r.id)));

export function regionById(id) {
  return REGION_BY_ID.get(id) || null;
}

export function groupName(groupId) {
  return MUSCLE_GROUPS.find((g) => g.id === groupId)?.name || '';
}

function partBase(partId) {
  return String(partId || '').replace(/-(left|right)$/, '');
}

export function regionOfPart(partId) {
  return REGION_BY_PART.get(partBase(partId)) || null;
}

export function sanitizeRegionIds(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach((id) => {
    const s = String(id || '').trim();
    if (REGION_BY_ID.has(s) && !out.includes(s)) out.push(s);
  });
  return out;
}

export const EQUIPMENT_TH = { bw: 'ตัวเปล่า', db: 'ดัมเบล', bb: 'บาร์เบล', mc: 'เครื่อง/เคเบิล' };

const ex = (id, name, en, eq, p, s = []) => ({ id, name, en, eq, p, s });

/** Beginner-friendly seed library; muscles follow ExRx-style target/synergist roles. */
export const EXERCISE_LIBRARY = [
  ex('push-up', 'วิดพื้น', 'Push-up', 'bw', ['chest-lower'], ['delt-front', 'triceps', 'abs']),
  ex('bench-press', 'เบนช์เพรส', 'Bench press', 'bb', ['chest-lower'], ['chest-upper', 'delt-front', 'triceps']),
  ex('incline-db-press', 'ดัมเบลเพรสเอียงขึ้น', 'Incline dumbbell press', 'db', ['chest-upper'], ['delt-front', 'triceps']),
  ex('chest-press-machine', 'เครื่องดันอก', 'Machine chest press', 'mc', ['chest-lower'], ['delt-front', 'triceps']),
  ex('cable-fly', 'เคเบิลฟลาย', 'Cable / pec-deck fly', 'mc', ['chest-lower', 'chest-upper'], ['delt-front']),
  ex('dips', 'ดิปบาร์คู่', 'Parallel-bar dip', 'bw', ['chest-lower', 'triceps'], ['delt-front']),

  ex('lat-pulldown', 'ดึงบาร์ลงหน้าอก', 'Lat pulldown', 'mc', ['lats'], ['biceps', 'mid-back', 'delt-rear']),
  ex('pull-up', 'ดึงข้อ', 'Pull-up / chin-up', 'bw', ['lats'], ['biceps', 'mid-back', 'forearms', 'abs']),
  ex('seated-cable-row', 'นั่งดึงเคเบิล', 'Seated cable row', 'mc', ['lats', 'mid-back'], ['delt-rear', 'biceps', 'lower-back']),
  ex('db-row', 'ดัมเบลโรว์แขนเดียว', 'One-arm dumbbell row', 'db', ['lats', 'mid-back'], ['delt-rear', 'biceps', 'forearms']),
  ex('inverted-row', 'ดึงตัวใต้บาร์', 'Inverted row', 'bw', ['mid-back', 'lats'], ['delt-rear', 'biceps', 'abs']),
  ex('back-extension', 'แบ็กเอกซ์เทนชัน', 'Back extension', 'mc', ['lower-back'], ['glutes', 'hamstrings']),
  ex('deadlift', 'เดดลิฟต์', 'Deadlift', 'bb', ['glutes', 'hamstrings', 'lower-back'], ['quads', 'traps-upper', 'lats', 'forearms', 'adductors']),

  ex('overhead-press', 'ดันไหล่เหนือศีรษะ', 'Overhead press', 'db', ['delt-front'], ['delt-side', 'triceps', 'traps-upper']),
  ex('lateral-raise', 'ยกดัมเบลข้างลำตัว', 'Lateral raise', 'db', ['delt-side'], ['traps-upper']),
  ex('rear-delt-fly', 'ฟลายไหล่หลัง', 'Reverse fly', 'db', ['delt-rear'], ['mid-back']),
  ex('face-pull', 'เฟซพูล', 'Face pull', 'mc', ['delt-rear', 'mid-back'], ['traps-upper']),
  ex('shrug', 'ยักไหล่', 'Shrug', 'db', ['traps-upper'], ['forearms']),
  ex('pike-push-up', 'วิดพื้นก้นโด่ง', 'Pike push-up', 'bw', ['delt-front'], ['triceps', 'chest-upper']),

  ex('db-curl', 'ดัมเบลเคิร์ล', 'Dumbbell curl', 'db', ['biceps'], ['forearms']),
  ex('hammer-curl', 'แฮมเมอร์เคิร์ล', 'Hammer curl', 'db', ['biceps', 'forearms']),
  ex('triceps-pushdown', 'เคเบิลกดแขนหลัง', 'Triceps pushdown', 'mc', ['triceps']),
  ex('overhead-triceps-ext', 'เหยียดแขนหลังเหนือศีรษะ', 'Overhead triceps extension', 'db', ['triceps']),
  ex('bench-dip', 'ดิปม้านั่ง', 'Bench dip', 'bw', ['triceps'], ['delt-front', 'chest-lower']),
  ex('close-grip-push-up', 'วิดพื้นมือแคบ', 'Close-grip push-up', 'bw', ['triceps'], ['chest-lower', 'delt-front']),
  ex('wrist-curl', 'เคิร์ลข้อมือ', 'Wrist curl', 'db', ['forearms']),
  ex('farmer-carry', 'เดินถือดัมเบล', "Farmer's carry", 'db', ['forearms', 'traps-upper'], ['abs', 'glutes']),

  ex('plank', 'แพลงก์', 'Plank', 'bw', ['abs'], ['obliques', 'delt-front', 'glutes']),
  ex('crunch', 'ครันช์', 'Crunch', 'bw', ['abs'], ['obliques']),
  ex('leg-raise', 'นอนยกขา', 'Lying leg raise', 'bw', ['abs', 'hip-flexor']),
  ex('hanging-knee-raise', 'ห้อยตัวยกเข่า', 'Hanging knee raise', 'bw', ['abs', 'hip-flexor'], ['obliques', 'forearms']),
  ex('side-plank', 'แพลงก์ข้าง', 'Side plank', 'bw', ['obliques'], ['glute-med', 'abs']),
  ex('russian-twist', 'รัสเซียนทวิสต์', 'Russian twist', 'bw', ['obliques'], ['abs', 'hip-flexor']),

  ex('squat', 'สควอท', 'Squat', 'bb', ['quads', 'glutes'], ['adductors', 'hamstrings', 'lower-back', 'abs']),
  ex('bodyweight-squat', 'สควอทตัวเปล่า', 'Bodyweight squat', 'bw', ['quads', 'glutes'], ['adductors', 'calves']),
  ex('leg-press', 'เครื่องเลกเพรส', 'Leg press', 'mc', ['quads'], ['glutes', 'adductors']),
  ex('lunge', 'ลันจ์', 'Lunge / split squat', 'bw', ['quads', 'glutes'], ['adductors', 'hamstrings', 'glute-med', 'calves']),
  ex('leg-extension', 'เครื่องเหยียดขา', 'Leg extension', 'mc', ['quads']),
  ex('hip-thrust', 'ฮิปทรัสต์', 'Hip thrust / glute bridge', 'bb', ['glutes'], ['hamstrings', 'quads', 'glute-med']),
  ex('romanian-deadlift', 'โรมาเนียนเดดลิฟต์', 'Romanian deadlift', 'db', ['hamstrings', 'glutes'], ['lower-back', 'forearms', 'adductors']),
  ex('leg-curl', 'เครื่องงอขา', 'Leg curl', 'mc', ['hamstrings'], ['calves']),
  ex('glute-kickback', 'เตะขาไปหลัง', 'Glute kickback', 'mc', ['glutes'], ['hamstrings']),
  ex('hip-adduction', 'เครื่องหนีบขา', 'Hip adduction', 'mc', ['adductors']),
  ex('hip-abduction', 'เครื่องกางขา', 'Hip abduction', 'mc', ['glute-med']),
  ex('sumo-squat', 'สควอทขากว้าง', 'Sumo squat', 'db', ['quads', 'adductors', 'glutes'], ['hamstrings']),
  ex('calf-raise', 'เขย่งยืน', 'Standing calf raise', 'bw', ['calves']),
  ex('seated-calf-raise', 'เขย่งนั่ง', 'Seated calf raise', 'mc', ['calves']),
  ex('tibialis-raise', 'ยกปลายเท้า', 'Tibialis raise', 'bw', ['tibialis']),
];

/**
 * Beginner logging layout: 10 big muscle groups (table categories), each seeded with a few
 * popular library moves. Detail stays on the body map via each move's muscles.
 */
export const BEGINNER_GROUPS = [
  { id: 'bg-chest', name: 'อก', regions: ['chest-upper', 'chest-lower', 'serratus'], moves: ['วิดพื้น', 'เบนช์เพรส', 'เครื่องดันอก'] },
  { id: 'bg-back', name: 'หลัง', regions: ['lats', 'mid-back', 'lower-back'], moves: ['ดึงบาร์ลงหน้าอก', 'นั่งดึงเคเบิล', 'ดึงข้อ'] },
  { id: 'bg-shoulders', name: 'ไหล่', regions: ['delt-front', 'delt-side', 'delt-rear', 'traps-upper', 'neck'], moves: ['ดันไหล่เหนือศีรษะ', 'ยกดัมเบลข้างลำตัว', 'ฟลายไหล่หลัง'] },
  { id: 'bg-biceps', name: 'แขนหน้า', regions: ['biceps', 'forearms'], moves: ['ดัมเบลเคิร์ล', 'แฮมเมอร์เคิร์ล'] },
  { id: 'bg-triceps', name: 'แขนหลัง', regions: ['triceps'], moves: ['เคเบิลกดแขนหลัง', 'เหยียดแขนหลังเหนือศีรษะ'] },
  { id: 'bg-abs', name: 'หน้าท้อง', regions: ['abs', 'obliques', 'hip-flexor'], moves: ['แพลงก์', 'ครันช์'] },
  { id: 'bg-glutes', name: 'ก้น', regions: ['glutes', 'glute-med'], moves: ['ฮิปทรัสต์', 'เตะขาไปหลัง'] },
  { id: 'bg-quads', name: 'ต้นขาหน้า', regions: ['quads', 'adductors'], moves: ['สควอท', 'เครื่องเลกเพรส', 'ลันจ์'] },
  { id: 'bg-hamstrings', name: 'ต้นขาหลัง', regions: ['hamstrings'], moves: ['โรมาเนียนเดดลิฟต์', 'เครื่องงอขา'] },
  { id: 'bg-calves', name: 'น่อง', regions: ['calves', 'tibialis'], moves: ['เขย่งยืน'] },
];

/** Beginner group that owns a region (used to file library moves and label regions). */
export function beginnerGroupOfRegion(regionId) {
  return BEGINNER_GROUPS.find((g) => g.regions.includes(regionId)) || null;
}

/** Name for a move that stands in for "trained this group" without a specific exercise. */
export const UNSPECIFIED_MOVE = 'ไม่ระบุท่า';

const LIB_BY_NAME = new Map();
EXERCISE_LIBRARY.forEach((e) => {
  LIB_BY_NAME.set(e.name, e);
  LIB_BY_NAME.set(e.en.toLowerCase(), e);
});

export function libraryExerciseByName(name) {
  const s = String(name || '').trim();
  return LIB_BY_NAME.get(s) || LIB_BY_NAME.get(s.toLowerCase()) || null;
}

/** First match wins, so specific phrases precede broad ones (e.g. หลังขา before หลัง). */
const GUESS_RULES = [
  [/อกบน|upper chest|incline/i, ['chest-upper'], ['delt-front', 'triceps']],
  [/อกล่าง|อกกลาง|lower chest/i, ['chest-lower'], ['delt-front', 'triceps']],
  [/ไหล่\s*·?\s*ข้าง|lateral delt|side delt/i, ['delt-side'], ['traps-upper']],
  [/ไหล่\s*·?\s*หลัง|rear delt/i, ['delt-rear'], ['mid-back']],
  [/ไหล่\s*·?\s*(หน้า|หลัก)|front delt/i, ['delt-front'], ['delt-side', 'triceps']],
  [/หลัง\s*ขา|ขา\s*หลัง|ต้นขาหลัง|hamstring/i, ['hamstrings'], ['glutes']],
  [/หน้า\s*ขา|ขา\s*หน้า|ต้นขาหน้า|quad/i, ['quads'], ['glutes']],
  [/ขาด้านใน|ขาหนีบ|adductor/i, ['adductors']],
  [/ข้าง\s*ขา|ขา\s*ข้าง|ขาด้านนอก|abduct/i, ['glute-med']],
  [/หลังล่าง|lower back/i, ['lower-back'], ['glutes', 'hamstrings']],
  [/แขน\s*หลัง|หลัง\s*แขน|ไตรเซ|tricep/i, ['triceps']],
  [/แขน\s*หน้า|หน้า\s*แขน|ไบเซ|bicep/i, ['biceps'], ['forearms']],
  [/แขนท่อนล่าง|แขนล่าง|ปลายแขน|forearm/i, ['forearms']],
  [/ท้อง\s*ข้าง|ข้าง\s*ท้อง|เอวข้าง|oblique/i, ['obliques'], ['abs']],
  [/ก้น\s*ข้าง|glute med/i, ['glute-med']],
  [/ก้น|glute/i, ['glutes'], ['hamstrings']],
  [/น่อง|calf|calves/i, ['calves']],
  [/หน้าแข้ง|tibialis/i, ['tibialis']],
  [/บ่า|trap|shrug|ยักไหล่/i, ['traps-upper']],
  [/ปีก|\blats?\b/i, ['lats'], ['biceps', 'mid-back']],
  [/อก|chest|pec/i, ['chest-upper', 'chest-lower'], ['delt-front', 'triceps']],
  [/ไหล่|shoulder|delt/i, ['delt-front', 'delt-side'], ['triceps', 'traps-upper']],
  [/ท้อง|\babs?\b|core|แกนกลาง/i, ['abs'], ['obliques']],
  [/หลัง|back/i, ['lats', 'mid-back'], ['biceps', 'delt-rear']],
  [/ขา|leg/i, ['quads', 'hamstrings', 'glutes'], ['adductors']],
  [/แขน|arm/i, ['biceps', 'triceps'], ['forearms']],
];

/** Rules from here on are whole-area fallbacks (อก, ไหล่, หลัง …). */
const GUESS_BROAD_FROM = GUESS_RULES.findIndex(([re]) => re.test('อก'));

function matchGuess(text) {
  const i = text ? GUESS_RULES.findIndex(([re]) => re.test(text)) : -1;
  return i < 0 ? null : { i, p: [...GUESS_RULES[i][1]], s: [...(GUESS_RULES[i][2] || [])] };
}

/** The move name decides; the group name only helps when the move name alone is vague (e.g. แขน › หลัง). */
export function guessMusclesFromName(name, parentName = '') {
  const own = matchGuess(String(name || '').trim());
  const ctx = matchGuess(`${parentName || ''} ${name || ''}`.trim());
  const pick = own && (own.i < GUESS_BROAD_FROM || !ctx || ctx.i >= GUESS_BROAD_FROM) ? own : ctx;
  return pick ? { p: pick.p, s: pick.s } : { p: [], s: [] };
}

/**
 * Muscles hit by a move: explicit node.p/node.s win, then a library name match, then a name guess.
 * @returns {{ p: string[], s: string[], source: 'set'|'library'|'guess'|'' }}
 */
export function resolveMoveMuscles(node, parentName = '') {
  if (!node) return { p: [], s: [], source: '' };
  if (Array.isArray(node.p) || Array.isArray(node.s)) {
    return { p: sanitizeRegionIds(node.p), s: sanitizeRegionIds(node.s), source: 'set' };
  }
  const lib = libraryExerciseByName(node.name);
  if (lib) return { p: [...lib.p], s: [...lib.s], source: 'library' };
  const g = guessMusclesFromName(node.name, parentName);
  return { ...g, source: g.p.length ? 'guess' : '' };
}

export function normalizeRestProfile(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const days = {};
  if (src.days && typeof src.days === 'object') {
    Object.keys(src.days).forEach((id) => {
      if (!REGION_BY_ID.has(id)) return;
      const n = Math.round(Number(src.days[id]) * 2) / 2;
      if (Number.isFinite(n) && n >= 0.5 && n <= 14) days[id] = n;
    });
  }
  return { days };
}

export function defaultRegionRest(regionId) {
  const r = REGION_BY_ID.get(regionId);
  if (!r) return DEFAULT_REST_DAYS;
  return r.rest[0];
}

export function regionRestDays(profile, regionId) {
  const p = normalizeRestProfile(profile);
  return p.days[regionId] ?? defaultRegionRest(regionId);
}

/** Rest days assumed for a move whose muscles are unknown. */
export const DEFAULT_REST_DAYS = 4;

/** Days of rest still needed (0 = recovered). */
export function restRemaining(days, restDays) {
  if (days == null || !(restDays > 0)) return null;
  return Math.max(0, restDays - days);
}

/**
 * Per-region recovery from trained moves: the most recent hit wins (a primary hit
 * beats a secondary one on the same day).
 * @param {{ p: string[], s: string[], days: number|null, last: string }[]} moves
 * @returns {Map<string, { days: number, via: 'p'|'s', last: string, rest: number }>}
 */
export function computeRegionRest(moves, profile) {
  const out = new Map();
  const consider = (id, days, last, via) => {
    const prev = out.get(id);
    if (prev && (prev.days < days || (prev.days === days && (prev.via === 'p' || via === 's')))) return;
    out.set(id, { days, via, last, rest: regionRestDays(profile, id) });
  };
  moves.forEach((m) => {
    if (m.days == null) return;
    m.p.forEach((id) => consider(id, m.days, m.last, 'p'));
    m.s.forEach((id) => consider(id, m.days, m.last, 's'));
  });
  return out;
}

/** Library + custom moves that work a region, primary hits first. */
export function exercisesForRegion(regionId, customMoves = []) {
  const rows = [];
  const seen = new Set();
  const push = (item, role) => {
    const key = item.name;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ ...item, role });
  };
  customMoves.forEach((m) => { if (m.p.includes(regionId)) push(m, 'p'); });
  EXERCISE_LIBRARY.forEach((e) => { if (e.p.includes(regionId)) push(e, 'p'); });
  customMoves.forEach((m) => { if (m.s.includes(regionId)) push(m, 's'); });
  EXERCISE_LIBRARY.forEach((e) => { if (e.s.includes(regionId)) push(e, 's'); });
  return rows;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Inline SVG for one side. paint(regionId) → { cls?: string, style?: string } for muscle parts.
 * @param {'front'|'back'} side
 */
export function renderBodySvg(side, paint = () => ({}), { label = '' } = {}) {
  const parts = side === 'back' ? BODY_BACK : BODY_FRONT;
  const viewBox = side === 'back' ? '37 0 35 93' : '0 0 35 93';
  const paths = parts
    .map(([id, d]) => {
      const region = regionOfPart(id);
      if (!region) return `<path class="bm-part is-body" d="${d}"/>`;
      const p = paint(region) || {};
      const cls = p.cls ? ` ${p.cls}` : '';
      const style = p.style ? ` style="${esc(p.style)}"` : '';
      return `<path class="bm-part is-muscle${cls}"${style} data-region="${region}" d="${d}"><title>${esc(regionById(region)?.name || '')}</title></path>`;
    })
    .join('');
  return `<svg class="bm-svg" viewBox="${viewBox}" role="img" aria-label="${esc(label || (side === 'back' ? 'ด้านหลัง' : 'ด้านหน้า'))}">${paths}</svg>`;
}

/** Front + back pair with captions. */
export function renderBodyPairHtml(paint, { compact = false } = {}) {
  return `<div class="bm-pair${compact ? ' is-compact' : ''}">
    <figure class="bm-side">${renderBodySvg('front', paint)}<figcaption>หน้า</figcaption></figure>
    <figure class="bm-side">${renderBodySvg('back', paint)}<figcaption>หลัง</figcaption></figure>
  </div>`;
}

/** Healthy body-fat % used as the lean reference body. */
export const LEAN_REF_BODY_FAT = { male: 15, female: 23 };

export const BODY_FAT_MODEL_HINT =
  'ร่างลีน = มวลไร้ไขมัน (FFM) เท่าเดิม ที่ไขมันสุขภาพดี (ชาย 15% · หญิง 23%) · '
  + 'น้ำหนักร่างลีน = FFM ÷ (1 − ไขมันอ้างอิง) · '
  + 'ความกว้างเงาส้ม = √(น้ำหนักจริง ÷ น้ำหนักร่างลีน) (ส่วนสูงเท่าเดิม ความกว้างโตตาม √มวล) · '
  + 'ถ้าไม่มี %ไขมัน ประมาณจาก BMI (Deurenberg: 1.2×BMI + 0.23×อายุ − 10.8×ชาย − 5.4)';

/** Deurenberg (1991) adult body-fat % from BMI. */
export function estimateBodyFatDeurenberg(bmi, age, sex) {
  if (!Number.isFinite(bmi) || bmi <= 0 || !Number.isFinite(age)) return null;
  const pct = 1.2 * bmi + 0.23 * age - 10.8 * (sex === 'female' ? 0 : 1) - 5.4;
  return Math.round(Math.min(60, Math.max(3, pct)) * 10) / 10;
}

/**
 * Current body vs a lean reference with the same fat-free mass.
 * @returns {null | { bodyFatPct, estimated, refPct, ffm, fatKg, refWeight, excessKg, sx }}
 * sx = horizontal scale of the current outline vs the lean body (1 = within lean range).
 */
export function bodyFatHaloModel({ weight, bodyFatPct, bmi, age, sex } = {}) {
  if (!Number.isFinite(weight) || weight <= 0) return null;
  let pct = Number.isFinite(bodyFatPct) ? bodyFatPct : null;
  const estimated = pct == null;
  if (estimated) pct = estimateBodyFatDeurenberg(bmi, age, sex);
  if (pct == null) return null;
  const refPct = sex === 'female' ? LEAN_REF_BODY_FAT.female : LEAN_REF_BODY_FAT.male;
  const ffm = weight * (1 - pct / 100);
  const refWeight = ffm / (1 - refPct / 100);
  const excessKg = weight - refWeight;
  const sx = excessKg > 0 ? Math.min(1.45, Math.sqrt(weight / refWeight)) : 1;
  const r1 = (n) => Math.round(n * 10) / 10;
  return {
    bodyFatPct: pct,
    estimated,
    refPct,
    ffm: r1(ffm),
    fatKg: r1(weight - ffm),
    refWeight: r1(refWeight),
    excessKg: r1(excessKg),
    sx: Math.round(sx * 1000) / 1000,
  };
}

function haloGroup(side, sx) {
  const parts = side === 'back' ? BODY_BACK : BODY_FRONT;
  const cx = side === 'back' ? 54.5 : 17.5;
  const d = parts.map(([, p]) => `<path d="${p}"/>`).join('');
  return `<g class="bm-halo" aria-hidden="true" transform="translate(${cx} 0) scale(${sx} 1) translate(${-cx} 0)">${d}</g>`
    + `<g class="bm-halo-base" aria-hidden="true">${d}</g>`;
}

/**
 * Same as renderBodyPairHtml, plus an optional amber halo (current size) scaled
 * horizontally around each view's center axis behind the lean body.
 * @param {{ compact?: boolean, halo?: { sx: number } | null }} opts
 */
export function renderBodyPairHaloHtml(paint, { compact = false, halo = null } = {}) {
  const sx = Number(halo?.sx);
  if (!(sx > 1.001)) return renderBodyPairHtml(paint, { compact });
  const side = (s) => renderBodySvg(s, paint).replace(/^(<svg[^>]*>)/, `$1${haloGroup(s, sx)}`);
  return `<div class="bm-pair has-halo${compact ? ' is-compact' : ''}" style="--bm-halo-sx:${sx}">
    <figure class="bm-side">${side('front')}<figcaption>หน้า</figcaption></figure>
    <figure class="bm-side">${side('back')}<figcaption>หลัง</figcaption></figure>
  </div>`;
}

function fmtStat(v, digits = 1) {
  if (!Number.isFinite(v)) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

/**
 * Tiny chips: height, age, sex, weight, waist, fat%, BMI, fat kg, FFM kg, WHtR.
 * @param {{ heightCm, age, sex, weight, waist, bmi, whtr, model }} s
 */
export function renderBodyStatsHtml(s = {}) {
  const m = s.model;
  const est = m?.estimated ? '~' : '';
  const chip = (label, value, unit = '', title = '') =>
    `<span class="mbc-chip"${title ? ` title="${esc(title)}"` : ''}><span class="mbc-chip-k">${esc(label)}</span><b>${esc(value)}</b>${unit && value !== '—' ? `<span class="mbc-chip-u">${esc(unit)}</span>` : ''}</span>`;
  const sexLabel = s.sex === 'female' ? 'หญิง' : s.sex === 'male' ? 'ชาย' : '—';
  const fatVal = m ? `${est}${fmtStat(m.bodyFatPct)}` : '—';
  return [
    chip('สูง', fmtStat(s.heightCm, 0), 'ซม.'),
    chip('อายุ', fmtStat(s.age, 0), 'ปี'),
    chip('เพศ', sexLabel),
    chip('หนัก', fmtStat(s.weight), 'กก.'),
    chip('เอว', fmtStat(s.waist), 'ซม.'),
    chip('ไขมัน', fatVal, '%', m?.estimated ? 'ประมาณจาก BMI (Deurenberg)' : ''),
    chip('BMI', fmtStat(s.bmi)),
    chip('มวลไขมัน', m ? `${est}${fmtStat(m.fatKg)}` : '—', 'กก.'),
    chip('ไร้ไขมัน', m ? `${est}${fmtStat(m.ffm)}` : '—', 'กก.', 'มวลไร้ไขมัน (FFM/LBM)'),
    chip('เอว/สูง', Number.isFinite(s.whtr) ? s.whtr.toFixed(2) : '—', '', 'WHtR · ควร < 0.5'),
  ].join('');
}

/** One-line caption under the map for the fat halo. */
export function bodyFatHaloCaption(model) {
  if (!model) return 'ยังไม่มีน้ำหนัก — ใส่น้ำหนักในแคลอรี่เพื่อดูเงาไขมัน';
  const pct = `${fmtStat(model.bodyFatPct)}%${model.estimated ? ' (ประมาณ)' : ''}`;
  if (model.excessKg <= 0) return `ไขมัน ${pct} · อยู่ในช่วงร่างลีนแล้ว (≤ ${model.refPct}%)`;
  return `ไขมัน ${pct} · เกินร่างลีน ~${fmtStat(model.excessKg)} กก.`;
}

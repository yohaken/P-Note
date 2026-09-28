/**
 * Sports-science muscle regions on a front/back body map, a seed exercise library
 * (primary/secondary muscles), per-region recovery defaults and readiness math.
 * Pure data + string rendering; no DOM and no imports from muscle-tree.js.
 */
import { BODY_FRONT, BODY_BACK } from './vendor/body-muscles.js?v=310';

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
  [/อกบน|upper chest|incline/i, ['chest-upper']],
  [/อกล่าง|อกกลาง|lower chest/i, ['chest-lower']],
  [/ไหล่\s*·?\s*ข้าง|ไหล่ข้าง|lateral delt|side delt/i, ['delt-side']],
  [/ไหล่\s*·?\s*หลัง|ไหล่หลัง|rear delt/i, ['delt-rear']],
  [/ไหล่\s*·?\s*(หน้า|หลัก)|front delt/i, ['delt-front']],
  [/หลังขา|ต้นขาหลัง|hamstring/i, ['hamstrings']],
  [/หน้าขา|ต้นขาหน้า|quad/i, ['quads']],
  [/ขาด้านใน|ขาหนีบ|adductor/i, ['adductors']],
  [/หลังล่าง|lower back/i, ['lower-back']],
  [/แขนหลัง|ไตรเซ|tricep/i, ['triceps']],
  [/แขนหน้า|ไบเซ|bicep/i, ['biceps']],
  [/แขนท่อนล่าง|แขนล่าง|ปลายแขน|forearm/i, ['forearms']],
  [/ท้องข้าง|oblique/i, ['obliques']],
  [/ก้นข้าง|glute med/i, ['glute-med']],
  [/ก้น|glute/i, ['glutes']],
  [/น่อง|calf|calves/i, ['calves']],
  [/หน้าแข้ง|tibialis/i, ['tibialis']],
  [/บ่า|trap/i, ['traps-upper']],
  [/ปีก|\blats?\b/i, ['lats']],
  [/อก|chest|pec/i, ['chest-upper', 'chest-lower']],
  [/ไหล่|shoulder|delt/i, ['delt-front', 'delt-side']],
  [/ท้อง|\babs?\b|core|แกนกลาง/i, ['abs']],
  [/หลัง|back/i, ['lats', 'mid-back']],
  [/ขา|leg/i, ['quads', 'hamstrings', 'glutes']],
  [/แขน|arm/i, ['biceps', 'triceps']],
];

export function guessMusclesFromName(name, parentName = '') {
  const text = `${parentName || ''} ${name || ''}`.trim();
  if (!text) return { p: [], s: [] };
  for (const [re, p] of GUESS_RULES) {
    if (re.test(text)) return { p: [...p], s: [] };
  }
  return { p: [], s: [] };
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
  const level = src.level === 'trained' ? 'trained' : 'beginner';
  const days = {};
  if (src.days && typeof src.days === 'object') {
    Object.keys(src.days).forEach((id) => {
      if (!REGION_BY_ID.has(id)) return;
      const n = Math.round(Number(src.days[id]) * 2) / 2;
      if (Number.isFinite(n) && n >= 0.5 && n <= 14) days[id] = n;
    });
  }
  return { level, days };
}

export function defaultRegionRest(regionId, level = 'beginner') {
  const r = REGION_BY_ID.get(regionId);
  if (!r) return REST_READY_SLOT;
  return r.rest[level === 'trained' ? 1 : 0];
}

export function regionRestDays(profile, regionId) {
  const p = normalizeRestProfile(profile);
  return p.days[regionId] ?? defaultRegionRest(regionId, p.level);
}

/**
 * Rest-scale slot that means "fully recovered". A muscle that needs R days reaches this
 * slot after R days, so the user's labels stay meaningful for fast and slow muscles alike.
 */
export const REST_READY_SLOT = 4;

export function readinessSlot(days, restDays) {
  if (days == null || !(restDays > 0)) return null;
  return (days * REST_READY_SLOT) / restDays;
}

/**
 * Per-region recovery from trained moves. Secondary hits count as half a session:
 * they start the muscle half-way through its rest period.
 * @param {{ p: string[], s: string[], days: number|null, last: string }[]} moves
 * @returns {Map<string, { days: number, slot: number, via: 'p'|'s', last: string, rest: number }>}
 */
export function computeRegionRest(moves, profile) {
  const out = new Map();
  const consider = (id, days, last, via) => {
    const rest = regionRestDays(profile, id);
    const eff = via === 's' ? days + rest / 2 : days;
    const slot = readinessSlot(eff, rest);
    const prev = out.get(id);
    if (!prev || slot < prev.slot) out.set(id, { days, slot, via, last, rest });
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

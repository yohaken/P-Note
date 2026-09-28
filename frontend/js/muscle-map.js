/**
 * Sports-science muscle regions on a front/back body map, a seed exercise library
 * (primary/secondary muscles), per-region recovery defaults and readiness math.
 * Pure data + string rendering; no DOM and no imports from muscle-tree.js.
 */
import { BODY_FRONT, BODY_BACK } from './vendor/body-muscles.js?v=320';
import { EXERCISE_DB, LIBRARY_IMAGE_IDS, exerciseImageUrls } from './exercise-db.js?v=320';

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

export const EQUIPMENT_TH = {
  bw: 'ตัวเปล่า',
  db: 'ดัมเบล',
  bb: 'บาร์เบล',
  kb: 'เคตเทิลเบล',
  band: 'ยางยืด',
  cable: 'เคเบิล',
  machine: 'เครื่อง',
  mc: 'เครื่อง/เคเบิล',
  other: 'อื่นๆ',
};

/** aka = older/alternate names (Thai or English) that must still resolve to this move. */
const ex = (id, name, en, eq, p, s = [], aka = []) => ({ id, name, en, eq, p, s, aka });

/** Beginner-friendly seed library; muscles follow ExRx-style target/synergist roles. */
export const EXERCISE_LIBRARY = [
  ex('push-up', 'วิดพื้น', 'Push-up', 'bw', ['chest-lower'], ['chest-upper', 'delt-front', 'triceps', 'serratus', 'abs']),
  ex('knee-push-up', 'วิดพื้นคุกเข่า', 'Knee push-up', 'bw', ['chest-lower'], ['chest-upper', 'delt-front', 'triceps']),
  ex('incline-push-up', 'วิดพื้นมือวางสูง', 'Incline push-up', 'bw', ['chest-lower'], ['delt-front', 'triceps', 'serratus']),
  ex('decline-push-up', 'วิดพื้นเท้าวางสูง', 'Decline push-up', 'bw', ['chest-upper'], ['chest-lower', 'delt-front', 'triceps']),
  ex('bench-press', 'เบนช์เพรส', 'Bench press', 'bb', ['chest-lower'], ['chest-upper', 'delt-front', 'triceps']),
  ex('incline-bench', 'เบนช์เพรสเอียงขึ้น', 'Incline bench press', 'bb', ['chest-upper'], ['delt-front', 'triceps', 'chest-lower']),
  ex('decline-bench', 'เบนช์เพรสเอียงลง', 'Decline bench press', 'bb', ['chest-lower'], ['triceps', 'delt-front']),
  ex('flat-db-press', 'ดัมเบลเพรสม้าราบ', 'Flat dumbbell press', 'db', ['chest-lower'], ['chest-upper', 'delt-front', 'triceps']),
  ex('incline-db-press', 'ดัมเบลเพรสเอียงขึ้น', 'Incline dumbbell press', 'db', ['chest-upper'], ['delt-front', 'triceps']),
  ex('smith-bench', 'สมิธเบนช์เพรส', 'Smith machine bench press', 'machine', ['chest-lower'], ['chest-upper', 'delt-front', 'triceps']),
  ex('smith-incline', 'สมิธเพรสเอียงขึ้น', 'Smith machine incline press', 'machine', ['chest-upper'], ['delt-front', 'triceps', 'chest-lower']),
  ex('chest-press-machine', 'เครื่องดันอก', 'Machine chest press', 'machine', ['chest-lower'], ['chest-upper', 'delt-front', 'triceps']),
  ex('incline-chest-machine', 'เครื่องดันอกเอียงขึ้น', 'Incline machine chest press', 'machine', ['chest-upper'], ['delt-front', 'triceps']),
  ex('flat-db-fly', 'ดัมเบลฟลายม้าราบ', 'Flat dumbbell fly', 'db', ['chest-lower'], ['chest-upper', 'delt-front']),
  ex('incline-db-fly', 'ดัมเบลฟลายเอียงขึ้น', 'Incline dumbbell fly', 'db', ['chest-upper'], ['chest-lower', 'delt-front']),
  ex('pec-deck', 'เครื่องบีบอก', 'Seated pec fly / pec deck', 'machine', ['chest-lower'], ['chest-upper', 'delt-front']),
  ex('cable-fly', 'เคเบิลฟลาย', 'Cable fly', 'cable', ['chest-lower'], ['chest-upper', 'delt-front'], ['Cable / pec-deck fly']),
  ex('cable-fly-low-high', 'เคเบิลฟลายล่างขึ้นบน', 'Low-to-high cable fly', 'cable', ['chest-upper'], ['chest-lower', 'delt-front']),
  ex('cable-crossover', 'เคเบิลครอสโอเวอร์', 'Cable crossover', 'cable', ['chest-lower'], ['chest-upper', 'delt-front']),
  ex('db-pullover', 'ดัมเบลพูลโอเวอร์', 'Dumbbell pullover', 'db', ['chest-lower'], ['lats', 'triceps', 'serratus']),
  ex('dips', 'ดิปบาร์คู่', 'Chest dip', 'bw', ['chest-lower'], ['triceps', 'delt-front', 'chest-upper'], ['ดิปอก', 'Parallel-bar dip']),

  ex('lat-pulldown', 'ดึงบาร์ลงหน้าอก', 'Lat pulldown', 'cable', ['lats'], ['biceps', 'mid-back', 'delt-rear', 'forearms']),
  ex('wide-pulldown', 'ดึงบาร์ลงมือกว้าง', 'Wide-grip lat pulldown', 'cable', ['lats'], ['mid-back', 'delt-rear', 'biceps']),
  ex('close-pulldown', 'ดึงบาร์ลงมือแคบ (V-bar)', 'Close-grip lat pulldown', 'cable', ['lats'], ['biceps', 'mid-back', 'forearms']),
  ex('reverse-pulldown', 'ดึงบาร์ลงมือหงาย', 'Reverse-grip lat pulldown', 'cable', ['lats'], ['biceps', 'mid-back']),
  ex('pull-up', 'ดึงข้อ', 'Pull-up', 'bw', ['lats'], ['biceps', 'mid-back', 'forearms'], ['Pull-up / chin-up']),
  ex('chin-up', 'ดึงข้อมือหงาย', 'Chin-up', 'bw', ['lats'], ['biceps', 'mid-back', 'forearms']),
  ex('assisted-pull-up', 'เครื่องช่วยดึงข้อ', 'Assisted pull-up', 'machine', ['lats'], ['biceps', 'mid-back', 'delt-rear']),
  ex('straight-arm-pulldown', 'เคเบิลกดแขนตรง', 'Straight-arm pulldown', 'cable', ['lats'], ['triceps', 'delt-rear']),
  ex('high-row-machine', 'เครื่องไฮโรว์', 'Machine high row', 'machine', ['lats'], ['mid-back', 'delt-rear', 'biceps']),
  ex('pullover-machine', 'เครื่องพูลโอเวอร์', 'Machine pullover', 'machine', ['lats'], ['chest-lower', 'triceps']),
  ex('seated-cable-row', 'นั่งดึงเคเบิล', 'Seated cable row', 'cable', ['lats', 'mid-back'], ['delt-rear', 'biceps', 'forearms']),
  ex('wide-cable-row', 'นั่งดึงเคเบิลมือกว้าง', 'Wide-grip seated cable row', 'cable', ['mid-back'], ['lats', 'delt-rear', 'biceps']),
  ex('db-row', 'ดัมเบลโรว์แขนเดียว', 'One-arm dumbbell row', 'db', ['lats', 'mid-back'], ['delt-rear', 'biceps', 'forearms']),
  ex('incline-db-row', 'ดัมเบลโรว์นอนคว่ำม้าเอียง', 'Chest-supported dumbbell row', 'db', ['mid-back'], ['lats', 'delt-rear', 'biceps']),
  ex('bb-row', 'บาร์เบลโรว์', 'Barbell row', 'bb', ['mid-back', 'lats'], ['delt-rear', 'biceps', 'lower-back', 'forearms']),
  ex('t-bar-row', 'ทีบาร์โรว์', 'T-bar row', 'bb', ['mid-back', 'lats'], ['delt-rear', 'biceps', 'lower-back']),
  ex('machine-row', 'เครื่องโรว์อกพิง', 'Chest-supported machine row', 'machine', ['mid-back', 'lats'], ['delt-rear', 'biceps']),
  ex('inverted-row', 'ดึงตัวใต้บาร์', 'Inverted row', 'bw', ['mid-back', 'lats'], ['delt-rear', 'biceps']),
  ex('back-extension', 'แบ็กเอกซ์เทนชัน', 'Back extension', 'bw', ['lower-back'], ['glutes', 'hamstrings', 'adductors']),
  ex('superman', 'ซูเปอร์แมน', 'Superman', 'bw', ['lower-back'], ['glutes', 'hamstrings']),
  ex('bird-dog', 'เบิร์ดด็อก', 'Bird dog', 'bw', ['lower-back'], ['glutes', 'abs']),
  ex('deadlift', 'เดดลิฟต์', 'Deadlift', 'bb', ['glutes', 'hamstrings', 'lower-back'], ['quads', 'traps-upper', 'lats', 'forearms', 'adductors']),
  ex('rack-pull', 'แร็กพูล', 'Rack pull', 'bb', ['lower-back', 'glutes'], ['hamstrings', 'traps-upper', 'forearms']),

  ex('overhead-press', 'ดันไหล่เหนือศีรษะ', 'Overhead press', 'db', ['delt-front'], ['delt-side', 'triceps', 'traps-upper', 'chest-upper', 'serratus']),
  ex('bb-ohp', 'บาร์เบลดันไหล่ยืน', 'Standing barbell overhead press', 'bb', ['delt-front'], ['delt-side', 'triceps', 'chest-upper', 'traps-upper']),
  ex('shoulder-press-machine', 'เครื่องดันไหล่', 'Machine shoulder press', 'machine', ['delt-front'], ['delt-side', 'triceps']),
  ex('smith-shoulder-press', 'สมิธดันไหล่', 'Smith machine shoulder press', 'machine', ['delt-front'], ['delt-side', 'triceps']),
  ex('arnold-press', 'อาร์โนลด์เพรส', 'Arnold press', 'db', ['delt-front'], ['delt-side', 'triceps', 'chest-upper']),
  ex('landmine-press', 'แลนด์ไมน์เพรส', 'Landmine press', 'bb', ['delt-front'], ['chest-upper', 'triceps', 'serratus']),
  ex('front-raise', 'ยกดัมเบลด้านหน้า', 'Front raise', 'db', ['delt-front'], ['chest-upper', 'delt-side', 'serratus']),
  ex('lateral-raise', 'ยกดัมเบลข้างลำตัว', 'Lateral raise', 'db', ['delt-side'], ['traps-upper', 'delt-front']),
  ex('cable-lateral-raise', 'เคเบิลยกไหล่ข้าง', 'Cable lateral raise', 'cable', ['delt-side'], ['delt-front', 'traps-upper']),
  ex('lateral-raise-machine', 'เครื่องยกไหล่ข้าง', 'Machine lateral raise', 'machine', ['delt-side'], ['delt-front', 'traps-upper']),
  ex('upright-row', 'อัพไรท์โรว์', 'Upright row', 'bb', ['delt-side'], ['traps-upper', 'delt-front', 'biceps']),
  ex('rear-delt-fly', 'ฟลายไหล่หลัง', 'Reverse fly', 'db', ['delt-rear'], ['mid-back', 'delt-side']),
  ex('reverse-pec-deck', 'เครื่องฟลายไหล่หลัง', 'Reverse pec deck', 'machine', ['delt-rear'], ['mid-back', 'delt-side']),
  ex('face-pull', 'เฟซพูล', 'Face pull', 'cable', ['delt-rear', 'mid-back'], ['traps-upper']),
  ex('band-pull-apart', 'ยางยืดดึงแยก', 'Band pull-apart', 'band', ['delt-rear'], ['mid-back']),
  ex('shrug', 'ยักไหล่', 'Shrug', 'db', ['traps-upper'], ['forearms']),
  ex('bb-shrug', 'ยักไหล่บาร์เบล/สมิธ', 'Barbell / Smith shrug', 'bb', ['traps-upper'], ['forearms']),
  ex('pike-push-up', 'วิดพื้นก้นโด่ง', 'Pike push-up', 'bw', ['delt-front'], ['triceps', 'chest-upper']),

  ex('db-curl', 'ดัมเบลเคิร์ล', 'Dumbbell curl', 'db', ['biceps'], ['forearms']),
  ex('bb-curl', 'บาร์เบล/EZ เคิร์ล', 'Barbell / EZ-bar curl', 'bb', ['biceps'], ['forearms']),
  ex('preacher-curl', 'พรีชเชอร์เคิร์ล', 'Preacher curl', 'machine', ['biceps'], ['forearms']),
  ex('cable-curl', 'เคเบิลเคิร์ล', 'Cable curl', 'cable', ['biceps'], ['forearms']),
  ex('incline-db-curl', 'ดัมเบลเคิร์ลม้าเอียง', 'Incline dumbbell curl', 'db', ['biceps'], ['forearms']),
  ex('concentration-curl', 'คอนเซนเทรชันเคิร์ล', 'Concentration curl', 'db', ['biceps']),
  ex('hammer-curl', 'แฮมเมอร์เคิร์ล', 'Hammer curl', 'db', ['biceps', 'forearms']),
  ex('reverse-curl', 'รีเวิร์สเคิร์ล', 'Reverse curl', 'bb', ['forearms'], ['biceps']),
  ex('triceps-pushdown', 'เคเบิลกดแขนหลัง', 'Triceps pushdown', 'cable', ['triceps']),
  ex('rope-pushdown', 'เคเบิลกดเชือก', 'Rope pushdown', 'cable', ['triceps']),
  ex('overhead-triceps-ext', 'เหยียดแขนหลังเหนือศีรษะ', 'Overhead triceps extension', 'db', ['triceps']),
  ex('overhead-cable-ext', 'เคเบิลเหยียดแขนเหนือศีรษะ', 'Overhead cable triceps extension', 'cable', ['triceps']),
  ex('skull-crusher', 'สกัลครัชเชอร์', 'Skull crusher', 'bb', ['triceps']),
  ex('db-kickback', 'ดัมเบลคิกแบ็ก', 'Dumbbell triceps kickback', 'db', ['triceps']),
  ex('close-grip-bench', 'เบนช์เพรสมือแคบ', 'Close-grip bench press', 'bb', ['triceps'], ['chest-lower', 'chest-upper', 'delt-front']),
  ex('triceps-dip', 'ดิปแขนหลัง', 'Triceps dip', 'bw', ['triceps'], ['chest-lower', 'delt-front']),
  ex('assisted-dip', 'เครื่องช่วยดิป/ดิปนั่ง', 'Assisted / seated dip machine', 'machine', ['triceps'], ['chest-lower', 'delt-front']),
  ex('bench-dip', 'ดิปม้านั่ง', 'Bench dip', 'bw', ['triceps'], ['delt-front', 'chest-lower', 'chest-upper']),
  ex('close-grip-push-up', 'วิดพื้นมือแคบ', 'Close-grip push-up', 'bw', ['triceps'], ['chest-lower', 'delt-front', 'chest-upper']),
  ex('wrist-curl', 'เคิร์ลข้อมือ', 'Wrist curl', 'db', ['forearms']),
  ex('reverse-wrist-curl', 'เคิร์ลข้อมือคว่ำ', 'Reverse wrist curl', 'db', ['forearms']),
  ex('farmer-carry', 'เดินถือดัมเบล', "Farmer's carry", 'db', ['forearms', 'traps-upper'], ['obliques', 'glute-med']),

  ex('plank', 'แพลงก์', 'Plank', 'bw', ['abs'], ['obliques', 'delt-front', 'glutes']),
  ex('crunch', 'ครันช์', 'Crunch', 'bw', ['abs'], ['obliques']),
  ex('sit-up', 'ซิทอัพ', 'Sit-up', 'bw', ['abs'], ['hip-flexor', 'obliques']),
  ex('reverse-crunch', 'รีเวิร์สครันช์', 'Reverse crunch', 'bw', ['abs'], ['obliques', 'hip-flexor']),
  ex('bicycle-crunch', 'ครันช์ปั่นจักรยาน', 'Bicycle crunch', 'bw', ['abs', 'obliques'], ['hip-flexor']),
  ex('cable-crunch', 'เคเบิลครันช์', 'Cable crunch', 'cable', ['abs'], ['obliques']),
  ex('ab-machine', 'เครื่องครันช์', 'Ab crunch machine', 'machine', ['abs'], ['obliques']),
  ex('ab-wheel', 'ล้อบริหารหน้าท้อง', 'Ab wheel rollout', 'bw', ['abs'], ['obliques', 'lats', 'hip-flexor']),
  ex('dead-bug', 'เดดบัก', 'Dead bug', 'bw', ['abs'], ['obliques', 'hip-flexor']),
  ex('mountain-climber', 'เมาน์เทนไคลม์เบอร์', 'Mountain climber', 'bw', ['abs'], ['hip-flexor', 'delt-front', 'quads']),
  ex('leg-raise', 'นอนยกขา', 'Lying leg raise', 'bw', ['hip-flexor'], ['abs', 'obliques']),
  ex('hanging-knee-raise', 'ห้อยตัวยกเข่า', 'Hanging knee raise', 'bw', ['abs', 'hip-flexor'], ['obliques', 'forearms']),
  ex('hanging-leg-raise', 'ห้อยตัวยกขาตรง', 'Hanging leg raise', 'bw', ['hip-flexor', 'abs'], ['obliques', 'forearms']),
  ex('captains-chair', 'กัปตันแชร์ยกเข่า', "Captain's chair knee raise", 'machine', ['abs', 'hip-flexor'], ['obliques']),
  ex('side-plank', 'แพลงก์ข้าง', 'Side plank', 'bw', ['obliques'], ['glute-med', 'abs']),
  ex('russian-twist', 'รัสเซียนทวิสต์', 'Russian twist', 'bw', ['obliques'], ['abs', 'hip-flexor']),
  ex('oblique-crunch', 'ครันช์ข้าง', 'Oblique crunch', 'bw', ['obliques'], ['abs']),
  ex('cable-woodchop', 'เคเบิลวู้ดช็อป', 'Cable woodchop', 'cable', ['obliques'], ['abs']),
  ex('rotary-torso', 'เครื่องบิดลำตัว', 'Rotary torso machine', 'machine', ['obliques'], ['abs']),
  ex('pallof-press', 'พาลอฟเพรส', 'Pallof press', 'cable', ['obliques'], ['abs']),
  ex('db-side-bend', 'ดัมเบลเอียงข้าง', 'Dumbbell side bend', 'db', ['obliques'], ['lower-back']),

  ex('squat', 'สควอท', 'Squat', 'bb', ['quads', 'glutes'], ['adductors', 'lower-back', 'abs']),
  ex('front-squat', 'ฟรอนต์สควอท', 'Front squat', 'bb', ['quads'], ['glutes', 'adductors', 'abs']),
  ex('smith-squat', 'สมิธสควอท', 'Smith machine squat', 'machine', ['quads', 'glutes'], ['adductors']),
  ex('hack-squat', 'แฮกสควอท', 'Hack squat', 'machine', ['quads'], ['glutes', 'adductors']),
  ex('goblet-squat', 'กอบเล็ตสควอท', 'Goblet squat', 'kb', ['quads', 'glutes'], ['adductors', 'abs']),
  ex('bodyweight-squat', 'สควอทตัวเปล่า', 'Bodyweight squat', 'bw', ['quads', 'glutes'], ['adductors']),
  ex('wall-sit', 'นั่งพิงกำแพง', 'Wall sit', 'bw', ['quads'], ['glutes']),
  ex('leg-press', 'เครื่องเลกเพรส', 'Leg press', 'machine', ['quads'], ['glutes', 'adductors']),
  ex('lunge', 'ลันจ์', 'Lunge / split squat', 'bw', ['quads', 'glutes'], ['adductors', 'glute-med', 'calves']),
  ex('reverse-lunge', 'ลันจ์ถอยหลัง', 'Reverse lunge', 'db', ['glutes', 'quads'], ['adductors', 'glute-med']),
  ex('bulgarian-split-squat', 'บัลแกเรียนสปลิทสควอท', 'Bulgarian split squat', 'db', ['quads', 'glutes'], ['adductors', 'glute-med']),
  ex('step-up', 'สเต็ปอัพ', 'Step-up', 'db', ['quads', 'glutes'], ['glute-med', 'adductors']),
  ex('leg-extension', 'เครื่องเหยียดขา', 'Leg extension', 'machine', ['quads']),
  ex('hip-thrust', 'ฮิปทรัสต์', 'Hip thrust / glute bridge', 'bb', ['glutes'], ['hamstrings', 'quads', 'glute-med', 'adductors']),
  ex('hip-thrust-machine', 'เครื่องฮิปทรัสต์', 'Hip thrust machine', 'machine', ['glutes'], ['hamstrings', 'adductors']),
  ex('glute-bridge', 'กลูทบริดจ์', 'Glute bridge', 'bw', ['glutes'], ['hamstrings', 'adductors']),
  ex('romanian-deadlift', 'โรมาเนียนเดดลิฟต์', 'Romanian deadlift', 'db', ['hamstrings', 'glutes'], ['lower-back', 'forearms', 'adductors']),
  ex('stiff-leg-deadlift', 'สติฟเลกเดดลิฟต์', 'Stiff-leg deadlift', 'bb', ['hamstrings'], ['glutes', 'lower-back', 'adductors']),
  ex('single-leg-rdl', 'เดดลิฟต์ขาเดียว', 'Single-leg Romanian deadlift', 'db', ['hamstrings', 'glutes'], ['glute-med', 'lower-back']),
  ex('sumo-deadlift', 'ซูโม่เดดลิฟต์', 'Sumo deadlift', 'bb', ['glutes', 'quads', 'adductors'], ['hamstrings', 'lower-back', 'traps-upper', 'forearms']),
  ex('good-morning', 'กู๊ดมอร์นิ่ง', 'Good morning', 'bb', ['hamstrings'], ['glutes', 'lower-back', 'adductors']),
  ex('kb-swing', 'เคตเทิลเบลสวิง', 'Kettlebell swing', 'kb', ['glutes', 'hamstrings'], ['lower-back', 'forearms', 'abs']),
  ex('leg-curl', 'เครื่องงอขา', 'Leg curl', 'machine', ['hamstrings'], ['calves']),
  ex('seated-leg-curl', 'เครื่องงอขานั่ง', 'Seated leg curl', 'machine', ['hamstrings'], ['calves']),
  ex('lying-leg-curl', 'เครื่องงอขานอนคว่ำ', 'Lying leg curl', 'machine', ['hamstrings'], ['calves']),
  ex('nordic-curl', 'นอร์ดิกเคิร์ล', 'Nordic hamstring curl', 'bw', ['hamstrings'], ['calves']),
  ex('glute-kickback', 'เตะขาไปหลัง', 'Cable glute kickback', 'cable', ['glutes'], ['hamstrings'], ['เคเบิลเตะขาไปหลัง', 'Glute kickback']),
  ex('machine-kickback-glute', 'เครื่องเตะขาไปหลัง', 'Glute kickback machine', 'machine', ['glutes'], ['hamstrings']),
  ex('donkey-kick', 'เตะขาท่าคลาน', 'Donkey kick', 'bw', ['glutes'], ['hamstrings']),
  ex('hip-adduction', 'เครื่องหนีบขา', 'Hip adduction', 'machine', ['adductors']),
  ex('copenhagen', 'โคเปนเฮเกนแพลงก์', 'Copenhagen plank', 'bw', ['adductors'], ['obliques']),
  ex('hip-abduction', 'เครื่องกางขา', 'Hip abduction', 'machine', ['glute-med'], ['glutes']),
  ex('cable-abduction', 'เคเบิลกางขา', 'Cable hip abduction', 'cable', ['glute-med'], ['glutes']),
  ex('lateral-band-walk', 'เดินข้างยางยืด', 'Lateral band walk', 'band', ['glute-med'], ['glutes']),
  ex('clamshell', 'แคลมเชลล์', 'Clamshell', 'band', ['glute-med'], ['glutes']),
  ex('sumo-squat', 'สควอทขากว้าง', 'Sumo squat', 'db', ['quads', 'adductors', 'glutes'], ['hamstrings']),
  ex('calf-raise', 'เขย่งยืน', 'Standing calf raise', 'bw', ['calves']),
  ex('single-leg-calf', 'เขย่งขาเดียว', 'Single-leg calf raise', 'db', ['calves']),
  ex('calf-machine', 'เครื่องเขย่งยืน/สมิธ', 'Standing calf raise machine / Smith', 'machine', ['calves']),
  ex('leg-press-calf', 'เขย่งบนเครื่องเลกเพรส', 'Leg press calf raise', 'machine', ['calves']),
  ex('seated-calf-raise', 'เขย่งนั่ง', 'Seated calf raise', 'machine', ['calves']),
  ex('tibialis-raise', 'ยกปลายเท้า', 'Tibialis raise', 'bw', ['tibialis']),
];

/**
 * Beginner logging layout: 10 big muscle groups (table categories), each seeded with a few
 * popular library moves. Detail stays on the body map via each move's muscles.
 */
export const BEGINNER_GROUPS = [
  { id: 'bg-chest', name: 'อก', regions: ['chest-upper', 'chest-lower', 'serratus'], moves: ['วิดพื้น', 'เบนช์เพรส', 'เครื่องดันอก'] },
  { id: 'bg-back', name: 'หลัง', regions: ['lats', 'mid-back', 'lower-back', 'traps-upper', 'neck'], moves: ['ดึงบาร์ลงหน้าอก', 'นั่งดึงเคเบิล', 'ดึงข้อ'] },
  { id: 'bg-shoulders', name: 'ไหล่', regions: ['delt-front', 'delt-side', 'delt-rear'], moves: ['ดันไหล่เหนือศีรษะ', 'ยกดัมเบลข้างลำตัว', 'ฟลายไหล่หลัง'] },
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

const libNameKey = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();

EXERCISE_LIBRARY.forEach((e) => {
  e.img = LIBRARY_IMAGE_IDS[e.id] || '';
});

const LIB_BY_NAME = new Map();
EXERCISE_LIBRARY.forEach((e) => {
  [e.name, e.en, ...e.aka].forEach((n) => {
    const k = libNameKey(n);
    if (k && !LIB_BY_NAME.has(k)) LIB_BY_NAME.set(k, e);
  });
});

/** Photo database moves not already in the curated library (cardio stays on the wheel). */
export const EXTRA_EXERCISES = (() => {
  const curated = new Set(Object.values(LIBRARY_IMAGE_IDS));
  const byDbId = new Map(EXERCISE_DB.map((d) => [d.id, d]));
  EXERCISE_LIBRARY.forEach((e) => {
    const k = e.img && libNameKey(byDbId.get(e.img)?.en);
    if (k && !LIB_BY_NAME.has(k)) LIB_BY_NAME.set(k, e);
  });
  const out = [];
  EXERCISE_DB.forEach((d) => {
    if (curated.has(d.id) || d.cat === 'cardio' || !d.p.length) return;
    const name = LIB_BY_NAME.has(libNameKey(d.th)) ? d.en : d.th;
    if (LIB_BY_NAME.has(libNameKey(name))) return;
    const e = { id: `db-${d.id}`, name, en: d.en, eq: d.eq, p: [...d.p], s: d.s.filter((x) => !d.p.includes(x)), aka: [], img: d.id, extra: true };
    LIB_BY_NAME.set(libNameKey(name), e);
    if (!LIB_BY_NAME.has(libNameKey(d.en))) LIB_BY_NAME.set(libNameKey(d.en), e);
    out.push(e);
  });
  return out;
})();

/** Curated moves first, then the photo database. */
export const ALL_EXERCISES = [...EXERCISE_LIBRARY, ...EXTRA_EXERCISES];

/** Start/end photo URLs for a move ([] when it has no photo). */
export function exerciseImages(e) {
  return e?.img ? exerciseImageUrls(e.img) : [];
}

export function libraryExerciseByName(name) {
  return LIB_BY_NAME.get(libNameKey(name)) || null;
}

/** First match wins, so specific phrases precede broad ones (e.g. หลังขา before หลัง). */
const GUESS_RULES = [
  [/(leg|hamstring)\s*curl|nordic|งอขา/i, ['hamstrings']],
  [/leg\s*extension|เหยียดขา/i, ['quads']],
  [/wrist\s*curl|เคิร์ลข้อมือ/i, ['forearms']],
  [/curl|เคิร์ล/i, ['biceps'], ['forearms']],
  [/upright\s*row|อัพไรท์/i, ['delt-side'], ['traps-upper', 'delt-front']],
  [/ไหล่\s*·?\s*หลัง|rear delt|reverse (fly|pec)/i, ['delt-rear'], ['mid-back']],
  [/\brows?\b|โรว์/i, ['mid-back', 'lats'], ['biceps', 'delt-rear']],
  [/pull[\s-]*down|pull[\s-]*ups?\b|chin[\s-]*ups?\b|ดึงบาร์ลง|ดึงข้อ/i, ['lats'], ['biceps', 'mid-back']],
  [/calf|calves|เขย่ง/i, ['calves']],
  [/squat|สควอท|lunge|ลันจ์|leg\s*press|เลกเพรส|step[\s-]*up/i, ['quads', 'glutes'], ['adductors']],
  [/romanian|\brdl\b|stiff[\s-]*leg|good\s*morning|deadlift|เดดลิฟต์/i, ['hamstrings', 'glutes'], ['lower-back', 'forearms']],
  [/hip\s*thrust|glute\s*bridge|ฮิปทรัสต์|บริดจ์/i, ['glutes'], ['hamstrings', 'adductors']],
  [/lateral\s*raise|side\s*raise|ยกไหล่ข้าง|ยกดัมเบลข้าง/i, ['delt-side'], ['delt-front', 'traps-upper']],
  [/overhead\s*press|shoulder\s*press|military|ดันไหล่/i, ['delt-front'], ['delt-side', 'triceps']],
  [/อกบน|upper chest|incline(?!\s*(walk|treadmill))/i, ['chest-upper'], ['delt-front', 'triceps']],
  [/bench\s*press|chest\s*press|push[\s-]*ups?\b|วิดพื้น|เบนช์|ดันอก/i, ['chest-lower'], ['chest-upper', 'delt-front', 'triceps']],
  [/crunch|sit[\s-]*up|plank|ครันช์|ซิทอัพ|แพลงก์/i, ['abs'], ['obliques']],
  [/อกล่าง|อกกลาง|lower chest/i, ['chest-lower'], ['delt-front', 'triceps']],
  [/\bfly|\bflye|ฟลาย|บีบอก|pec[\s-]*deck/i, ['chest-lower'], ['chest-upper', 'delt-front']],
  [/ไหล่\s*·?\s*ข้าง|lateral delt|side delt/i, ['delt-side'], ['traps-upper']],
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
  [/ขาท่อนล่าง|ขาล่าง|lower leg/i, ['calves'], ['tibialis']],
  [/ขาท่อนบน|ขาบน|thigh/i, ['quads', 'hamstrings'], ['adductors', 'glutes']],
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

/** Share of a muscle's rest that a secondary hit uses up. */
export const SECONDARY_REST_SHARE = 0.5;

/**
 * Per-region recovery from trained moves: the hit leaving the most rest still to go wins
 * (a secondary hit needs rest × SECONDARY_REST_SHARE); ties go to the most recent hit.
 * `rest` is the rest that hit needs; `full` is the muscle's full rest.
 * @param {{ p: string[], s: string[], days: number|null, last: string }[]} moves
 * @returns {Map<string, { days: number, via: 'p'|'s', last: string, rest: number }>}
 */
export function computeRegionRest(moves, profile) {
  const out = new Map();
  const consider = (id, days, last, via) => {
    const full = regionRestDays(profile, id);
    const rest = via === 's' ? full * SECONDARY_REST_SHARE : full;
    const left = rest - days;
    const prev = out.get(id);
    if (prev) {
      const prevLeft = prev.rest - prev.days;
      if (prevLeft > left || (prevLeft === left && (prev.days < days || (prev.days === days && prev.via === 'p')))) return;
    }
    out.set(id, { days, via, last, rest, full });
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
  const at = (dk) => (dk ? `ล่าสุด ${Number(dk.slice(8, 10))}/${Number(dk.slice(5, 7))}` : '');
  const fatTip = m?.estimated ? 'ประมาณจาก BMI (Deurenberg) · ใส่ไขมัน % รายวันเพื่อค่าจริง'
    : s.fatAt ? at(s.fatAt)
      : m ? 'จากค่าตั้งค่า · ยังไม่เคยใส่รายวัน' : '';
  return [
    chip('สูง', fmtStat(s.heightCm, 0), 'ซม.', 'จากตั้งค่า'),
    chip('อายุ', fmtStat(s.age, 0), 'ปี', 'คิดจากวันเกิด ณ วันนี้'),
    chip('เพศ', sexLabel),
    chip('หนัก', fmtStat(s.weight), 'กก.', at(s.weightAt)),
    chip('เอว', fmtStat(s.waist), 'ซม.', at(s.waistAt)),
    chip(m && !m.estimated && !s.fatAt ? 'ไขมัน (ตั้งค่า)' : 'ไขมัน', fatVal, '%', fatTip),
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

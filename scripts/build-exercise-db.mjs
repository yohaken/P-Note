#!/usr/bin/env node
/**
 * Builds frontend/js/exercise-db.js from free-exercise-db (The Unlicense, public domain)
 * https://github.com/yuhonas/free-exercise-db — pinned to FEDB_SHA so image URLs never move.
 *
 * Inputs:  /tmp/fedb.json (or fetched from the pinned commit), scripts/exercise-th.json,
 *          scripts/library-image-map.json, frontend/js/muscle-map.js (read-only: region ids,
 *          equipment codes, EXERCISE_LIBRARY ids).
 * Usage:   node scripts/build-exercise-db.mjs [path/to/exercises.json]
 */
import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FEDB_SHA = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const FEDB_JSON_URL = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${FEDB_SHA}/dist/exercises.json`;
const IMG_BASE = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${FEDB_SHA}/exercises/`;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'frontend/js/exercise-db.js');
const MUSCLE_MAP = join(ROOT, 'frontend/js/muscle-map.js');

const INCLUDED_CATEGORIES = new Set([
  'strength', 'powerlifting', 'olympic weightlifting', 'strongman', 'plyometrics', 'cardio',
]);

async function loadSource() {
  const local = process.argv[2] || '/tmp/fedb.json';
  try {
    await stat(local);
    return JSON.parse(await readFile(local, 'utf8'));
  } catch {
    const res = await fetch(FEDB_JSON_URL);
    if (!res.ok) throw new Error(`fetch ${FEDB_JSON_URL}: ${res.status}`);
    return res.json();
  }
}

async function loadMuscleMap() {
  const src = await readFile(MUSCLE_MAP, 'utf8');
  const regionBlock = src.slice(src.indexOf('export const MUSCLE_REGIONS'), src.indexOf('];', src.indexOf('export const MUSCLE_REGIONS')));
  const regionIds = new Set([...regionBlock.matchAll(/\{\s*id:\s*'([^']+)'/g)].map((m) => m[1]));
  const eqBlock = src.slice(src.indexOf('export const EQUIPMENT_TH'), src.indexOf('};', src.indexOf('export const EQUIPMENT_TH')));
  const eqCodes = new Set([...eqBlock.matchAll(/^\s*([a-z]+):/gm)].map((m) => m[1]));
  const libStart = src.indexOf('export const EXERCISE_LIBRARY');
  const libBlock = src.slice(libStart, src.indexOf('\n];', libStart));
  const library = [...libBlock.matchAll(/\bex\(\s*'([^']+)',\s*'([^']*)',\s*(['"])(.*?)\3,\s*'([^']+)'/g)]
    .map((m) => ({ id: m[1], th: m[2], en: m[4], eq: m[5] }));
  return { regionIds, eqCodes, library };
}

function mapEquipment(x, eqCodes) {
  const name = x.name.toLowerCase();
  let code;
  if (/\bsmith\b/.test(name)) code = 'machine';
  else {
    code = {
      barbell: 'bb', 'e-z curl bar': 'bb', dumbbell: 'db', cable: 'cable', machine: 'machine',
      kettlebells: 'kb', bands: 'band', 'body only': 'bw',
    }[x.equipment];
    // Upstream null equipment is used for bodyweight drills (push-ups, bounds, inverted rows).
    if (x.equipment == null) code = 'bw';
  }
  if (!code || (code !== 'other' && !eqCodes.has(code))) code = 'other';
  return code;
}

const RE = {
  incline: /\bincline\b/,
  inclinePushUp: /\bincline push-?up/,
  declinePushUp: /\bdecline push-?up|push-?ups? with feet elevated/,
  lowToHigh: /\blow cable crossover\b/,
  press: /\bpress|push-?up|pushup|dip\b|dips\b/,
  flatPress: /bench press|chest press|floor press|push-?up|pushup|board press|pin press|chain press/,
  rear: /rear[- ]?delt|reverse fl|reverse machine fl|back fl|face pull|rear lateral|bent[- ]over.*(raise|lateral)|external rotation|sled reverse/,
  side: /lateral|side raise|upright|deltoid raise|laterals|scaption|power partials|iron cross/,
  pull: /\brows?\b|pull-?downs?|pull-?ups?|pullups|chin|muscle up/,
  shoulderPress: /press|jerk|handstand/,
  obliques: /twist|oblique|side bend|side bridge|side jackknife|russian|wood ?chop|windmill|cross-body|heel touch|elbow to knee|air bike|landmine 180|judo|wipers/,
  hipFlexor: /leg raise|leg lift|knee raise|knee\/hip raise|hanging pike|flutter|pull-in|leg tucks|tuck crunch|hip flexion|mountain climb|jackknife|v-up|scissor kick/,
  tibialis: /reverse calf/,
};

function chestRegion(name) {
  if (RE.declinePushUp.test(name) || RE.lowToHigh.test(name)) return 'chest-upper';
  if (RE.inclinePushUp.test(name)) return 'chest-lower';
  return RE.incline.test(name) ? 'chest-upper' : 'chest-lower';
}

function shoulderRegion(name) {
  if (RE.rear.test(name)) return 'delt-rear';
  if (RE.side.test(name)) return 'delt-side';
  if (RE.pull.test(name)) return 'delt-rear';
  return 'delt-front';
}

function mapMuscles(x, regionIds) {
  const name = x.name.toLowerCase();
  const p = [];
  const s = [];
  const add = (list, id) => { if (id && regionIds.has(id) && !list.includes(id)) list.push(id); };

  const mapOne = (m, list, isPrimary) => {
    switch (m) {
      case 'chest': {
        const r = chestRegion(name);
        add(list, r);
        if (r === 'chest-lower' && RE.flatPress.test(name) && !/decline/.test(name)) add(s, 'chest-upper');
        break;
      }
      case 'shoulders': {
        const r = shoulderRegion(name);
        add(list, r);
        if (r === 'delt-front' && RE.shoulderPress.test(name) && !RE.flatPress.test(name)) add(s, 'delt-side');
        break;
      }
      case 'abductors': add(list, 'glute-med'); break;
      case 'lower back': add(regionIds.has('lower-back') ? list : s, regionIds.has('lower-back') ? 'lower-back' : 'mid-back'); break;
      case 'traps': add(list, 'traps-upper'); break;
      case 'middle back': add(list, 'mid-back'); break;
      case 'neck': add(list, 'neck'); break;
      case 'abdominals':
        add(list, 'abs');
        if (RE.obliques.test(name)) add(list, 'obliques');
        if (RE.hipFlexor.test(name)) add(s, 'hip-flexor');
        break;
      case 'quadriceps': add(list, 'quads'); break;
      case 'calves': add(list, RE.tibialis.test(name) && isPrimary ? 'tibialis' : 'calves'); break;
      default: add(list, m); // hamstrings, glutes, adductors, biceps, triceps, forearms, lats
    }
  };

  x.primaryMuscles.forEach((m) => mapOne(m, p, true));
  x.secondaryMuscles.forEach((m) => mapOne(m, s, false));
  return { p, s: s.filter((id) => !p.includes(id)) };
}

const q = (v) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const arr = (a) => `[${a.map(q).join(',')}]`;

async function main() {
  const [source, th, libMap, mm] = await Promise.all([
    loadSource(),
    readFile(join(ROOT, 'scripts/exercise-th.json'), 'utf8').then(JSON.parse),
    readFile(join(ROOT, 'scripts/library-image-map.json'), 'utf8').then(JSON.parse).catch(() => ({})),
    loadMuscleMap(),
  ]);

  const included = source
    .filter((x) => INCLUDED_CATEGORIES.has(x.category) && x.equipment !== 'foam roll')
    .sort((a, b) => a.id.localeCompare(b.id));

  const missingTh = included.filter((x) => !th[x.id]).map((x) => x.id);
  if (missingTh.length) throw new Error(`exercise-th.json missing ${missingTh.length}: ${missingTh.slice(0, 10).join(', ')}`);

  const rows = included.map((x) => {
    const { p, s } = mapMuscles(x, mm.regionIds);
    return { id: x.id, en: x.name, th: th[x.id], eq: mapEquipment(x, mm.eqCodes), cat: x.category, p, s, img: x.images || [] };
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const libIds = new Set(mm.library.map((e) => e.id));
  const libraryImageIds = {};
  const problems = [];
  for (const [libId, fedbId] of Object.entries(libMap)) {
    if (libId.startsWith('_')) continue;
    if (!libIds.has(libId)) { problems.push(`library id not in EXERCISE_LIBRARY: ${libId}`); continue; }
    if (!fedbId) continue;
    if (!byId.has(fedbId)) { problems.push(`fedb id not included: ${libId} -> ${fedbId}`); continue; }
    libraryImageIds[libId] = fedbId;
  }
  const unmapped = mm.library.filter((e) => !libraryImageIds[e.id]).map((e) => e.id);

  const lines = [
    '// Generated by scripts/build-exercise-db.mjs — do not edit by hand.',
    `// Source: free-exercise-db @ ${FEDB_SHA} (The Unlicense, public domain).`,
    '// p = primary region ids, s = secondary region ids (see MUSCLE_REGIONS in muscle-map.js).',
    `export const EXERCISE_IMG_BASE = ${q(IMG_BASE)};`,
    '',
    'export const EXERCISE_DB = [',
    ...rows.map((r) => `  { id: ${q(r.id)}, en: ${q(r.en)}, th: ${q(r.th)}, eq: ${q(r.eq)}, cat: ${q(r.cat)}, p: ${arr(r.p)}, s: ${arr(r.s)}, img: ${arr(r.img)} },`),
    '];',
    '',
    '/** EXERCISE_LIBRARY id (muscle-map.js) -> EXERCISE_DB id with a matching pose photo. */',
    'export const LIBRARY_IMAGE_IDS = {',
    ...Object.entries(libraryImageIds).map(([k, v]) => `  ${q(k)}: ${q(v)},`),
    '};',
    '',
    'const DB_BY_ID = new Map(EXERCISE_DB.map((e) => [e.id, e]));',
    '',
    'export function exerciseById(fedbId) {',
    '  return DB_BY_ID.get(fedbId) || null;',
    '}',
    '',
    'export function exerciseImageUrls(fedbId) {',
    '  const e = DB_BY_ID.get(fedbId);',
    '  return e ? e.img.map((p) => EXERCISE_IMG_BASE + p) : [];',
    '}',
    '',
  ];
  await writeFile(OUT, lines.join('\n'));

  const size = (await stat(OUT)).size;
  console.log(`wrote ${OUT}`);
  console.log(`included exercises: ${rows.length}`);
  console.log(`library mapped: ${Object.keys(libraryImageIds).length}/${mm.library.length}`);
  if (unmapped.length) console.log(`library unmapped (${unmapped.length}): ${unmapped.join(', ')}`);
  problems.forEach((m) => console.warn(`WARN ${m}`));
  const noMuscle = rows.filter((r) => !r.p.length).map((r) => r.id);
  if (noMuscle.length) console.warn(`WARN no primary region: ${noMuscle.join(', ')}`);
  console.log(`size: ${size} bytes (${(size / 1024).toFixed(1)} KiB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * Muscle tree log — hierarchical groups × date columns (newest → oldest).
 * Leaf cells store burn kcal; parents show per-day sums.
 * Day.exercises sync is applied by the caller (calorie helpers).
 */

import {
  ALL_EXERCISES,
  BEGINNER_GROUPS,
  UNSPECIFIED_MOVE,
  beginnerGroupOfRegion,
  exerciseImages,
  libraryExerciseByName,
  computeRegionRest,
  normalizeRestProfile,
  regionRestDays,
  resolveMoveMuscles,
  sanitizeRegionIds,
  restRemaining,
  regionById,
} from './muscle-map.js?v=324';

export const MUSCLE_DATE_COLS = 30;
export const MUSCLE_NAME_MAX = 40;

const CARDIO_SEED = { id: 'bg-cardio', name: 'คาร์ดิโอ', moves: ['วิ่ง', 'เดิน', 'ปั่นจักรยาน'] };

/** Seed tree: beginner muscle groups with popular moves, plus cardio. */
export function defaultMuscleNodes() {
  const out = [];
  [...BEGINNER_GROUPS, CARDIO_SEED].forEach((g, i) => {
    out.push({ id: g.id, name: g.name, parentId: null, order: i });
    g.moves.forEach((name, j) => out.push({ id: `${g.id}-${j}`, name, parentId: g.id, order: j }));
  });
  return out;
}

/** Original seed (sub-muscle rows); still used when a stored tree lost its nodes but kept these cells. */
export function legacyMuscleNodes() {
  const mk = (id, name, parentId, order) => ({ id, name, parentId, order });
  return [
    mk('m-chest', 'อก', null, 0),
    mk('m-chest-up', 'อกบน', 'm-chest', 0),
    mk('m-chest-low', 'อกล่าง', 'm-chest', 1),
    mk('m-chest-mid', 'อกกลาง', 'm-chest', 2),
    mk('m-legs', 'ขา', null, 1),
    mk('m-legs-front', 'หน้าขา', 'm-legs', 0),
    mk('m-legs-back', 'หลังขา', 'm-legs', 1),
    mk('m-shoulders', 'ไหล่', null, 2),
    mk('m-shoulders-main', 'หลัก', 'm-shoulders', 0),
    mk('m-shoulders-side', 'ข้าง', 'm-shoulders', 1),
  ];
}

function newId(prefix = 'm') {
  try {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `${prefix}-${Date.now().toString(36)}`;
  }
}

/** Commas would split the "kcal,label" day cell, so they become spaces. */
function clampName(raw) {
  return String(raw || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MUSCLE_NAME_MAX);
}

function clampKcal(raw) {
  if (raw == null || raw === '') return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(5000, n);
}

function nowIsoLocal() {
  try {
    return new Date().toISOString();
  } catch {
    return '';
  }
}

/** Local YYYY-MM-DD (matches calorie.toDateKey style). */
export function muscleToDateKey(d = new Date()) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function normalizeMuscleNode(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const name = clampName(raw.name);
  if (!id || !name) return null;
  const parentId = raw.parentId == null || raw.parentId === ''
    ? null
    : String(raw.parentId).trim();
  const order = Number.isFinite(Number(raw.order)) ? Number(raw.order) : 0;
  const node = { id, name, parentId, order };
  // p/s present (even empty) = muscles chosen by the user; absent = resolve from library/name.
  if (Array.isArray(raw.p) || Array.isArray(raw.s)) {
    node.p = sanitizeRegionIds(raw.p);
    node.s = sanitizeRegionIds(raw.s).filter((r) => !node.p.includes(r));
  }
  return node;
}

/** Flat cells map: `${nodeId}|${dateKey}` → kcal */
export function normalizeMuscleCells(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.keys(raw).forEach((key) => {
    const k = String(key || '');
    if (!k.includes('|')) return;
    const kcal = clampKcal(raw[k]);
    if (kcal != null) out[k] = kcal;
  });
  return out;
}

export function cellKey(nodeId, dateKey) {
  return `${nodeId}|${dateKey}`;
}

export function normalizeMuscleTree(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  let nodes = (Array.isArray(src.nodes) ? src.nodes : [])
    .map(normalizeMuscleNode)
    .filter(Boolean);
  if (!nodes.length) {
    const legacy = Object.keys(src.cells || {}).some((k) => k.startsWith('m-'));
    nodes = legacy ? legacyMuscleNodes() : defaultMuscleNodes();
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  nodes = nodes.filter((n) => {
    if (!n.parentId) return true;
    const p = byId.get(n.parentId);
    return Boolean(p && !p.parentId);
  });

  const roots = nodes
    .filter((n) => !n.parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'th'));
  const childrenOf = (pid) =>
    nodes
      .filter((n) => n.parentId === pid)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'th'));
  const ordered = [];
  roots.forEach((r, i) => {
    ordered.push({ ...r, order: i });
    childrenOf(r.id).forEach((c, j) => ordered.push({ ...c, order: j }));
  });

  const idSet = new Set(ordered.map((n) => n.id));
  const cells = normalizeMuscleCells(src.cells);
  Object.keys(cells).forEach((k) => {
    const nodeId = k.split('|')[0];
    if (!idSet.has(nodeId)) delete cells[k];
  });

  return {
    nodes: ordered,
    cells,
    restScale: normalizeRestScale(src.restScale),
    restProfile: normalizeRestProfile(src.restProfile),
    updatedAt: String(src.updatedAt || '').trim(),
  };
}

/** Rest scale: index = days since last trained (last slot = that many days or more). */
export const REST_SCALE_DAYS = 8;
export const REST_LABEL_MAX = 16;
/** Past the last slot the badge drifts to gray over this many more days. */
export const REST_FADE_DAYS = 7;
export const REST_TONES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'sky', 'violet', 'slate'];

export function defaultRestScale() {
  return [
    { label: 'เพิ่งเล่น', tone: 'red' },
    { label: 'ยังล้า', tone: 'orange' },
    { label: 'กำลังฟื้น', tone: 'amber' },
    { label: 'เริ่มพร้อม', tone: 'yellow' },
    { label: 'พร้อม', tone: 'lime' },
    { label: 'พร้อมมาก', tone: 'green' },
    { label: 'พร้อมเต็มที่', tone: 'teal' },
    { label: 'ห่างนาน', tone: 'sky' },
  ];
}

export function normalizeRestScale(raw) {
  const defs = defaultRestScale();
  const src = Array.isArray(raw) ? raw : [];
  return defs.map((def, i) => {
    const s = src[i] && typeof src[i] === 'object' ? src[i] : {};
    const label = String(s.label ?? '').trim().slice(0, REST_LABEL_MAX) || def.label;
    const tone = REST_TONES.includes(s.tone) ? s.tone : def.tone;
    return { label, tone };
  });
}

export function setRestScale(tree, scale) {
  const t = normalizeMuscleTree(tree);
  return normalizeMuscleTree({ ...t, restScale: normalizeRestScale(scale), updatedAt: nowIsoLocal() });
}

export function setRestProfile(tree, profile) {
  const t = normalizeMuscleTree(tree);
  return normalizeMuscleTree({ ...t, restProfile: normalizeRestProfile(profile), updatedAt: nowIsoLocal() });
}

/** muscles = { p, s } to pin, or null to go back to library/name matching. */
export function setNodeMuscles(tree, nodeId, muscles) {
  const t = normalizeMuscleTree(tree);
  if (!t.nodes.some((n) => n.id === nodeId)) return t;
  const nodes = t.nodes.map((n) => {
    if (n.id !== nodeId) return n;
    const { p: _p, s: _s, ...rest } = n;
    return muscles ? { ...rest, p: muscles.p || [], s: muscles.s || [] } : rest;
  });
  return normalizeMuscleTree({ ...t, nodes, updatedAt: nowIsoLocal() });
}

/** Old sub-muscle rows → beginner group they fold into (as a "ไม่ระบุท่า" move). */
const LEGACY_FOLD = {
  'อก': { 'อกบน': 'bg-chest', 'อกล่าง': 'bg-chest', 'อกกลาง': 'bg-chest' },
  'ขา': { 'หน้าขา': 'bg-quads', 'หลังขา': 'bg-hamstrings' },
  'ไหล่': { 'หลัก': 'bg-shoulders', 'ข้าง': 'bg-shoulders' },
};

/**
 * Reorganise into the 10 beginner groups (+ cardio): reuse same-named roots, fold legacy
 * sub-muscle rows into "ไม่ระบุท่า" under the matching group (cells move with them), seed
 * popular moves, keep every user-made row. Idempotent.
 * @returns {{ tree: object, touchDates: string[] }}
 */
export function applyBeginnerLayout(tree) {
  const t = normalizeMuscleTree(tree);
  let nodes = t.nodes.map((n) => ({ ...n }));
  const cells = { ...t.cells };
  const touch = new Set();
  const hasCells = (id) => Object.keys(cells).some((k) => k.startsWith(`${id}|`));
  const hasKids = (id) => nodes.some((c) => c.parentId === id);

  const rootIds = {};
  [...BEGINNER_GROUPS, CARDIO_SEED].forEach((g, i) => {
    const isCardio = g === CARDIO_SEED;
    let root = nodes.find((n) => !n.parentId && (isCardio ? CARDIO_NAME_RE.test(n.name) : n.name === g.name));
    if (root && !hasKids(root.id) && hasCells(root.id)) {
      // A root logged as a move itself can't take children without losing its cells.
      root.name = clampName(`${root.name} (เดิม)`);
      root = null;
    }
    if (!root) {
      root = { id: newId('cat'), name: g.name, parentId: null, order: 0 };
      nodes.push(root);
    }
    root.order = -100 + i;
    rootIds[g.id] = root.id;
  });

  const unspecified = {};
  const unspecifiedFor = (gid) => {
    if (unspecified[gid]) return unspecified[gid];
    const pid = rootIds[gid];
    let n = nodes.find((x) => x.parentId === pid && x.name === UNSPECIFIED_MOVE);
    if (!n) {
      n = { id: newId('leaf'), name: UNSPECIFIED_MOVE, parentId: pid, order: -1 };
      nodes.push(n);
    }
    unspecified[gid] = n.id;
    return n.id;
  };
  const drop = new Set();
  nodes.filter((n) => n.parentId).forEach((child) => {
    const parent = nodes.find((p) => p.id === child.parentId);
    const gid = LEGACY_FOLD[parent?.name]?.[child.name];
    if (!gid) return;
    const target = unspecifiedFor(gid);
    Object.keys(cells).forEach((k) => {
      const [id, dk] = k.split('|');
      if (id !== child.id) return;
      const nk = cellKey(target, dk);
      cells[nk] = Math.max(cells[nk] || 0, cells[k]);
      delete cells[k];
      touch.add(dk);
    });
    drop.add(child.id);
  });
  nodes = nodes.filter((n) => !drop.has(n.id));

  const keepRoots = new Set(Object.values(rootIds));
  nodes = nodes.filter((n) => n.parentId || keepRoots.has(n.id) || hasKids(n.id) || hasCells(n.id));

  [...BEGINNER_GROUPS, CARDIO_SEED].forEach((g) => {
    const pid = rootIds[g.id];
    g.moves.forEach((name, j) => {
      if (!nodes.some((n) => n.parentId === pid && n.name === name)) {
        nodes.push({ id: newId('leaf'), name, parentId: pid, order: j });
      }
    });
  });

  return {
    tree: normalizeMuscleTree({ ...t, nodes, cells, updatedAt: nowIsoLocal() }),
    touchDates: [...touch].sort(),
  };
}

const LEG_ROOT_RE = /^(ขา|legs?)$/i;
const LOWER_LEG_REGIONS = new Set(['calves', 'tibialis']);
const GLUTE_REGIONS = new Set(['glutes', 'glute-med']);
export const LEG_SPLIT_NAMES = ['ก้น', 'ขาท่อนบน', 'ขาท่อนล่าง'];

/**
 * Split a whole-leg group into ก้น (gluteal) · ขาท่อนบน (thigh) · ขาท่อนล่าง (leg/crus)
 * by each move's primary muscles. Cells stay keyed by move id, so history moves along.
 * @returns {{ tree: object, moved: number }}
 */
export function splitLegGroups(tree) {
  const t = normalizeMuscleTree(tree);
  let nodes = t.nodes.map((n) => ({ ...n }));
  const legRoots = nodes.filter((n) => !n.parentId && LEG_ROOT_RE.test(n.name.trim()));
  if (!legRoots.length) return { tree: t, moved: 0 };
  const hasOwnCells = (id) => Object.keys(t.cells).some((k) => k.startsWith(`${id}|`) && t.cells[k] > 0);
  const order = Math.min(...legRoots.map((r) => r.order));
  const targets = LEG_SPLIT_NAMES.map((name, i) => {
    let root = nodes.find((n) => !n.parentId && n.name.trim() === name);
    if (!root) {
      root = { id: newId('m'), name, parentId: null, order: order + i * 0.01 };
      nodes.push(root);
    }
    return root;
  });
  const [glute, upper, lower] = targets;
  let moved = 0;
  legRoots.forEach((root) => {
    nodes.filter((n) => n.parentId === root.id).forEach((child) => {
      const m = resolveTreeMove(child, root.name);
      const p = m.p;
      let dest = upper;
      if (p.length && p.every((x) => LOWER_LEG_REGIONS.has(x))) dest = lower;
      else if (p.length && p.every((x) => GLUTE_REGIONS.has(x))) dest = glute;
      const kids = nodes.filter((n) => n.parentId === dest.id);
      child.parentId = dest.id;
      child.order = kids.length ? Math.max(...kids.map((k) => k.order)) + 1 : 0;
      moved += 1;
    });
  });
  const legIds = new Set(legRoots.map((r) => r.id));
  nodes = nodes.filter((n) => !legIds.has(n.id) || hasOwnCells(n.id) || nodes.some((c) => c.parentId === n.id));
  const roots = nodes.filter((n) => !n.parentId).sort((a, b) => a.order - b.order);
  roots.forEach((r, i) => { r.order = i; });
  return { tree: normalizeMuscleTree({ ...t, nodes, updatedAt: nowIsoLocal() }), moved };
}

export function nextRestTone(tone) {
  const i = REST_TONES.indexOf(tone);
  return REST_TONES[(i + 1) % REST_TONES.length];
}

export function restDayLabel(i) {
  if (i === 0) return 'วันนี้';
  return i >= REST_SCALE_DAYS - 1 ? `${i}+ วัน` : `${i} วัน`;
}

/** Step for a rest count; past the last slot `fade` (0–1) blends its color toward gray. */
export function restStep(scale, days) {
  if (days == null) return null;
  const s = normalizeRestScale(scale);
  const last = REST_SCALE_DAYS - 1;
  const i = Math.min(Math.max(Math.floor(days), 0), last);
  if (i < last) return { ...s[i], fade: 0 };
  const tone = s[last].tone === 'slate' ? s[last - 1].tone : s[last].tone;
  const fade = Math.min(1, Math.max(0, (days - last) / REST_FADE_DAYS));
  return { ...s[last], tone, fade };
}

function fadeToneOf(s) {
  const last = REST_SCALE_DAYS - 1;
  return s[last].tone === 'slate' ? s[last - 1].tone : s[last].tone;
}

export function renderRestLegendHtml(scale) {
  const s = normalizeRestScale(scale);
  const chips = s
    .map((st, i) => i === REST_SCALE_DAYS - 1
      ? `<span class="mrl-chip rest-tone-${esc(fadeToneOf(s))} is-fade" title="ค่อยๆ จางเป็นเทาภายใน ${REST_SCALE_DAYS - 1 + REST_FADE_DAYS} วัน"><b>${i}+</b> ${esc(st.label)} → เทา</span>`
      : `<span class="mrl-chip rest-tone-${esc(st.tone)}"><b>${i === REST_SCALE_DAYS - 1 ? `${i}+` : i}</b> ${esc(st.label)}</span>`)
    .join('');
  return `<span class="mrl-title">พัก (วัน)</span>${chips}`;
}

export function renderRestScaleEditorHtml(scale) {
  const s = normalizeRestScale(scale);
  return s
    .map((st, i) => `<div class="rest-edit-row">
      <span class="rest-edit-day">${esc(restDayLabel(i))}</span>
      <input class="rest-edit-label" type="text" maxlength="${REST_LABEL_MAX}" value="${esc(st.label)}"
        data-rest-idx="${i}" aria-label="ชื่อระดับ ${esc(restDayLabel(i))}">
      <button type="button" class="rest-edit-tone rest-tone-${esc(i === REST_SCALE_DAYS - 1 ? fadeToneOf(s) : st.tone)}${i === REST_SCALE_DAYS - 1 ? ' is-fade' : ''}" data-rest-tone="${i}"
        title="แตะเพื่อเปลี่ยนสี" aria-label="เปลี่ยนสี ${esc(restDayLabel(i))}">${i === REST_SCALE_DAYS - 1 ? `${i}+` : i}</button>
    </div>`)
    .join('');
}

export function mergeMuscleTreeField(local, remote) {
  const lt = normalizeMuscleTree(local?.muscleTree);
  const rt = normalizeMuscleTree(remote?.muscleTree);
  const lAt = Date.parse(String(local?.muscleTreeAt || lt.updatedAt || '').trim()) || 0;
  const rAt = Date.parse(String(remote?.muscleTreeAt || rt.updatedAt || '').trim()) || 0;
  if (rAt > lAt) {
    return {
      muscleTree: rt,
      muscleTreeAt: remote?.muscleTreeAt || rt.updatedAt || '',
    };
  }
  if (lAt > rAt) {
    return {
      muscleTree: lt,
      muscleTreeAt: local?.muscleTreeAt || lt.updatedAt || '',
    };
  }
  const lScore = lt.nodes.length + Object.keys(lt.cells).length;
  const rScore = rt.nodes.length + Object.keys(rt.cells).length;
  if (rScore > lScore) {
    return {
      muscleTree: rt,
      muscleTreeAt: remote?.muscleTreeAt || rt.updatedAt || local?.muscleTreeAt || '',
    };
  }
  return {
    muscleTree: lt,
    muscleTreeAt: local?.muscleTreeAt || lt.updatedAt || remote?.muscleTreeAt || '',
  };
}

export function isLeafNode(node, nodes) {
  if (!node) return false;
  if (node.parentId) return true;
  return !(nodes || []).some((n) => n.parentId === node.id);
}

export function flattenMuscleRows(tree) {
  const t = normalizeMuscleTree(tree);
  const roots = t.nodes.filter((n) => !n.parentId);
  const rows = [];
  roots.forEach((root) => {
    const kids = t.nodes.filter((n) => n.parentId === root.id);
    rows.push({ ...root, depth: 0, leaf: kids.length === 0, childIds: kids.map((k) => k.id) });
    kids.forEach((c) => {
      rows.push({ ...c, depth: 1, leaf: true, childIds: [] });
    });
  });
  return rows;
}

/** Newest → oldest date keys for columns. */
export function muscleDateKeys({ count = MUSCLE_DATE_COLS, today = muscleToDateKey() } = {}) {
  const out = [];
  const base = new Date(`${today}T12:00:00`);
  if (Number.isNaN(base.getTime())) return [muscleToDateKey()];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(muscleToDateKey(d));
  }
  return out;
}

/** Oldest date with any stored cell ('' when the table is empty). */
export function oldestMuscleDate(tree) {
  let oldest = '';
  Object.keys(normalizeMuscleTree(tree).cells).forEach((k) => {
    const dk = k.split('|')[1] || '';
    if (dk && (!oldest || dk < oldest)) oldest = dk;
  });
  return oldest;
}

export function getMuscleCell(tree, nodeId, dateKey) {
  const cells = normalizeMuscleTree(tree).cells;
  return cells[cellKey(nodeId, dateKey)] ?? null;
}

export function leafLabelPath(tree, nodeId) {
  const t = normalizeMuscleTree(tree);
  const node = t.nodes.find((n) => n.id === nodeId);
  if (!node) return '';
  if (!node.parentId) return node.name;
  const parent = t.nodes.find((n) => n.id === node.parentId);
  return parent ? `${parent.name} · ${node.name}` : node.name;
}

/**
 * Cardio rows log real kcal burned (feeds the calorie balance).
 * Every other row is a strength mark: counts sessions, burns 0 kcal.
 */
export const CARDIO_NAME_RE = /คาดิโอ|คาร์ดิโอ|cardio|วิ่ง|เดิน|ปั่น|จักรยาน|ว่ายน้ำ|กระโดดเชือก/i;

/** Cardio by name, except library strength moves that merely contain เดิน/ปั่น (เดินถือดัมเบล…). */
export function isCardioName(name) {
  return CARDIO_NAME_RE.test(name) && !libraryExerciseByName(name);
}

/** Cardio for a leaf name under an optional parent name (a cardio parent makes every child cardio). */
export function isCardioMove(name, parentName = '') {
  return Boolean(parentName && CARDIO_NAME_RE.test(parentName)) || isCardioName(name);
}

export function isCardioNode(tree, nodeId) {
  const t = normalizeMuscleTree(tree);
  const node = t.nodes.find((n) => n.id === nodeId);
  if (!node) return false;
  const parent = node.parentId ? t.nodes.find((n) => n.id === node.parentId) : null;
  return isCardioMove(node.name, parent?.name);
}

/** Labels that belong to the current tree (used to rebuild day.exercises). */
export function muscleTreeLabels(tree) {
  const rows = flattenMuscleRows(tree);
  const labels = new Set();
  rows.forEach((r) => {
    if (!r.leaf) return;
    labels.add(r.name.slice(0, MUSCLE_NAME_MAX));
    labels.add(leafLabelPath(tree, r.id).slice(0, MUSCLE_NAME_MAX));
  });
  return labels;
}

/**
 * Leaf exercise slots for one date: [{ burn, label, cardio, value }].
 * Strength marks burn 0 kcal; only cardio cells carry burn.
 */
export function muscleSlotsForDate(tree, dateKey) {
  const t = normalizeMuscleTree(tree);
  const rows = flattenMuscleRows(t).filter((r) => r.leaf);
  const out = [];
  rows.forEach((r) => {
    const value = t.cells[cellKey(r.id, dateKey)];
    if (!(value > 0)) return;
    const label = r.depth === 1 ? leafLabelPath(t, r.id) : r.name;
    const cardio = isCardioNode(t, r.id);
    out.push({ burn: cardio ? value : 0, label, cardio, value });
  });
  return out;
}

/** Pure tree update — does not touch day rows. */
export function setMuscleCellInTree(tree, nodeId, dateKey, kcalRaw) {
  const t = normalizeMuscleTree(tree);
  const node = t.nodes.find((n) => n.id === nodeId);
  if (!node || !isLeafNode(node, t.nodes)) {
    return { tree: t, changed: false, dateKey };
  }
  const key = cellKey(nodeId, dateKey);
  const kcal = clampKcal(kcalRaw);
  const prev = t.cells[key] ?? null;
  if (prev === kcal) return { tree: t, changed: false, dateKey };

  const cells = { ...t.cells };
  if (kcal == null) delete cells[key];
  else cells[key] = kcal;

  return {
    tree: { ...t, cells, updatedAt: nowIsoLocal() },
    changed: true,
    dateKey,
  };
}

export function addMuscleCategory(tree, name) {
  const label = clampName(name);
  if (!label) return { tree: normalizeMuscleTree(tree), node: null };
  const t = normalizeMuscleTree(tree);
  const roots = t.nodes.filter((n) => !n.parentId);
  const node = {
    id: newId('cat'),
    name: label,
    parentId: null,
    order: roots.length,
  };
  const next = {
    ...t,
    nodes: [...t.nodes, node],
    updatedAt: nowIsoLocal(),
  };
  return { tree: normalizeMuscleTree(next), node };
}

export function addMuscleChild(tree, parentId, name) {
  const label = clampName(name);
  const t = normalizeMuscleTree(tree);
  const parent = t.nodes.find((n) => n.id === parentId && !n.parentId);
  if (!parent || !label) return { tree: t, node: null };
  const siblings = t.nodes.filter((n) => n.parentId === parent.id);
  const node = {
    id: newId('leaf'),
    name: label,
    parentId: parent.id,
    order: siblings.length,
  };
  const cells = { ...t.cells };
  Object.keys(cells).forEach((k) => {
    if (k.startsWith(`${parent.id}|`)) delete cells[k];
  });
  const next = {
    ...t,
    nodes: [...t.nodes, node],
    cells,
    updatedAt: nowIsoLocal(),
  };
  return { tree: normalizeMuscleTree(next), node };
}

function moveKey(name) {
  return clampName(name).replace(/\s+/g, '').toLowerCase();
}

const nodeIsCardio = (byId, n) => isCardioMove(n.name, n.parentId ? byId.get(n.parentId)?.name : '');

/**
 * One-pass lookup of strength moves already in the tree, by name key and library id.
 * @returns {(name: string) => object|null}
 */
export function exerciseLeafIndex(tree) {
  const t = normalizeMuscleTree(tree);
  const byId = new Map(t.nodes.map((n) => [n.id, n]));
  const byKey = new Map();
  const byLib = new Map();
  const hasKids = new Set(t.nodes.map((n) => n.parentId).filter(Boolean));
  t.nodes.forEach((n) => {
    if (nodeIsCardio(byId, n)) return;
    // A childless root counts only once it has marks (else it is an empty group).
    if (!n.parentId && (hasKids.has(n.id) || !Object.keys(t.cells).some((k) => k.startsWith(`${n.id}|`)))) return;
    if (!byKey.has(moveKey(n.name))) byKey.set(moveKey(n.name), n);
    const libId = n.id.startsWith('ex-') ? n.id.slice(3) : libraryExerciseByName(n.name)?.id;
    if (libId && !byLib.has(libId)) byLib.set(libId, n);
  });
  return (name) => byKey.get(moveKey(name)) || byLib.get(libraryExerciseByName(name)?.id) || null;
}

/** Existing leaf that already stands for this exercise (same name, library id, or ex-id). */
export function findExerciseLeaf(tree, name) {
  return exerciseLeafIndex(tree)(name);
}

/**
 * Strength group whose regions best cover the primaries (first primary counts double).
 * @returns {object|null} root node
 */
export function bestGroupForMuscles(tree, primaries = []) {
  const t = normalizeMuscleTree(tree);
  if (!primaries.length) return null;
  const moves = new Map(muscleMoveStates(t).map((m) => [m.id, m]));
  let best = null;
  let bestScore = 0;
  const hasOwnMarks = (id) => Object.keys(t.cells).some((k) => k.startsWith(`${id}|`));
  flattenMuscleRows(t)
    .filter((r) => !r.parentId && !isCardioNode(t, r.id) && !(r.leaf && hasOwnMarks(r.id)))
    .forEach((r) => {
      const regions = new Set(groupRegions(t, r, moves));
      // "แขน" names only biceps; widen to its beginner group so arm moves don't spawn "แขนหน้า".
      [...regions].forEach((id) => beginnerGroupOfRegion(id)?.regions.forEach((x) => regions.add(x)));
      const score = primaries.reduce((sum, id, i) => sum + (regions.has(id) ? (i ? 1 : 2) : 0), 0);
      if (score > bestScore) {
        best = t.nodes.find((n) => n.id === r.id);
        bestScore = score;
      }
    });
  return best;
}

/**
 * Add an exercise as a move under the group that fits its primary muscles
 * (creates the beginner group when none fits). Reuses a matching move when one exists.
 * @returns {{ tree, node, created: boolean }}
 */
export function addExerciseMove(tree, name) {
  const t = normalizeMuscleTree(tree);
  const existing = findExerciseLeaf(t, name);
  if (existing) return { tree: t, node: existing, created: false };
  const lib = libraryExerciseByName(name);
  const label = clampName(lib ? lib.name : name);
  if (!label) return { tree: t, node: null, created: false };
  if (!lib && isCardioName(label)) {
    let work = t;
    let cardioRoot = t.nodes.find((n) => !n.parentId && CARDIO_NAME_RE.test(n.name)) || null;
    if (!cardioRoot) ({ tree: work, node: cardioRoot } = addMuscleCategory(work, CARDIO_SEED.name));
    const { tree: withLeaf, node } = addMuscleChild(work, cardioRoot.id, label);
    return node ? { tree: withLeaf, node, created: true } : { tree: t, node: null, created: false };
  }
  const { p } = lib ? lib : resolveMoveMuscles({ name: label }, '');
  let work = t;
  let group = bestGroupForMuscles(work, p);
  const ownMarks = (g) => g && !work.nodes.some((n) => n.parentId === g.id)
    && Object.keys(work.cells).some((k) => k.startsWith(`${g.id}|`));
  if (ownMarks(group)) group = null;
  if (!group) {
    const groupName = (p.length && beginnerGroupOfRegion(p[0])?.name) || 'ท่าอื่นๆ';
    group = work.nodes.find((n) => !n.parentId && n.name === groupName) || null;
    if (ownMarks(group)) group = null;
    if (!group) ({ tree: work, node: group } = addMuscleCategory(work, ownMarks(work.nodes.find((n) => !n.parentId && n.name === groupName)) ? `${groupName} (ท่า)` : groupName));
  }
  const { tree: withLeaf, node } = addMuscleChild(work, group.id, label);
  if (!node) return { tree: t, node: null, created: false };
  const wantId = lib ? `ex-${lib.id}` : '';
  if (!wantId || withLeaf.nodes.some((n) => n.id === wantId)) return { tree: withLeaf, node, created: true };
  const nodes = withLeaf.nodes.map((n) => (n.id === node.id ? { ...n, id: wantId } : n));
  const renamed = normalizeMuscleTree({ ...withLeaf, nodes });
  return { tree: renamed, node: renamed.nodes.find((n) => n.id === wantId), created: true };
}

/** Days without a log before an old (not library / not pinned) move is hidden. */
export const STALE_MOVE_DAYS = 30;

/** Ids of old moves not logged for STALE_MOVE_DAYS; still counted in group doses. */
export function staleMoveIds(tree, todayKey = muscleToDateKey(), days = STALE_MOVE_DAYS) {
  return new Set(
    muscleMoveStates(tree, todayKey)
      .filter((m) => m.source !== 'library' && m.source !== 'set' && m.last && m.days > days)
      .map((m) => m.id),
  );
}

export function renameMuscleNode(tree, nodeId, name) {
  const label = clampName(name);
  const t = normalizeMuscleTree(tree);
  if (!label) return { tree: t, changed: false };
  if (!t.nodes.some((n) => n.id === nodeId)) return { tree: t, changed: false };
  const nodes = t.nodes.map((n) => (n.id === nodeId ? { ...n, name: label } : n));
  return {
    tree: normalizeMuscleTree({ ...t, nodes, updatedAt: nowIsoLocal() }),
    changed: true,
  };
}

export function removeMuscleNode(tree, nodeId) {
  const t = normalizeMuscleTree(tree);
  const target = t.nodes.find((n) => n.id === nodeId);
  if (!target) return { tree: t, changed: false, touchDates: [] };
  const dropIds = new Set([nodeId]);
  t.nodes.forEach((n) => {
    if (n.parentId === nodeId) dropIds.add(n.id);
  });
  const touchDates = new Set();
  Object.keys(t.cells).forEach((k) => {
    const [id, date] = k.split('|');
    if (dropIds.has(id)) touchDates.add(date);
  });
  const nodes = t.nodes.filter((n) => !dropIds.has(n.id));
  const cells = { ...t.cells };
  Object.keys(cells).forEach((k) => {
    const id = k.split('|')[0];
    if (dropIds.has(id)) delete cells[k];
  });
  const next = normalizeMuscleTree({
    ...t,
    nodes: nodes.length ? nodes : defaultMuscleNodes(),
    cells: nodes.length ? cells : {},
    updatedAt: nowIsoLocal(),
  });
  return { tree: next, changed: true, touchDates: [...touchDates] };
}

/**
 * Move a category or leaf among its siblings (−1 = up, +1 = down).
 * Persists via node.order after normalizeMuscleTree.
 */
export function moveMuscleNode(tree, nodeId, direction) {
  const dir = direction < 0 ? -1 : 1;
  const t = normalizeMuscleTree(tree);
  const node = t.nodes.find((n) => n.id === nodeId);
  if (!node) return { tree: t, changed: false };
  const parentKey = node.parentId || null;
  const siblings = t.nodes
    .filter((n) => (n.parentId || null) === parentKey)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'th'));
  const idx = siblings.findIndex((n) => n.id === nodeId);
  const swapIdx = idx + dir;
  if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) {
    return { tree: t, changed: false };
  }
  const a = siblings[idx];
  const b = siblings[swapIdx];
  const orderA = a.order;
  const orderB = b.order;
  const nodes = t.nodes.map((n) => {
    if (n.id === a.id) return { ...n, order: orderB };
    if (n.id === b.id) return { ...n, order: orderA };
    return n;
  });
  return {
    tree: normalizeMuscleTree({ ...t, nodes, updatedAt: nowIsoLocal() }),
    changed: true,
  };
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Compact date header: D/M */
export function formatMuscleColDate(dateKey) {
  const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateKey || '';
  return `${Number(m[3])}/${Number(m[2])}`;
}

export function weekdayShortTh(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][d.getDay()] || '';
}

/**
 * Session count = number of days with kcal > 0 for that leaf (all stored cells).
 * Parent = sum of children’s session counts.
 */
export function countMuscleSessions(tree, nodeId) {
  const t = normalizeMuscleTree(tree);
  const node = t.nodes.find((n) => n.id === nodeId);
  if (!node) return 0;
  const kids = t.nodes.filter((n) => n.parentId === nodeId);
  if (kids.length) {
    return kids.reduce((sum, k) => sum + countMuscleSessions(t, k.id), 0);
  }
  let n = 0;
  Object.keys(t.cells).forEach((k) => {
    if (!k.startsWith(`${nodeId}|`)) return;
    if (t.cells[k] > 0) n += 1;
  });
  return n;
}

/** Latest date (≤ today) with a mark for the leaf, or for any child of a group. */
export function lastTrainedDate(tree, nodeId, todayKey = muscleToDateKey()) {
  const t = normalizeMuscleTree(tree);
  const kids = t.nodes.filter((n) => n.parentId === nodeId);
  const ids = kids.length ? kids.map((k) => k.id) : [nodeId];
  let last = '';
  Object.keys(t.cells).forEach((k) => {
    const [id, dk] = k.split('|');
    if (!ids.includes(id) || !(t.cells[k] > 0) || !dk || dk > todayKey) return;
    if (dk > last) last = dk;
  });
  return last;
}

/** Whole days between two YYYY-MM-DD keys (local calendar). */
export function daysBetweenKeys(fromKey, toKey) {
  const a = new Date(`${fromKey}T12:00:00`);
  const b = new Date(`${toKey}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * Muscle-part rows logged before moves had exercises: the lift each most likely stood for.
 * Keyed by parent+name or name, spaces removed. Shown with "?" until the user confirms.
 */
const LEGACY_MOVE_MUSCLES = {
  อกบน: [['chest-upper'], ['delt-front', 'triceps', 'chest-lower']],
  อกกลาง: [['chest-lower'], ['chest-upper', 'delt-front', 'triceps']],
  อกล่าง: [['chest-lower'], ['triceps', 'delt-front']],
  ฟลาย: [['chest-lower'], ['chest-upper', 'delt-front']],
  ไหล่หลัก: [['delt-front'], ['delt-side', 'triceps', 'chest-upper', 'traps-upper']],
  ไหล่ข้าง: [['delt-side'], ['delt-front', 'traps-upper']],
  ไหล่หน้า: [['delt-front'], ['chest-upper', 'delt-side', 'serratus']],
  หน้าแขน: [['biceps'], ['forearms']],
  หลังแขน: [['triceps'], []],
  ปีกกว้าง: [['lats'], ['mid-back', 'delt-rear', 'biceps', 'forearms']],
  ปีกกลาง: [['lats'], ['biceps', 'mid-back', 'delt-rear', 'forearms']],
  ปีกแคบ: [['lats'], ['biceps', 'mid-back', 'forearms']],
  หลังล่างแคบ: [['lats', 'mid-back'], ['biceps', 'delt-rear', 'forearms']],
  หลังล่างกว้าง: [['mid-back', 'lats'], ['delt-rear', 'biceps']],
  หลังกลางแคบ: [['mid-back', 'lats'], ['biceps', 'delt-rear']],
  หลังกลางกว้าง: [['mid-back'], ['delt-rear', 'lats', 'biceps', 'traps-upper']],
  หลังshrugs: [['traps-upper'], ['forearms']],
  หน้าขา: [['quads'], []],
  หลังขา: [['hamstrings'], ['calves']],
  ขารวม: [['quads', 'glutes'], ['adductors']],
  น่องขา: [['calves'], []],
  ข้างขา: [['glute-med'], ['glutes']],
  ท้องกลาง: [['abs'], ['obliques']],
  ท้องข้าง: [['obliques'], ['abs']],
};

const legacyKeyOf = (x) => String(x || '').replace(/\s+/g, '').toLowerCase();

function legacyKey(name, parentName, table) {
  const both = legacyKeyOf(parentName + name);
  if (table[both]) return both;
  const own = legacyKeyOf(name);
  return table[own] ? own : '';
}

function legacyMoveMuscles(name, parentName) {
  const hit = LEGACY_MOVE_MUSCLES[legacyKey(name, parentName, LEGACY_MOVE_MUSCLES)];
  return hit ? { p: [...hit[0]], s: [...hit[1]], source: 'legacy' } : null;
}

/** Library moves a legacy row most likely stood for (first = suggestion). */
const LEGACY_MOVE_SUGGEST = {
  อกบน: ['incline-bench', 'incline-db-press', 'smith-incline', 'incline-chest-machine'],
  อกกลาง: ['bench-press', 'chest-press-machine', 'flat-db-press', 'smith-bench'],
  อกล่าง: ['decline-bench', 'dips', 'bench-press'],
  ฟลาย: ['pec-deck', 'cable-fly', 'flat-db-fly'],
  ไหล่หลัก: ['shoulder-press-machine', 'overhead-press', 'smith-shoulder-press', 'arnold-press'],
  ไหล่ข้าง: ['lateral-raise', 'cable-lateral-raise', 'lateral-raise-machine'],
  ไหล่หน้า: ['front-raise'],
  หน้าแขน: ['db-curl', 'bb-curl', 'cable-curl', 'preacher-curl', 'hammer-curl'],
  หลังแขน: ['triceps-pushdown', 'rope-pushdown', 'overhead-cable-ext', 'skull-crusher'],
  ปีกกว้าง: ['wide-pulldown', 'lat-pulldown', 'pull-up'],
  ปีกกลาง: ['lat-pulldown', 'wide-pulldown'],
  ปีกแคบ: ['close-pulldown', 'reverse-pulldown', 'chin-up'],
  หลังล่างแคบ: ['seated-cable-row', 'db-row'],
  หลังล่างกว้าง: ['wide-cable-row', 'seated-cable-row'],
  หลังกลางแคบ: ['t-bar-row', 'machine-row', 'seated-cable-row'],
  หลังกลางกว้าง: ['machine-row', 'wide-cable-row', 'bb-row'],
  หลังshrugs: ['shrug', 'bb-shrug'],
  หน้าขา: ['leg-extension'],
  หลังขา: ['leg-curl', 'seated-leg-curl', 'lying-leg-curl'],
  ขารวม: ['squat', 'leg-press', 'hack-squat', 'smith-squat'],
  น่องขา: ['calf-raise', 'calf-machine', 'seated-calf-raise'],
  ข้างขา: ['hip-abduction', 'hip-adduction'],
  ท้องกลาง: ['crunch', 'ab-machine', 'cable-crunch'],
  ท้องข้าง: ['oblique-crunch', 'russian-twist', 'cable-woodchop'],
};

const LIB_BY_ID = new Map(ALL_EXERCISES.map((e) => [e.id, e]));

/**
 * Legacy muscle-part rows with suggested exercises; never-logged rows default to delete.
 * @returns {{ id, name, parentName, sessions, options: object[], suggestion: string }[]}
 */
export function legacyRowPlans(tree, todayKey = muscleToDateKey()) {
  const t = normalizeMuscleTree(tree);
  return muscleMoveStates(t, todayKey)
    .map((m) => ({ m, key: m.source === 'library' ? '' : legacyKey(m.name, m.parentName, LEGACY_MOVE_SUGGEST) }))
    .filter(({ m, key }) => key || m.source === 'legacy')
    .map(({ m, key }) => {
      const options = (LEGACY_MOVE_SUGGEST[key] || []).map((id) => LIB_BY_ID.get(id)).filter(Boolean);
      const sessions = countMuscleSessions(t, m.id);
      return {
        id: m.id,
        name: m.name,
        parentName: m.parentName,
        sessions,
        options,
        suggestion: sessions ? (options[0]?.id || 'keep') : 'delete',
      };
    });
}

/**
 * Apply choices per legacy row: a library id renames the row to that move (history kept;
 * merged into an existing row for the same move), 'delete' drops a never-logged row.
 * @param {Record<string, string>} choices nodeId → libId | 'delete' | 'keep'
 * @returns {{ tree, touchDates: string[], renamed: number, merged: number, deleted: number }}
 */
export function convertLegacyRows(tree, choices = {}) {
  let t = normalizeMuscleTree(tree);
  const touch = new Set();
  let renamed = 0;
  let merged = 0;
  let deleted = 0;
  const libIdOf = (n) => libraryExerciseByName(n.name)?.id || '';
  const emptiedRoots = new Set();
  Object.entries(choices).forEach(([nodeId, choice]) => {
    const node = t.nodes.find((n) => n.id === nodeId && n.parentId);
    if (!node || !choice || choice === 'keep') return;
    const cellKeys = Object.keys(t.cells).filter((k) => k.startsWith(`${nodeId}|`));
    if (choice === 'delete') {
      if (cellKeys.length) return;
      emptiedRoots.add(node.parentId);
      t = removeMuscleNode(t, nodeId).tree;
      deleted += 1;
      return;
    }
    const lib = LIB_BY_ID.get(choice);
    if (!lib) return;
    const other = t.nodes.find((n) => n.id !== nodeId && n.parentId && libIdOf(n) === lib.id);
    if (other) {
      const cells = { ...t.cells };
      cellKeys.forEach((k) => {
        const dk = k.split('|')[1];
        const dest = cellKey(other.id, dk);
        cells[dest] = Math.max(cells[dest] || 0, cells[k]);
        delete cells[k];
        touch.add(dk);
      });
      t = normalizeMuscleTree({
        ...t,
        cells,
        nodes: t.nodes.filter((n) => n.id !== nodeId),
        updatedAt: nowIsoLocal(),
      });
      merged += 1;
      return;
    }
    const label = clampName(lib.name);
    const { p, s: sec, ...rest } = node;
    t = normalizeMuscleTree({
      ...t,
      nodes: t.nodes.map((n) => (n.id === nodeId ? { ...rest, name: label } : n)),
      updatedAt: nowIsoLocal(),
    });
    cellKeys.forEach((k) => touch.add(k.split('|')[1]));
    renamed += 1;
  });
  // A group left without moves would turn into a loggable row; drop it when it has no marks.
  emptiedRoots.forEach((rootId) => {
    const hasKids = t.nodes.some((n) => n.parentId === rootId);
    const hasCells = Object.keys(t.cells).some((k) => k.startsWith(`${rootId}|`));
    if (!hasKids && !hasCells && t.nodes.some((n) => n.id === rootId)) t = removeMuscleNode(t, rootId).tree;
  });
  return { tree: t, touchDates: [...touch], renamed, merged, deleted };
}

/** Library/explicit muscles, then the legacy row map, then a guess from the name. */
export function resolveTreeMove(node, parentName = '') {
  const m = resolveMoveMuscles(node, parentName);
  if (m.source === 'set' || m.source === 'library') return m;
  return legacyMoveMuscles(node?.name, parentName) || m;
}

/**
 * Strength moves (leaves, cardio excluded) with resolved muscles and days since last trained.
 * @returns {{ id, name, parentId, parentName, p: string[], s: string[], source, days: number|null, last: string }[]}
 */
export function muscleMoveStates(tree, todayKey = muscleToDateKey()) {
  const t = normalizeMuscleTree(tree);
  const byId = new Map(t.nodes.map((n) => [n.id, n]));
  const lastById = new Map();
  Object.keys(t.cells).forEach((k) => {
    if (!(t.cells[k] > 0)) return;
    const [id, dk] = k.split('|');
    if (dk && dk <= todayKey && dk > (lastById.get(id) || '')) lastById.set(id, dk);
  });
  return flattenMuscleRows(t)
    .filter((r) => r.leaf && !nodeIsCardio(byId, byId.get(r.id)))
    .map((r) => {
      const parent = r.parentId ? byId.get(r.parentId) : null;
      const node = byId.get(r.id);
      const m = resolveTreeMove(node, parent?.name || '');
      const last = lastById.get(r.id) || '';
      return {
        id: r.id,
        name: r.name,
        parentId: r.parentId || null,
        parentName: parent?.name || '',
        p: m.p,
        s: m.s,
        source: m.source,
        days: last ? daysBetweenKeys(last, todayKey) : null,
        last,
      };
    });
}

/** Region id → recovery info, from every logged strength move. */
export function regionRestMap(tree, todayKey = muscleToDateKey()) {
  const t = normalizeMuscleTree(tree);
  return computeRegionRest(muscleMoveStates(t, todayKey), t.restProfile);
}

/** Days a move needs = slowest-recovering primary muscle (null when muscles are unknown). */
function moveRestDays(t, move) {
  if (!move.p.length) return null;
  return Math.max(...move.p.map((id) => regionRestDays(t.restProfile, id)));
}

export const SECONDARY_DOSE = 0.5;

/** Regions a strength group stands for: what its name implies, else its moves' primaries. */
function groupRegions(t, r, moves) {
  const named = resolveMoveMuscles({ name: r.name }, '').p;
  if (named.length) return new Set(named);
  const set = new Set();
  (r.childIds || []).forEach((id) => moves.get(id)?.p.forEach((x) => set.add(x)));
  return set;
}

/**
 * Per-day dose for a strength group: 1 per move of its own or any move with a primary in
 * its regions, SECONDARY_DOSE per move that only hits them as a secondary.
 * @returns {Map<string, { dose: number, full: boolean }>}
 */
export function groupDoseByDate(t, r, moves) {
  const own = new Set(r.childIds || []);
  const regions = groupRegions(t, r, moves);
  const out = new Map();
  Object.keys(t.cells).forEach((k) => {
    if (!(t.cells[k] > 0)) return;
    const [id, dk] = k.split('|');
    const m = moves.get(id);
    if (!m || !dk) return;
    let w = 0;
    if (own.has(id) || m.p.some((x) => regions.has(x))) w = 1;
    else if (m.s.some((x) => regions.has(x))) w = SECONDARY_DOSE;
    if (!w) return;
    const prev = out.get(dk) || { dose: 0, full: false };
    out.set(dk, { dose: prev.dose + w, full: prev.full || w >= 1 });
  });
  return out;
}

/** 1.5 → "1½", 0.5 → "½". */
export function fmtDose(n) {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  return `${whole || !half ? whole : ''}${half ? '½' : ''}`;
}

/** Most recently trained move under a row (the row itself when it is a move). */
function rowRestInfo(t, r, moves) {
  const ids = r.leaf ? [r.id] : (r.childIds || []);
  let best = null;
  ids.forEach((id) => {
    const m = moves.get(id);
    if (!m || m.days == null) return;
    const rest = moveRestDays(t, m);
    if (best && (m.days > best.days || (m.days === best.days && (rest ?? 0) <= (best.rest ?? 0)))) return;
    best = { days: m.days, last: m.last, rest };
  });
  return best;
}

function fmtRest(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Small mark beside a move whose muscles are missing (!) or only guessed (?); groups count missing ones. */
function muscleLinkMarkHtml(r, moves, cardio) {
  if (cardio) return '';
  if (r.leaf) {
    const m = moves.get(r.id);
    if (!m || ((m.source === 'set' || m.source === 'library') && m.p.length)) return '';
    if (m.source === 'guess' && m.name === UNSPECIFIED_MOVE) return '';
    const none = !m.p.length;
    const tip = none
      ? 'ยังไม่ผูกกล้าม · ไม่นับวันพักให้กล้ามไหน · แตะเพื่อเลือกกล้าม'
      : `${m.source === 'legacy' ? 'ผูกตามท่าที่น่าจะเล่น' : 'เดากล้ามจากชื่อ'} (${m.p.map((id) => regionById(id)?.name).filter(Boolean).join(', ')}) · แตะเพื่อตรวจ/แก้`;
    return `<button type="button" class="mt-link-mark ${none ? 'is-none' : 'is-guess'}" data-muscle-link="${esc(r.id)}" title="${esc(tip)}" aria-label="${esc(tip)}">${none ? '!' : '?'}</button>`;
  }
  const missing = (r.childIds || []).filter((id) => moves.get(id) && !moves.get(id).p.length).length;
  if (!missing) return '';
  const tip = `มี ${missing} ท่ายังไม่ผูกกล้าม · ขยายหมวดแล้วแตะ ! เพื่อเลือกกล้าม`;
  return `<span class="mt-link-mark is-none is-count" title="${esc(tip)}" aria-label="${esc(tip)}">!${missing > 1 ? missing : ''}</span>`;
}

function restCellHtml(t, r, moves, cardio, depthCls, leafCls) {
  const base = `mt-col-rest${depthCls}${leafCls}`;
  if (cardio || !r.leaf) return `<td class="${base}" data-node-id="${esc(r.id)}"></td>`;
  const info = rowRestInfo(t, r, moves);
  const days = info ? info.days : null;
  const last = info ? info.last : '';
  const step = info ? restStep(t.restScale, days) : null;
  if (!step) {
    return `<td class="${base} is-none" data-node-id="${esc(r.id)}" title="ยังไม่เคยเล่น"><span class="mt-rest-val">–</span></td>`;
  }
  const tip = days === 0
    ? `เล่นวันนี้ · ${step.label}`
    : `พักมา ${days} วัน (ล่าสุด ${formatMuscleColDate(last)}) · ${step.label}`;
  const left = restRemaining(days, info.rest);
  const restTip = left == null ? ''
    : ` · กล้ามนี้ควรพัก ${fmtRest(info.rest)} วัน · ${left > 0 ? `อีก ${fmtRest(left)} วัน` : 'ครบแล้ว'}`;
  const fadeCls = step.fade > 0 ? ' is-fading' : '';
  const fadeStyle = step.fade > 0 ? ` style="--rest-fade:${Math.round(step.fade * 100)}%"` : '';
  return `<td class="${base} rest-tone-${esc(step.tone)}${fadeCls}"${fadeStyle} data-node-id="${esc(r.id)}" title="${esc(tip + restTip)}">
    <span class="mt-rest-val"><b class="mt-rest-n">${days}</b><span class="mt-rest-lb">${esc(step.label)}</span></span>
  </td>`;
}

/**
 * Compact sticky muscle matrix HTML.
 * Columns: name | ครั้ง | พัก (sticky) | dates newest→oldest
 * Collapsed by default: groups only; pass expandAll or expandedIds for children.
 * @param {object} tree
 * @param {{
 *   dates?: string[],
 *   selectedId?: string,
 *   todayKey?: string,
 *   expandAll?: boolean,
 *   expandedIds?: string[]|Set<string>,
 * }} opts
 */
export function renderMuscleTableHtml(tree, opts = {}) {
  const t = normalizeMuscleTree(tree);
  const todayKey = opts.todayKey || muscleToDateKey();
  const dates = opts.dates || muscleDateKeys({ today: todayKey });
  const rows = flattenMuscleRows(t);
  const moves = new Map(muscleMoveStates(t, todayKey).map((m) => [m.id, m]));
  const sessionsById = new Map();
  Object.keys(t.cells).forEach((k) => {
    if (t.cells[k] > 0) sessionsById.set(k.split('|')[0], (sessionsById.get(k.split('|')[0]) || 0) + 1);
  });
  const byId = new Map(t.nodes.map((n) => [n.id, n]));
  const selectedId = opts.selectedId || '';
  const expandAll = Boolean(opts.expandAll);
  const expanded = opts.expandedIds instanceof Set
    ? opts.expandedIds
    : new Set(Array.isArray(opts.expandedIds) ? opts.expandedIds : []);
  const hidden = opts.hideIds instanceof Set ? opts.hideIds : new Set();

  const headDates = dates
    .map((dk) => {
      const todayCls = dk === todayKey ? ' is-today' : '';
      return `<th class="mt-col-date${todayCls}" data-date="${esc(dk)}">
        <span class="mt-col-wd">${esc(weekdayShortTh(dk))}</span>
        <span class="mt-col-dm">${esc(formatMuscleColDate(dk))}</span>
      </th>`;
    })
    .join('');

  const body = rows
    .map((r) => {
      const isGroup = !r.leaf && (r.childIds || []).length > 0;
      const collapsible = isGroup && !expandAll;
      const isChild = r.depth > 0;
      if (isChild) {
        const open = expandAll || expanded.has(r.parentId);
        if (!open || hidden.has(r.id)) return '';
      }
      const openGroup = isGroup && (expandAll || expanded.has(r.id));
      const sel = r.id === selectedId ? ' is-selected' : '';
      const depthCls = r.depth ? ' is-child' : ' is-parent';
      const leafCls = r.leaf ? ' is-leaf' : ' is-group';
      const cardio = nodeIsCardio(byId, byId.get(r.id));
      const doses = isGroup && !cardio ? groupDoseByDate(t, r, moves) : null;
      const sessions = isGroup ? 0 : (sessionsById.get(r.id) || 0);
      const cardioCls = cardio ? ' is-cardio' : '';
      const nameTitle = collapsible
        ? (openGroup ? 'แตะเพื่อหุบ' : 'แตะเพื่อขยาย')
        : cardio
          ? 'คาดิโอ · ใส่ kcal ที่เบิร์นจริง · หักออกจากดุลแคลวันนั้น'
          : 'ท่ากล้าม · ใส่ 1 = เล่นวันนั้น · ไม่นับแคล';
      const cardioTag = cardio && r.depth === 0 ? '<span class="mt-cardio-tag">kcal · หักดุล</span>' : '';
      const photo = r.leaf && !cardio ? exerciseImages(libraryExerciseByName(r.name))[0] : '';
      const photoBtn = photo
        ? `<button type="button" class="mt-ex-thumb" data-ex-photo="${esc(r.name)}" aria-label="${esc(`ดูท่า ${r.name}`)}"><img src="${esc(photo)}" alt="" loading="lazy" decoding="async"></button>`
        : '';
      const nameCell = `<th class="mt-row-name${depthCls}${leafCls}${sel}${cardioCls}${openGroup ? ' is-open' : ''}" scope="row" data-node-id="${esc(r.id)}">
        <div class="mt-name-row">${photoBtn}
          <button type="button" class="mt-name-btn${collapsible ? ' is-group-toggle' : ''}" data-node-id="${esc(r.id)}"${collapsible ? ' data-group-toggle="1"' : ''} title="${esc(nameTitle)}">
            <span class="mt-name-text">${esc(r.name)}</span>${cardioTag}
          </button>${muscleLinkMarkHtml(r, moves, cardio)}
        </div>
      </th>`;
      const countCell = `<td class="mt-col-count${depthCls}${leafCls}${sessions ? ' is-filled' : ''}" data-node-id="${esc(r.id)}"${isGroup ? '' : ` title="เล่นไป ${sessions} ครั้ง"`}>
        <span class="mt-count-val">${sessions || ''}</span>
      </td>`;

      const cells = dates
        .map((dk) => {
          if (!r.leaf) {
            // Cardio group shows the day's kcal cut; strength groups stay blank.
            const cut = cardio
              ? (r.childIds || []).reduce((s, id) => s + (t.cells[cellKey(id, dk)] || 0), 0)
              : 0;
            const cutHtml = cut > 0 ? `<span class="mt-cardio-cut" title="คาดิโอวันนี้ −${cut} kcal จากดุลแคล">−${cut}</span>` : '';
            const d = doses?.get(dk);
            const doseHtml = d
              ? `<span class="mt-dose${d.full ? '' : ' is-half'}" title="${esc(d.full ? `รวม ${fmtDose(d.dose)} ครั้ง` : 'โดนเป็นกล้ามรองจากท่าอื่น (½)')}">${fmtDose(d.dose)}</span>`
              : '';
            return `<td class="mt-cell is-sum${cardioCls}${dk === todayKey ? ' is-today' : ''}" data-date="${esc(dk)}">${cutHtml}${doseHtml}</td>`;
          }
          const val = t.cells[cellKey(r.id, dk)];
          const filled = val > 0 ? ' is-filled' : '';
          const aria = cardio ? `${r.name} ${dk} kcal ที่เบิร์น` : `${r.name} ${dk} เล่น`;
          const tip = cardio
            ? (val > 0 ? `เบิร์น ${val} kcal · หักออกจากดุลแคลวันนั้น` : 'ใส่ kcal ที่เบิร์นจริง')
            : 'ใส่ 1 = เล่นวันนั้น · ไม่นับแคล';
          return `<td class="mt-cell is-input${filled}${cardioCls}${dk === todayKey ? ' is-today' : ''}" data-node-id="${esc(r.id)}" data-date="${esc(dk)}" title="${esc(tip)}">
            <input class="mt-kcal" type="number" inputmode="numeric" min="0" max="5000" step="1"
              value="${val > 0 ? val : ''}" placeholder="" aria-label="${esc(aria)}"
              data-node-id="${esc(r.id)}" data-date="${esc(dk)}">
          </td>`;
        })
        .join('');

      return `<tr class="mt-row${depthCls}${leafCls}${sel}${cardioCls}${openGroup ? ' is-open' : ''}" data-node-id="${esc(r.id)}"${r.parentId ? ` data-parent-id="${esc(r.parentId)}"` : ''}>${nameCell}${countCell}${restCellHtml(t, r, moves, cardio, depthCls, leafCls)}${cells}</tr>`;
    })
    .join('');

  return `<table class="muscle-table" id="muscle-table" aria-label="ตารางกล้ามเนื้อรายวัน">
    <thead>
      <tr>
        <th class="mt-corner" scope="col">กล้ามเนื้อ</th>
        <th class="mt-col-count-head" scope="col" title="จำนวนครั้งที่เล่น (วันที่มีแคล)">ครั้ง</th>
        <th class="mt-col-rest-head" scope="col" title="พักมากี่วันแล้วนับจากครั้งล่าสุดของท่านั้น">พัก</th>
        ${headDates}
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

/** Rest days as a primary-hit equivalent, so a ½-rest secondary hit is toned by what's left. */
export function regionRestEquivDays(info) {
  if (!info) return null;
  if (info.via !== 's' || !(info.rest > 0) || !(info.full > 0)) return info.days;
  return Math.floor((info.days * info.full) / info.rest);
}

const muscleGroupRowId = (g) => `mg-${g.id}`;

/**
 * Moves that hit the given regions on one date: per move, primary (1) beats secondary (½).
 * @returns {{ name: string, w: number }[]}
 */
export function muscleHitsOn(tree, regionIds, dateKey, moves = null) {
  const t = normalizeMuscleTree(tree);
  const regions = new Set(regionIds);
  const list = moves || muscleMoveStates(t);
  const out = [];
  list.forEach((m) => {
    if (!(t.cells[cellKey(m.id, dateKey)] > 0)) return;
    const w = m.p.some((x) => regions.has(x)) ? 1 : m.s.some((x) => regions.has(x)) ? SECONDARY_DOSE : 0;
    if (w) out.push({ name: m.name, w });
  });
  return out.sort((a, b) => b.w - a.w);
}

/**
 * Muscle-first matrix: beginner groups → small muscles × dates.
 * Cell = sessions that day (primary 1, secondary ½ per move); ครั้ง = days hit as a primary.
 */
export function renderMuscleRegionTableHtml(tree, opts = {}) {
  const t = normalizeMuscleTree(tree);
  const todayKey = opts.todayKey || muscleToDateKey();
  const dates = opts.dates || muscleDateKeys({ today: todayKey });
  const moves = muscleMoveStates(t, todayKey);
  const restMap = computeRegionRest(moves, t.restProfile);
  const expandAll = Boolean(opts.expandAll);
  const expanded = opts.expandedIds instanceof Set
    ? opts.expandedIds
    : new Set(Array.isArray(opts.expandedIds) ? opts.expandedIds : []);
  const selectedId = opts.selectedId || '';

  // move id → dates it was logged (strength moves only)
  const datesByMove = new Map();
  Object.keys(t.cells).forEach((k) => {
    if (!(t.cells[k] > 0)) return;
    const [id, dk] = k.split('|');
    if (!datesByMove.has(id)) datesByMove.set(id, []);
    datesByMove.get(id).push(dk);
  });
  const doseFor = (regionIds) => {
    const regions = new Set(regionIds);
    const byDate = new Map();
    const primaryDays = new Set();
    moves.forEach((m) => {
      const w = m.p.some((x) => regions.has(x)) ? 1 : m.s.some((x) => regions.has(x)) ? SECONDARY_DOSE : 0;
      if (!w) return;
      (datesByMove.get(m.id) || []).forEach((dk) => {
        if (dk > todayKey) return;
        const prev = byDate.get(dk) || { dose: 0, full: false };
        byDate.set(dk, { dose: prev.dose + w, full: prev.full || w >= 1 });
        if (w >= 1) primaryDays.add(dk);
      });
    });
    return { byDate, count: primaryDays.size };
  };

  const headDates = dates
    .map((dk) => `<th class="mt-col-date${dk === todayKey ? ' is-today' : ''}" data-date="${esc(dk)}">
        <span class="mt-col-wd">${esc(weekdayShortTh(dk))}</span>
        <span class="mt-col-dm">${esc(formatMuscleColDate(dk))}</span>
      </th>`)
    .join('');

  const restCell = (regionIds, cls, id) => {
    // Group shows its least-recovered trained muscle.
    let best = null;
    regionIds.forEach((rid) => {
      const info = restMap.get(rid);
      const eq = regionRestEquivDays(info);
      if (eq == null) return;
      if (!best || eq < best.eq) best = { eq, info, rid };
    });
    const base = `mt-col-rest${cls}`;
    if (!best) return `<td class="${base} is-none" data-node-id="${esc(id)}" title="ยังไม่เคยโดน"><span class="mt-rest-val">–</span></td>`;
    const step = restStep(t.restScale, best.eq);
    const left = restRemaining(best.info.days, best.info.rest);
    const who = regionIds.length > 1 ? `${regionById(best.rid)?.name || ''} · ` : '';
    const tip = `${who}${best.info.days === 0 ? 'โดนวันนี้' : `พักมา ${best.info.days} วัน`}${best.info.via === 's' ? ' (กล้ามรอง พักครึ่งเดียว)' : ''}`
      + `${left == null ? '' : ` · ${left > 0 ? `อีก ${fmtRest(left)} วัน` : 'พักครบแล้ว'}`} · ${step.label}`;
    const fadeCls = step.fade > 0 ? ' is-fading' : '';
    const fadeStyle = step.fade > 0 ? ` style="--rest-fade:${Math.round(step.fade * 100)}%"` : '';
    return `<td class="${base} rest-tone-${esc(step.tone)}${fadeCls}"${fadeStyle} data-node-id="${esc(id)}" title="${esc(tip)}">
      <span class="mt-rest-val"><b class="mt-rest-n">${best.eq}</b><span class="mt-rest-lb">${esc(step.label)}</span></span>
    </td>`;
  };

  const rowHtml = ({ id, name, regionIds, isGroup, open }) => {
    const depthCls = isGroup ? ' is-parent' : ' is-child';
    const leafCls = isGroup ? ' is-group' : ' is-leaf';
    const sel = id === selectedId ? ' is-selected' : '';
    const { byDate, count } = doseFor(regionIds);
    const toggle = isGroup && !expandAll;
    const nameAttrs = isGroup
      ? (toggle ? ` data-group-toggle="1" title="${open ? 'แตะเพื่อหุบ' : 'แตะเพื่อขยายเป็นกล้ามเล็ก'}"` : '')
      : ` data-muscle-region="${esc(regionIds[0])}" title="แตะเพื่อดูท่าที่ใช้กล้ามนี้และวันพัก"`;
    const cells = dates.map((dk) => {
      const d = byDate.get(dk);
      const doseHtml = d
        ? `<span class="mt-dose${d.full ? '' : ' is-half'}">${fmtDose(d.dose)}</span>`
        : '';
      return `<td class="mt-cell is-sum${dk === todayKey ? ' is-today' : ''}${d ? ' is-hit' : ''}" data-date="${esc(dk)}"${d ? ` data-mv-hit="${esc(regionIds.join(','))}" data-mv-name="${esc(name)}"` : ''}>${doseHtml}</td>`;
    }).join('');
    return `<tr class="mt-row${depthCls}${leafCls}${sel}${open ? ' is-open' : ''}" data-node-id="${esc(id)}">
      <th class="mt-row-name${depthCls}${leafCls}${sel}${open ? ' is-open' : ''}" scope="row" data-node-id="${esc(id)}">
        <div class="mt-name-row">
          <button type="button" class="mt-name-btn${toggle ? ' is-group-toggle' : ''}" data-node-id="${esc(id)}"${nameAttrs}>
            <span class="mt-name-text">${esc(name)}</span>
          </button>
        </div>
      </th>
      <td class="mt-col-count${depthCls}${leafCls}${count ? ' is-filled' : ''}" data-node-id="${esc(id)}" title="โดนเป็นกล้ามหลัก ${count} วัน"><span class="mt-count-val">${count || ''}</span></td>
      ${restCell(regionIds, `${depthCls}${leafCls}`, id)}
      ${cells}
    </tr>`;
  };

  const body = BEGINNER_GROUPS.map((g) => {
    const id = muscleGroupRowId(g);
    const open = expandAll || expanded.has(id);
    let html = rowHtml({ id, name: g.name, regionIds: g.regions, isGroup: true, open });
    if (open) {
      g.regions.forEach((rid) => {
        const region = regionById(rid);
        if (region) html += rowHtml({ id: `mr-${rid}`, name: region.name, regionIds: [rid], isGroup: false, open: false });
      });
    }
    return html;
  }).join('');

  return `<table class="muscle-table is-muscle-view" id="muscle-table" aria-label="ตารางกล้ามเนื้อรายวัน (มุมมองกล้าม)">
    <thead>
      <tr>
        <th class="mt-corner" scope="col">กล้ามเนื้อ</th>
        <th class="mt-col-count-head" scope="col" title="จำนวนวันที่โดนเป็นกล้ามหลัก">วัน</th>
        <th class="mt-col-rest-head" scope="col" title="พักมากี่วันแล้ว (กลุ่ม = กล้ามที่ยังล้าที่สุด)">พัก</th>
        ${headDates}
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

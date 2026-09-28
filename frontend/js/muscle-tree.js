/**
 * Muscle tree log — hierarchical groups × date columns (newest → oldest).
 * Leaf cells store burn kcal; parents show per-day sums.
 * Day.exercises sync is applied by the caller (calorie helpers).
 */

import {
  BEGINNER_GROUPS,
  UNSPECIFIED_MOVE,
  computeRegionRest,
  normalizeRestProfile,
  readinessSlot,
  regionRestDays,
  resolveMoveMuscles,
  sanitizeRegionIds,
  REST_READY_SLOT,
} from './muscle-map.js?v=310';

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

function clampName(raw) {
  return String(raw || '').trim().slice(0, MUSCLE_NAME_MAX);
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
      <button type="button" class="rest-edit-tone rest-tone-${esc(st.tone)}${i === REST_SCALE_DAYS - 1 ? ' is-fade' : ''}" data-rest-tone="${i}"
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

export function isCardioNode(tree, nodeId) {
  const t = normalizeMuscleTree(tree);
  const node = t.nodes.find((n) => n.id === nodeId);
  if (!node) return false;
  if (CARDIO_NAME_RE.test(node.name)) return true;
  const parent = node.parentId ? t.nodes.find((n) => n.id === node.parentId) : null;
  return Boolean(parent && CARDIO_NAME_RE.test(parent.name));
}

/** Labels that belong to the current tree (used to rebuild day.exercises). */
export function muscleTreeLabels(tree) {
  const rows = flattenMuscleRows(tree);
  const labels = new Set();
  rows.forEach((r) => {
    if (!r.leaf) return;
    labels.add(r.name);
    labels.add(leafLabelPath(tree, r.id));
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
 * Strength moves (leaves, cardio excluded) with resolved muscles and days since last trained.
 * @returns {{ id, name, parentId, parentName, p: string[], s: string[], source, days: number|null, last: string }[]}
 */
export function muscleMoveStates(tree, todayKey = muscleToDateKey()) {
  const t = normalizeMuscleTree(tree);
  return flattenMuscleRows(t)
    .filter((r) => r.leaf && !isCardioNode(t, r.id))
    .map((r) => {
      const parent = r.parentId ? t.nodes.find((n) => n.id === r.parentId) : null;
      const node = t.nodes.find((n) => n.id === r.id);
      const m = resolveMoveMuscles(node, parent?.name || '');
      const last = lastTrainedDate(t, r.id, todayKey);
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

/** Days a move needs = slowest-recovering primary muscle (plain days when muscles are unknown). */
function moveRestDays(t, move) {
  if (!move.p.length) return REST_READY_SLOT;
  return Math.max(...move.p.map((id) => regionRestDays(t.restProfile, id)));
}

/** Least-recovered move under a row (the row itself when it is a move). */
function rowRestInfo(t, r, moves) {
  const ids = r.leaf ? [r.id] : (r.childIds || []);
  let best = null;
  ids.forEach((id) => {
    const m = moves.get(id);
    if (!m || m.days == null) return;
    const rest = moveRestDays(t, m);
    const slot = readinessSlot(m.days, rest);
    if (!best || slot < best.slot) best = { days: m.days, last: m.last, slot, rest };
  });
  return best;
}

function fmtRest(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function restCellHtml(t, r, moves, cardio, depthCls, leafCls) {
  const base = `mt-col-rest${depthCls}${leafCls}`;
  if (cardio) return `<td class="${base}" data-node-id="${esc(r.id)}"></td>`;
  const info = rowRestInfo(t, r, moves);
  const days = info ? info.days : null;
  const last = info ? info.last : '';
  const step = info ? restStep(t.restScale, info.slot) : null;
  if (!step) {
    return `<td class="${base} is-none" data-node-id="${esc(r.id)}" title="ยังไม่เคยเล่น"><span class="mt-rest-val">–</span></td>`;
  }
  const tip = days === 0
    ? `เล่นวันนี้ · ${step.label}`
    : `พักมา ${days} วัน (ล่าสุด ${formatMuscleColDate(last)}) · ${step.label}`;
  const restTip = info.rest !== REST_READY_SLOT ? ` · กล้ามนี้พร้อมใน ${fmtRest(info.rest)} วัน` : '';
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
  const selectedId = opts.selectedId || '';
  const expandAll = Boolean(opts.expandAll);
  const expanded = opts.expandedIds instanceof Set
    ? opts.expandedIds
    : new Set(Array.isArray(opts.expandedIds) ? opts.expandedIds : []);

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
        if (!open) return '';
      }
      const openGroup = isGroup && (expandAll || expanded.has(r.id));
      const sel = r.id === selectedId ? ' is-selected' : '';
      const depthCls = r.depth ? ' is-child' : ' is-parent';
      const leafCls = r.leaf ? ' is-leaf' : ' is-group';
      const sessions = isGroup ? 0 : countMuscleSessions(t, r.id);
      const cardio = isCardioNode(t, r.id);
      const cardioCls = cardio ? ' is-cardio' : '';
      const nameTitle = collapsible
        ? (openGroup ? 'แตะเพื่อหุบ' : 'แตะเพื่อขยาย')
        : cardio
          ? 'คาดิโอ · ใส่ kcal ที่เบิร์นจริง · หักออกจากดุลแคลวันนั้น'
          : 'ท่ากล้าม · ใส่ 1 = เล่นวันนั้น · ไม่นับแคล';
      const cardioTag = cardio && r.depth === 0 ? '<span class="mt-cardio-tag">kcal · หักดุล</span>' : '';
      const nameCell = `<th class="mt-row-name${depthCls}${leafCls}${sel}${cardioCls}${openGroup ? ' is-open' : ''}" scope="row" data-node-id="${esc(r.id)}">
        <div class="mt-name-row">
          <button type="button" class="mt-name-btn${collapsible ? ' is-group-toggle' : ''}" data-node-id="${esc(r.id)}"${collapsible ? ' data-group-toggle="1"' : ''} title="${esc(nameTitle)}">
            <span class="mt-name-text">${esc(r.name)}</span>${cardioTag}
          </button>
        </div>
      </th>`;
      const countCell = `<td class="mt-col-count${depthCls}${leafCls}${sessions ? ' is-filled' : ''}" data-node-id="${esc(r.id)}"${isGroup ? '' : ` title="เล่นไป ${sessions} ครั้ง"`}>
        <span class="mt-count-val">${sessions ? sessions : ''}</span>
      </td>`;

      const cells = dates
        .map((dk) => {
          if (!r.leaf) {
            // Cardio group shows the day's kcal cut; strength groups stay blank.
            const cut = cardio
              ? (r.childIds || []).reduce((s, id) => s + (t.cells[cellKey(id, dk)] || 0), 0)
              : 0;
            const cutHtml = cut > 0 ? `<span class="mt-cardio-cut" title="คาดิโอวันนี้ −${cut} kcal จากดุลแคล">−${cut}</span>` : '';
            return `<td class="mt-cell is-sum${cardioCls}${dk === todayKey ? ' is-today' : ''}" data-date="${esc(dk)}">${cutHtml}</td>`;
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
        <th class="mt-col-rest-head" scope="col" title="พักมากี่วันแล้วนับจากครั้งล่าสุด · หมวด = ส่วนที่เพิ่งเล่นล่าสุด">พัก</th>
        ${headDates}
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

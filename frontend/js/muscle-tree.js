/**
 * Muscle log — 10 fixed groups → small muscles × date columns (newest → oldest), plus cardio.
 * Muscle cells store 1 (main) / 2 (secondary); cardio cells store kcal burned.
 * Day.exercises sync is applied by the caller (calorie helpers).
 */

import {
  BEGINNER_GROUPS,
  UNSPECIFIED_MOVE,
  libraryExerciseByName,
  computeRegionRest,
  normalizeRestProfile,
  resolveMoveMuscles,
  sanitizeRegionIds,
  restRemaining,
  regionById,
} from './muscle-map.js?v=331';
import { nowIso, nowMs as clockNowMs } from './clock.js?v=331';

export const MUSCLE_DATE_COLS = 30;
export const MUSCLE_NAME_MAX = 40;

const CARDIO_SEED = { id: 'bg-cardio', name: 'คาร์ดิโอ', moves: ['วิ่ง', 'เดิน', 'ปั่นจักรยาน'] };

/** Muscle rows store 1 = worked as a main muscle, 2 = worked as a secondary muscle. */
export const MARK_MAIN = 1;
export const MARK_SECONDARY = 2;

const REGION_LEAF = 'r-';

export function regionLeafId(regionId) {
  return `${REGION_LEAF}${regionId}`;
}

/** Region id of a muscle row ('' for groups, cardio and old move rows). */
export function regionOfLeaf(nodeId) {
  const s = String(nodeId || '');
  return s.startsWith(REGION_LEAF) && regionById(s.slice(REGION_LEAF.length)) ? s.slice(REGION_LEAF.length) : '';
}

/** Fixed rows: the 10 beginner groups, each with its small muscles. */
function layoutNodes() {
  const out = [];
  BEGINNER_GROUPS.forEach((g, i) => {
    out.push({ id: g.id, name: g.name, parentId: null, order: i });
    g.regions.forEach((rid, j) => {
      out.push({ id: regionLeafId(rid), name: clampName(regionById(rid).name), parentId: g.id, order: j, p: [rid], s: [] });
    });
  });
  return out;
}

/** Seed tree: the fixed muscle rows plus cardio. */
export function defaultMuscleNodes() {
  const out = layoutNodes();
  out.push({ id: CARDIO_SEED.id, name: CARDIO_SEED.name, parentId: null, order: BEGINNER_GROUPS.length });
  CARDIO_SEED.moves.forEach((name, j) => out.push({ id: `${CARDIO_SEED.id}-${j}`, name, parentId: CARDIO_SEED.id, order: j }));
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

/** Day-cell label key: cut to 40 chars the same way parseExerciseCell does (cut, then trim). */
export function labelKey(raw) {
  return String(raw || '').slice(0, MUSCLE_NAME_MAX).trim();
}

function clampKcal(raw) {
  if (raw == null || raw === '') return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(5000, n);
}

function nowIsoLocal() {
  try {
    return nowIso();
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
  const at = stampMs(raw.at);
  if (at) node.at = at;
  return node;
}

function stampMs(raw) {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Edit stamps older than this are forgotten (deleted rows/cells can no longer come back after that). */
const TOMBSTONE_KEEP_MS = 180 * 86400000;

function normalizeStampMap(raw, keep = () => true) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.keys(raw).forEach((k) => {
    const at = stampMs(raw[k]);
    if (at && keep(k, at)) out[k] = at;
  });
  return out;
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

/** Trees returned by normalizeMuscleTree; they are never mutated, so re-normalizing is a no-op. */
const NORMALIZED = new WeakSet();

export function normalizeMuscleTree(raw) {
  if (raw && NORMALIZED.has(raw)) return raw;
  const out = normalizeMuscleTreeFresh(raw);
  NORMALIZED.add(out);
  return out;
}

function normalizeMuscleTreeFresh(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  let nodes = (Array.isArray(src.nodes) ? src.nodes : [])
    .map(normalizeMuscleNode)
    .filter(Boolean);
  if (!nodes.length) {
    const legacy = Object.keys(src.cells || {}).some((k) => k.startsWith('m-'));
    nodes = legacy ? legacyMuscleNodes() : defaultMuscleNodes();
  }
  const regionNames = normalizeRegionNames(src.regionNames);
  // Muscle rows show the user's name for the region, else the region table's (which may change between builds).
  nodes = nodes.map((n) => {
    const rid = regionOfLeaf(n.id);
    const name = rid ? clampName(regionNames?.[rid]?.name || regionById(rid).name) : n.name;
    return name && name !== n.name ? { ...n, name } : n;
  });

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

  const cutoff = clockNowMs() - TOMBSTONE_KEEP_MS;
  const out = {
    nodes: ordered,
    cells,
    restScale: normalizeRestScale(src.restScale),
    restProfile: normalizeRestProfile(src.restProfile),
    updatedAt: String(src.updatedAt || '').trim(),
  };
  // Per-cell edit stamps (ms) let two devices merge cell by cell; a stamp without a value = cleared.
  const cellAt = normalizeStampMap(src.cellAt, (k, at) => k.includes('|') && (cells[k] != null || at > cutoff));
  const removed = normalizeStampMap(src.removed, (id, at) => !idSet.has(id) && at > cutoff);
  if (Object.keys(cellAt).length) out.cellAt = cellAt;
  if (Object.keys(removed).length) out.removed = removed;
  const aliases = normalizeAliases(src.aliases, idSet, cutoff);
  if (aliases) out.aliases = aliases;
  const moveLog = normalizeMoveLog(src.moveLog, cutoff);
  if (moveLog) out.moveLog = moveLog;
  if (regionNames) out.regionNames = regionNames;
  return out;
}

/** User names for muscle rows: { regionId: { name, at } }; an empty name = back to the standard one. */
function normalizeRegionNames(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  Object.keys(raw).forEach((rid) => {
    if (!regionById(rid)) return;
    const at = stampMs(raw[rid]?.at);
    if (!at) return;
    out[rid] = { name: clampName(raw[rid]?.name || ''), at };
  });
  return Object.keys(out).length ? out : null;
}

/** Name shown for a muscle row (user's name, else standard). */
export function regionLabel(tree, rid) {
  const t = normalizeMuscleTree(tree);
  return t.regionNames?.[rid]?.name || regionById(rid)?.name || '';
}

/** Rename a muscle row; '' or the standard name resets it. */
export function setRegionName(tree, rid, name, nowMs = clockNowMs()) {
  const t = normalizeMuscleTree(tree);
  if (!regionById(rid)) return t;
  const clean = clampName(name || '');
  const value = clean === regionById(rid).name ? '' : clean;
  const regionNames = { ...(t.regionNames || {}), [rid]: { name: value, at: nowMs } };
  return normalizeMuscleTree({ ...t, regionNames, updatedAt: nowIsoLocal() });
}

const MOVE_LOG_MAX = 30;

/**
 * Move names per date (guide only, not counted): { 'YYYY-MM-DD': { names, at } }.
 * An entry with no names is a cleared date, kept until its stamp is old.
 */
function normalizeMoveLog(raw, cutoff) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  Object.keys(raw).forEach((dk) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) return;
    const at = stampMs(raw[dk]?.at);
    if (!at) return;
    const names = [...new Set((Array.isArray(raw[dk]?.names) ? raw[dk].names : []).map(clampName).filter(Boolean))]
      .slice(0, MOVE_LOG_MAX);
    if (!names.length && !(at > cutoff)) return;
    out[dk] = { names, at };
  });
  return Object.keys(out).length ? out : null;
}

export function moveLogNames(tree, dateKey) {
  return normalizeMuscleTree(tree).moveLog?.[dateKey]?.names || [];
}

/** Set a date's move names (empty list clears it). */
export function setMoveLogNames(tree, dateKey, names, nowMs = clockNowMs()) {
  const t = normalizeMuscleTree(tree);
  const moveLog = { ...(t.moveLog || {}), [dateKey]: { names, at: nowMs } };
  return normalizeMuscleTree({ ...t, moveLog, updatedAt: nowIsoLocal() });
}

function normalizeAliases(raw, idSet, cutoff) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  Object.keys(raw).forEach((k) => {
    const label = labelKey(k);
    const id = String(raw[k]?.id || '');
    const at = stampMs(raw[k]?.at);
    if (!label || !idSet.has(id) || !(at > cutoff)) return;
    if (!out[label] || out[label].at < at) out[label] = { id, at };
  });
  return Object.keys(out).length ? out : null;
}

const nodeSig = (n) => `${n.name}|${n.parentId || ''}|${n.p ? n.p.join(',') : '-'}|${n.s ? n.s.join(',') : '-'}`;

/**
 * Siblings (kept in both versions) placed before a node. Deleting or moving a neighbour
 * renumbers `order` without changing this, so only rows the user actually moved get stamped.
 */
function siblingsBefore(tree, node, keep) {
  return tree.nodes
    .filter((n) => n.parentId === node.parentId && n.order < node.order && keep.has(n.id))
    .map((n) => n.id)
    .sort()
    .join(',');
}

/**
 * Old day-cell label → leaf id, for leaves whose label changed (rename, move, group rename),
 * so day rows written with the old label can be matched to the leaf later (even from sync).
 */
export function recordMuscleLabelAliases(prevRaw, nextRaw, nowMs = clockNowMs()) {
  const prev = normalizeMuscleTree(prevRaw);
  const next = normalizeMuscleTree(nextRaw);
  if (prev === next) return next;
  const nextIdx = muscleLeafIndex(next);
  const aliases = { ...(next.aliases || {}) };
  let changed = false;
  muscleLeafIndex(prev).leaves.forEach((l) => {
    const now = nextIdx.byId.get(l.id);
    if (!now || now.label === l.label || nextIdx.byLabel.has(l.label)) return;
    if (aliases[l.label]?.id === l.id) return;
    aliases[l.label] = { id: l.id, at: nowMs };
    changed = true;
  });
  return changed ? normalizeMuscleTree({ ...next, aliases }) : next;
}

/**
 * Stamp what changed between two versions of the tree (nodes, cells, removed rows) so
 * mergeMuscleTreeField can keep edits from both devices. Call once per local save.
 */
export function stampMuscleTreeChanges(prevRaw, nextRaw, nowMs = clockNowMs()) {
  const prev = normalizeMuscleTree(prevRaw);
  const next = normalizeMuscleTree(recordMuscleLabelAliases(prevRaw, nextRaw, nowMs));
  if (prev === next) return next;
  let changed = next !== normalizeMuscleTree(nextRaw);
  const prevById = new Map(prev.nodes.map((n) => [n.id, n]));
  const nextIds = new Set(next.nodes.map((n) => n.id));
  const inBoth = new Set(prev.nodes.filter((n) => nextIds.has(n.id)).map((n) => n.id));
  const removed = { ...(next.removed || {}) };
  const nodes = next.nodes.map((n) => {
    const p = prevById.get(n.id);
    const same = p && nodeSig(p) === nodeSig(n)
      && siblingsBefore(prev, p, inBoth) === siblingsBefore(next, n, inBoth);
    if (same) return n.at || !p.at ? n : { ...n, at: p.at };
    changed = true;
    delete removed[n.id];
    return { ...n, at: nowMs };
  });
  prev.nodes.forEach((n) => {
    if (nextIds.has(n.id)) return;
    removed[n.id] = nowMs;
    changed = true;
  });
  const cellAt = { ...(prev.cellAt || {}), ...(next.cellAt || {}) };
  new Set([...Object.keys(prev.cells), ...Object.keys(next.cells)]).forEach((k) => {
    if (prev.cells[k] === next.cells[k]) return;
    cellAt[k] = nowMs;
    changed = true;
  });
  if (!changed) return next;
  return normalizeMuscleTree({ ...next, nodes, cellAt, removed });
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

const cellsOf = (cells, id) => Object.keys(cells).filter((k) => k.startsWith(`${id}|`));

/**
 * Fold the tree into the fixed muscle rows: each strength move's marks become marks on its
 * main muscles (1) and secondary muscles (2, unless already main that day), and its name is
 * kept in that date's move log. Cardio groups and moves stay as they are (stray cardio moves
 * go under a cardio group). Ids are fixed, so two devices converting apart end up the same.
 * @returns {{ tree: object, touchDates: string[], changed: boolean, folded: number }}
 */
export function toMuscleLayout(tree, nowMs = clockNowMs()) {
  const t = normalizeMuscleTree(tree);
  const byId = new Map(t.nodes.map((n) => [n.id, n]));
  const want = layoutNodes();
  const wantIds = new Set(want.map((n) => n.id));
  const cells = { ...t.cells };
  const touch = new Set();
  const logged = new Map();
  const hasKids = (id) => t.nodes.some((c) => c.parentId === id);

  const cardioRoots = t.nodes.filter((n) => !n.parentId && !wantIds.has(n.id) && isCardioName(n.name));
  const cardioRootIds = new Set(cardioRoots.map((r) => r.id));
  const extraNodes = cardioRoots.map((r) => ({ ...r }));
  let home = cardioRoots.find((r) => hasKids(r.id) || !cellsOf(t.cells, r.id).length) || null;

  const markRegion = (rid, dk, v) => {
    const key = cellKey(regionLeafId(rid), dk);
    const cur = cells[key];
    if (cur > 0 && (cur !== MARK_SECONDARY || v === MARK_SECONDARY)) return;
    cells[key] = v;
    touch.add(dk);
  };

  let folded = 0;
  const fold = (id, m, label) => {
    const keys = cellsOf(t.cells, id).filter((k) => t.cells[k] > 0);
    if (!keys.length) return;
    folded += 1;
    keys.forEach((k) => {
      const dk = k.split('|')[1];
      m.p.forEach((rid) => markRegion(rid, dk, MARK_MAIN));
      m.s.forEach((rid) => markRegion(rid, dk, MARK_SECONDARY));
      if (!logged.has(dk)) logged.set(dk, []);
      logged.get(dk).push(label);
      touch.add(dk);
    });
  };
  const groupById = new Map(BEGINNER_GROUPS.map((g) => [g.id, g]));
  t.nodes.forEach((n) => {
    const group = groupById.get(n.id);
    if (group && !hasKids(n.id)) {
      // A fixed group that was itself logged as a move: read it like a "ไม่ระบุท่า" row of that group.
      const r = resolveTreeMove({ ...n, name: UNSPECIFIED_MOVE }, n.name);
      fold(n.id, r.p.length ? r : { p: [...group.regions], s: [] }, n.name);
      cellsOf(t.cells, n.id).forEach((k) => { delete cells[k]; });
      return;
    }
    if (wantIds.has(n.id) || cardioRootIds.has(n.id)) return;
    const parent = n.parentId ? byId.get(n.parentId) : null;
    if (n.parentId && cardioRootIds.has(n.parentId)) {
      extraNodes.push({ ...n });
      return;
    }
    if (!n.parentId && hasKids(n.id)) return;
    if (isCardioMove(n.name, parent?.name || '')) {
      if (!home) {
        home = { id: CARDIO_SEED.id, name: CARDIO_SEED.name, parentId: null, order: 0 };
        extraNodes.unshift(home);
      }
      extraNodes.push({ ...n, parentId: home.id, order: 1000 + n.order });
      return;
    }
    fold(n.id, resolveTreeMove(n, parent?.name || ''), n.name === UNSPECIFIED_MOVE && parent ? parent.name : n.name);
  });
  // A folded cardio-root move (childless root holding its own kcal) keeps its place.
  if (home && !extraNodes.includes(home) && !cardioRootIds.has(home.id)) extraNodes.unshift(home);

  const nodes = [
    ...want.map((w) => {
      const n = byId.get(w.id);
      return n?.at ? { ...w, at: n.at } : w;
    }),
    ...extraNodes.map((n) => (n.parentId ? n : { ...n, order: BEGINNER_GROUPS.length + n.order / 1000 })),
  ];
  const moveLog = { ...(t.moveLog || {}) };
  logged.forEach((names, dk) => {
    moveLog[dk] = { names: [...(moveLog[dk]?.names || []), ...names], at: nowMs };
  });
  const next = normalizeMuscleTree({ ...t, nodes, cells, moveLog });
  const shape = (x) => JSON.stringify(x.nodes.map(({ at: _at, ...n }) => n));
  const changed = folded > 0 || shape(next) !== shape(t) || JSON.stringify(next.cells) !== JSON.stringify(t.cells);
  if (!changed) return { tree: t, touchDates: [], changed: false, folded: 0 };
  Object.keys(t.cells).forEach((k) => {
    if (next.cells[k] == null) touch.add(k.split('|')[1]);
  });
  // Day rows still carry the old labels of moved rows until the converted tree is saved.
  const aliased = recordMuscleLabelAliases(t, next, nowMs);
  return {
    tree: normalizeMuscleTree({ ...aliased, updatedAt: nowIsoLocal() }),
    touchDates: [...touch].sort(),
    changed: true,
    folded,
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
  const lScore = lt.nodes.length + Object.keys(lt.cells).length;
  const rScore = rt.nodes.length + Object.keys(rt.cells).length;
  const rNewer = rAt > lAt || (rAt === lAt && rScore > lScore);
  const [a, b] = rNewer ? [rt, lt] : [lt, rt];
  const at = rNewer
    ? (remote?.muscleTreeAt || rt.updatedAt || local?.muscleTreeAt || '')
    : (local?.muscleTreeAt || lt.updatedAt || remote?.muscleTreeAt || '');
  return { muscleTree: mergeMuscleTrees(a, b, rNewer ? rAt : lAt), muscleTreeAt: at };
}

function treeContentKey(tree) {
  const t = normalizeMuscleTree(tree);
  return JSON.stringify([
    t.nodes.map(({ at: _at, ...n }) => n),
    t.cells,
    t.restScale,
    t.restProfile,
    t.moveLog || null,
    t.regionNames || null,
  ]);
}

/** True when merging the local tree into the remote one changes it (so it must be pushed). */
export function muscleTreeNeedsPush(localCalorie, remoteCalorie) {
  if (!localCalorie?.muscleTree) return false;
  const merged = mergeMuscleTreeField(localCalorie, remoteCalorie || {}).muscleTree;
  return treeContentKey(merged) !== treeContentKey(remoteCalorie?.muscleTree);
}

const hasStamps = (t) => Boolean(t.cellAt || t.removed || t.aliases || t.moveLog || t.regionNames || t.nodes.some((n) => n.at));

/**
 * A tree from a build before stamps (it strips them) that was saved last: every row and cell
 * in it, and every row/cell it no longer has, counts as edited when it was saved.
 */
function stampWholeTree(a, b, atMs) {
  const aIds = new Set(a.nodes.map((n) => n.id));
  const removed = {};
  b.nodes.forEach((n) => { if (!aIds.has(n.id)) removed[n.id] = atMs; });
  const cellAt = {};
  [...Object.keys(a.cells), ...Object.keys(b.cells), ...Object.keys(b.cellAt || {})].forEach((k) => { cellAt[k] = atMs; });
  return { ...a, nodes: a.nodes.map((n) => ({ ...n, at: atMs })), cellAt, removed };
}

/**
 * Row by row and cell by cell, the newer stamp wins; unstamped items follow `a` (the tree
 * saved last), so data from builds before stamps merges exactly as before.
 * aAtMs = when `a` was saved; used when `a` comes from a build that drops stamps.
 */
export function mergeMuscleTrees(aRaw, bRaw, aAtMs = 0) {
  let a = normalizeMuscleTree(aRaw);
  const b = normalizeMuscleTree(bRaw);
  if (a === b || (!hasStamps(a) && !hasStamps(b))) return a;
  if (!hasStamps(a) && aAtMs > 0) a = stampWholeTree(a, b, aAtMs);
  const aRemoved = a.removed || {};
  const bRemoved = b.removed || {};
  const aById = new Map(a.nodes.map((n) => [n.id, n]));
  const bById = new Map(b.nodes.map((n) => [n.id, n]));
  const aCellAt = a.cellAt || {};
  const bCellAt = b.cellAt || {};
  const cells = {};
  const cellAt = {};
  const liveAt = new Map();
  new Set([...Object.keys(a.cells), ...Object.keys(b.cells), ...Object.keys(aCellAt), ...Object.keys(bCellAt)]).forEach((k) => {
    const aStamp = aCellAt[k] || 0;
    const bStamp = bCellAt[k] || 0;
    const val = bStamp > aStamp ? b.cells[k] : a.cells[k];
    if (val != null) cells[k] = val;
    if (aStamp || bStamp) cellAt[k] = Math.max(aStamp, bStamp);
    const id = k.split('|')[0];
    if (val != null && cellAt[k] > (liveAt.get(id) || 0)) liveAt.set(id, cellAt[k]);
  });
  const nodes = [];
  const kept = new Set();
  const revived = [];
  new Set([...aById.keys(), ...bById.keys(), ...Object.keys(aRemoved), ...Object.keys(bRemoved)]).forEach((id) => {
    const an = aById.get(id);
    const bn = bById.get(id);
    const aStamp = an ? an.at || 0 : aRemoved[id] || 0;
    const bStamp = bn ? bn.at || 0 : bRemoved[id] || 0;
    let win = bStamp > aStamp ? bn : an;
    // A row removed on one device but marked later on the other stays, so the next layout pass folds that mark.
    if (!win && (an || bn) && (liveAt.get(id) || 0) > Math.max(aStamp, bStamp)) {
      win = an || bn;
      revived.push([win, an ? aById : bById]);
    }
    if (!win) return;
    nodes.push(win);
    kept.add(id);
  });
  revived.forEach(([n, from]) => {
    const parent = n.parentId && !kept.has(n.parentId) ? from.get(n.parentId) : null;
    if (!parent) return;
    nodes.push(parent);
    kept.add(parent.id);
  });
  const removed = { ...aRemoved };
  Object.keys(bRemoved).forEach((id) => { removed[id] = Math.max(removed[id] || 0, bRemoved[id]); });
  const aliases = { ...(b.aliases || {}) };
  Object.entries(a.aliases || {}).forEach(([k, v]) => { if (!aliases[k] || aliases[k].at <= v.at) aliases[k] = v; });
  const moveLog = { ...(b.moveLog || {}) };
  Object.entries(a.moveLog || {}).forEach(([k, v]) => { if (!moveLog[k] || moveLog[k].at <= v.at) moveLog[k] = v; });
  const regionNames = { ...(b.regionNames || {}) };
  Object.entries(a.regionNames || {}).forEach(([k, v]) => { if (!regionNames[k] || regionNames[k].at <= v.at) regionNames[k] = v; });
  return normalizeMuscleTree({ ...a, nodes, cells, cellAt, removed, aliases, moveLog, regionNames });
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
export const CARDIO_NAME_RE = new RegExp([
  'คาดิโอ|คาร์ดิโอ|cardio|วิ่ง|เดิน|ปั่น|จักรยาน|ว่ายน้ำ|กระโดดเชือก|พายเรือ|เครื่องพาย|เอลลิป|ขึ้นบันได|สเต็ปเปอร์',
  'treadmill|elliptical|cross[\\s-]*trainer|rowing|rower|ergometer|\\berg\\b|\\bbike\\b|bicycle|cycling|\\bspin(ning)?\\b',
  'swim|jump[\\s-]*rope|skipping|stair|stepper|\\bjog|\\brun(ning)?\\b|\\bwalk(ing)?\\b|\\bhiit\\b|aerobic|zumba',
].join('|'), 'i');

/**
 * Names build 324 already treated as cardio. Moves saved before 325 under a strength group
 * (e.g. "Treadmill" logged as 1 = a mark) must keep meaning the same thing.
 */
const LEGACY_CARDIO_NAME_RE = /คาดิโอ|คาร์ดิโอ|cardio|วิ่ง|เดิน|ปั่น|จักรยาน|ว่ายน้ำ|กระโดดเชือก/i;

/** Words that make an otherwise cardio-sounding name a lift (walking lunge, farmer walk…). */
const STRENGTH_WORD_RE = /\b(lunges?|carry|farmers?|curls?|press|squats?|raises?|crunch(es)?)\b|ลันจ์/i;

/** Cardio by name, except library strength moves that merely contain เดิน/ปั่น (เดินถือดัมเบล…). */
export function isCardioName(name) {
  return CARDIO_NAME_RE.test(name) && !STRENGTH_WORD_RE.test(name) && !libraryExerciseByName(name);
}

/**
 * Cardio for a leaf name under an optional parent name (a cardio parent makes every child cardio).
 * Outside a cardio group only the pre-325 names count, so older strength rows keep their meaning.
 */
export function isCardioMove(name, parentName = '') {
  if (parentName && isCardioName(parentName)) return true;
  return LEGACY_CARDIO_NAME_RE.test(name) && !libraryExerciseByName(name);
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
  return new Set(muscleLeafIndex(tree).byLabel.keys());
}

/**
 * Leaf exercise slots for one date: [{ burn, label, cardio, value }].
 * Strength marks burn 0 kcal; only cardio cells carry burn.
 */
export function muscleSlotsForDate(tree, dateKey) {
  const t = normalizeMuscleTree(tree);
  const out = [];
  muscleLeafIndex(t).leaves.forEach((leaf) => {
    const value = t.cells[cellKey(leaf.id, dateKey)];
    if (!(value > 0)) return;
    out.push({ burn: leaf.cardio ? value : 0, label: leaf.label, cardio: leaf.cardio, value, id: leaf.id });
  });
  return out;
}

const LEAF_INDEX = new WeakMap();

/**
 * Loggable leaves in table order, built once per normalized tree.
 * byLabel: day-cell label (40 chars) → leaves using it (a bare name maps only when unique).
 */
export function muscleLeafIndex(tree) {
  const t = normalizeMuscleTree(tree);
  const hit = LEAF_INDEX.get(t);
  if (hit) return hit;
  const byId = new Map(t.nodes.map((n) => [n.id, n]));
  const leaves = [];
  flattenMuscleRows(t).forEach((r) => {
    if (!r.leaf) return;
    const parent = r.parentId ? byId.get(r.parentId) : null;
    leaves.push({
      id: r.id,
      name: r.name,
      parentId: r.parentId || null,
      parentName: parent?.name || '',
      label: labelKey(parent ? `${parent.name} · ${r.name}` : r.name),
      cardio: isCardioMove(r.name, parent?.name),
    });
  });
  const byLabel = new Map();
  const add = (key, leaf) => {
    if (!byLabel.has(key)) byLabel.set(key, []);
    if (!byLabel.get(key).includes(leaf)) byLabel.get(key).push(leaf);
  };
  leaves.forEach((leaf) => add(leaf.label, leaf));
  const bare = new Map();
  leaves.forEach((leaf) => {
    const k = labelKey(leaf.name);
    bare.set(k, [...(bare.get(k) || []), leaf]);
  });
  bare.forEach((list, k) => { if (!byLabel.has(k)) list.forEach((leaf) => add(k, leaf)); });
  const out = { leaves, byLabel, byId: new Map(leaves.map((l) => [l.id, l])) };
  LEAF_INDEX.set(t, out);
  return out;
}

/** The leaf a day-cell label stands for on a date: one with a mark that day beats one without. */
export function leafForLabel(tree, label, dateKey, skip = null) {
  const t = normalizeMuscleTree(tree);
  const list = (muscleLeafIndex(t).byLabel.get(labelKey(label)) || [])
    .filter((l) => !skip?.has(l.id));
  if (!list.length) return null;
  return (dateKey && list.find((l) => t.cells[cellKey(l.id, dateKey)] > 0)) || list[0];
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

const nodeIsCardio = (byId, n) => isCardioMove(n.name, n.parentId ? byId.get(n.parentId)?.name : '');

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

/** Move a leaf under another group (cells stay keyed by id, so its history moves along). */
export function canReparentMuscleNode(tree, nodeId, parentId) {
  const t = normalizeMuscleTree(tree);
  const node = t.nodes.find((n) => n.id === nodeId && n.parentId);
  const parent = t.nodes.find((n) => n.id === parentId && !n.parentId);
  if (!node || !parent || node.parentId === parentId) return false;
  // A childless root with its own marks is itself a move and can't take children.
  if (!t.nodes.some((n) => n.parentId === parentId) && Object.keys(t.cells).some((k) => k.startsWith(`${parentId}|`))) {
    return false;
  }
  // Cardio cells hold kcal and strength cells hold marks, so a move can't cross between them.
  const from = t.nodes.find((n) => n.id === node.parentId);
  return isCardioMove(node.name, from?.name) === isCardioMove(node.name, parent.name);
}

export function reparentMuscleNode(tree, nodeId, parentId) {
  const t = normalizeMuscleTree(tree);
  if (!canReparentMuscleNode(t, nodeId, parentId)) return { tree: t, changed: false };
  const order = t.nodes.filter((n) => n.parentId === parentId).length;
  const nodes = t.nodes.map((n) => (n.id === nodeId ? { ...n, parentId, order } : n));
  return { tree: normalizeMuscleTree({ ...t, nodes, updatedAt: nowIsoLocal() }), changed: true };
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
    .filter((r) => r.leaf && !regionOfLeaf(r.id) && !nodeIsCardio(byId, byId.get(r.id)))
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

/** Region id → 'YYYY-MM-DD' → MARK_MAIN | MARK_SECONDARY, from the muscle rows. */
export function regionMarks(tree) {
  const t = normalizeMuscleTree(tree);
  const out = new Map();
  Object.keys(t.cells).forEach((k) => {
    const [id, dk] = k.split('|');
    const rid = regionOfLeaf(id);
    if (!rid || !dk || !(t.cells[k] > 0)) return;
    if (!out.has(rid)) out.set(rid, new Map());
    out.get(rid).set(dk, t.cells[k] === MARK_SECONDARY ? MARK_SECONDARY : MARK_MAIN);
  });
  return out;
}

/** Last main / secondary mark per muscle row, shaped like moves for computeRegionRest. */
function regionHitStates(t, todayKey) {
  const out = [];
  regionMarks(t).forEach((byDate, rid) => {
    const last = { [MARK_MAIN]: '', [MARK_SECONDARY]: '' };
    byDate.forEach((v, dk) => { if (dk <= todayKey && dk > last[v]) last[v] = dk; });
    [MARK_MAIN, MARK_SECONDARY].forEach((v) => {
      if (!last[v]) return;
      out.push({
        id: regionLeafId(rid),
        p: v === MARK_MAIN ? [rid] : [],
        s: v === MARK_SECONDARY ? [rid] : [],
        days: daysBetweenKeys(last[v], todayKey),
        last: last[v],
      });
    });
  });
  return out;
}

/** Everything that sets rest: muscle-row marks plus any move rows not folded yet. */
function restStates(t, todayKey) {
  return [...muscleMoveStates(t, todayKey), ...regionHitStates(t, todayKey)];
}

/** Region id → recovery info. */
export function regionRestMap(tree, todayKey = muscleToDateKey()) {
  const t = normalizeMuscleTree(tree);
  return computeRegionRest(restStates(t, todayKey), t.restProfile);
}


/** Regions hit as a main muscle only (secondary hits don't set the rest colour). */
function primaryRestMap(states, profile) {
  return computeRegionRest(states.map((m) => ({ ...m, s: [] })), profile);
}

/** Least-recovered region of a set: most rest still to go, then most recent. */
function leastRecovered(regionIds, restMap) {
  let best = null;
  regionIds.forEach((rid) => {
    const info = restMap.get(rid);
    if (!info) return;
    const left = info.rest - info.days;
    if (!best || left > best.left || (left === best.left && info.days < best.info.days)) best = { rid, info, left };
  });
  return best;
}

/** Rest days as a main-hit equivalent, so a ½-rest secondary hit is toned by what's left. */
export function regionRestEquivDays(info) {
  if (!info) return null;
  if (info.via !== 's' || !(info.rest > 0) || !(info.full > 0)) return info.days;
  return Math.floor((info.days * info.full) / info.rest);
}

function fmtRest(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Narrow date columns: shorter labels for the longer group names. */
const DAY_GROUP_SHORT = { 'ต้นขาหน้า': 'ขาหน้า', 'ต้นขาหลัง': 'ขาหลัง', 'หน้าท้อง': 'ท้อง' };

function cardioLeafIds(t) {
  return muscleLeafIndex(t).leaves.filter((l) => l.cardio).map((l) => l.id);
}

function cardioKcalOn(t, ids, dk) {
  return ids.reduce((s, id) => s + (t.cells[cellKey(id, dk)] || 0), 0);
}

/**
 * One day in words: main muscles, secondary muscles, cardio kcal and the move names noted.
 * @returns {{ main: string[], secondary: string[], cardio: { name: string, kcal: number }[], moves: string[] }}
 */
export function muscleDaySummary(tree, dateKey) {
  const t = normalizeMuscleTree(tree);
  const main = [];
  const secondary = [];
  BEGINNER_GROUPS.forEach((g) => g.regions.forEach((rid) => {
    const v = t.cells[cellKey(regionLeafId(rid), dateKey)];
    if (!(v > 0)) return;
    (v === MARK_SECONDARY ? secondary : main).push(regionLabel(t, rid));
  }));
  const cardio = muscleLeafIndex(t).leaves
    .filter((l) => l.cardio && t.cells[cellKey(l.id, dateKey)] > 0)
    .map((l) => ({ name: l.name, kcal: t.cells[cellKey(l.id, dateKey)] }));
  return { main, secondary, cardio, moves: t.moveLog?.[dateKey]?.names || [] };
}

/** Top "เล่นหลัก" row: the groups each day was mainly about (tap = that day in words). */
function daySummaryRowHtml(t, dates, todayKey, marks, cardioIds) {
  const cells = dates.map((dk) => {
    const groups = BEGINNER_GROUPS
      .map((g) => ({ name: g.name, n: g.regions.filter((rid) => marks.get(rid)?.get(dk) === MARK_MAIN).length }))
      .filter((g) => g.n)
      .sort((a, b) => b.n - a.n);
    const cut = cardioKcalOn(t, cardioIds, dk);
    const shown = groups.slice(0, 2).map((g) => `<span class="mt-day-g">${esc(DAY_GROUP_SHORT[g.name] || g.name)}</span>`).join('');
    const more = groups.length > 2 ? `<span class="mt-day-more">+${groups.length - 2}</span>` : '';
    const cardio = cut > 0 ? '<span class="mt-day-cardio" aria-label="มีคาดิโอ">คาดิโอ</span>' : '';
    const any = groups.length || cut > 0 || t.moveLog?.[dk]?.names?.length;
    return `<td class="mt-cell mt-day-cell${dk === todayKey ? ' is-today' : ''}" data-date="${esc(dk)}"${any ? ' data-day-sum="1" title="แตะเพื่อดูวันนั้น"' : ''}>${shown}${more}${cardio}</td>`;
  }).join('');
  return `<tr class="mt-row mt-day-row">
    <th class="mt-row-name is-parent mt-day-name" scope="row"><div class="mt-name-row"><span class="mt-name-text">เล่นหลัก</span></div></th>
    <td class="mt-col-count mt-day-blank"></td>
    <td class="mt-col-rest mt-day-blank"></td>
    ${cells}
  </tr>`;
}

function regionRestCellHtml(t, regionIds, cls, id, restMap, anyRestMap) {
  const best = leastRecovered(regionIds, restMap);
  const base = `mt-col-rest${cls}`;
  if (!best) {
    const sec = leastRecovered(regionIds, anyRestMap);
    if (!sec) return `<td class="${base} is-none" data-node-id="${esc(id)}" title="ยังไม่เคยโดน"><span class="mt-rest-val">–</span></td>`;
    const tip = `ยังไม่เคยเป็นกล้ามหลัก · โดนเป็นกล้ามรอง${sec.info.days === 0 ? 'วันนี้' : `เมื่อ ${sec.info.days} วันก่อน`}`;
    return `<td class="${base} is-secondary" data-node-id="${esc(id)}" title="${esc(tip)}">
      <span class="mt-rest-val"><b class="mt-rest-n">${sec.info.days}</b><span class="mt-rest-lb">โดนรอง</span></span>
    </td>`;
  }
  const { info } = best;
  const step = restStep(t.restScale, info.days);
  const left = restRemaining(info.days, info.rest);
  const who = regionIds.length > 1 ? `${regionLabel(t, best.rid)} · ` : '';
  const tip = `${who}${info.days === 0 ? 'เป็นกล้ามหลักวันนี้' : `พักมา ${info.days} วัน (ล่าสุด ${formatMuscleColDate(info.last)})`}`
    + `${left == null ? '' : ` · ${left > 0 ? `อีก ${fmtRest(left)} วัน` : 'พักครบแล้ว'}`} · ${step.label}`;
  const fadeCls = step.fade > 0 ? ' is-fading' : '';
  const fadeStyle = step.fade > 0 ? ` style="--rest-fade:${Math.round(step.fade * 100)}%"` : '';
  return `<td class="${base} rest-tone-${esc(step.tone)}${fadeCls}"${fadeStyle} data-node-id="${esc(id)}" title="${esc(tip)}">
    <span class="mt-rest-val"><b class="mt-rest-n">${info.days}</b><span class="mt-rest-lb">${esc(step.label)}</span></span>
  </td>`;
}

function nameCellHtml({ id, name, cls, attrs = '', toggle = false, extra = '' }) {
  return `<th class="mt-row-name${cls}" scope="row" data-node-id="${esc(id)}">
    <div class="mt-name-row">
      <button type="button" class="mt-name-btn${toggle ? ' is-group-toggle' : ''}" data-node-id="${esc(id)}"${attrs}>
        <span class="mt-name-text">${esc(name)}</span>${extra}
      </button>
    </div>
  </th>`;
}

/** Cardio groups and moves: kcal burned per day (feeds the calorie balance). */
function cardioRowsHtml(t, dates, todayKey, { expandAll, expanded, selectedId }) {
  const rows = flattenMuscleRows(t);
  const cardioIds = new Set(cardioLeafIds(t));
  const sessions = (id) => Object.keys(t.cells).filter((k) => k.startsWith(`${id}|`) && t.cells[k] > 0).length;
  return rows.map((r) => {
    if (regionOfLeaf(r.id) || BEGINNER_GROUPS.some((g) => g.id === r.id)) return '';
    const isGroup = !r.leaf;
    if (!isGroup && !cardioIds.has(r.id)) return '';
    if (r.depth && !(expandAll || expanded.has(r.parentId))) return '';
    const open = isGroup && (expandAll || expanded.has(r.id));
    const depthCls = r.depth ? ' is-child' : ' is-parent';
    const leafCls = r.leaf ? ' is-leaf' : ' is-group';
    const sel = r.id === selectedId ? ' is-selected' : '';
    const cls = `${depthCls}${leafCls}${sel} is-cardio${open ? ' is-open' : ''}`;
    const toggle = isGroup && !expandAll;
    const attrs = toggle
      ? ` data-group-toggle="1" title="${open ? 'แตะเพื่อหุบ' : 'แตะเพื่อขยาย'}"`
      : ' title="คาดิโอ · ใส่ kcal ที่เบิร์นจริง · หักออกจากดุลแคลวันนั้น"';
    const tag = r.depth === 0 ? '<span class="mt-cardio-tag">kcal · หักดุล</span>' : '';
    const n = isGroup ? 0 : sessions(r.id);
    const cells = dates.map((dk) => {
      if (isGroup) {
        const cut = cardioKcalOn(t, r.childIds || [], dk);
        const cutHtml = cut > 0 ? `<span class="mt-cardio-cut" title="คาดิโอวันนี้ −${cut} kcal จากดุลแคล">−${cut}</span>` : '';
        return `<td class="mt-cell is-sum is-cardio${dk === todayKey ? ' is-today' : ''}" data-date="${esc(dk)}">${cutHtml}</td>`;
      }
      const val = t.cells[cellKey(r.id, dk)];
      const tip = val > 0 ? `เบิร์น ${val} kcal · หักออกจากดุลแคลวันนั้น` : 'ใส่ kcal ที่เบิร์นจริง';
      return `<td class="mt-cell is-input${val > 0 ? ' is-filled' : ''} is-cardio${dk === todayKey ? ' is-today' : ''}" data-node-id="${esc(r.id)}" data-date="${esc(dk)}" title="${esc(tip)}">
        <input class="mt-kcal" type="number" inputmode="numeric" min="0" max="5000" step="1"
          value="${val > 0 ? val : ''}" placeholder="" aria-label="${esc(`${r.name} ${dk} kcal ที่เบิร์น`)}"
          data-node-id="${esc(r.id)}" data-date="${esc(dk)}">
      </td>`;
    }).join('');
    return `<tr class="mt-row${cls}" data-node-id="${esc(r.id)}"${r.parentId ? ` data-parent-id="${esc(r.parentId)}"` : ''}>
      ${nameCellHtml({ id: r.id, name: r.name, cls, attrs, toggle, extra: tag })}
      <td class="mt-col-count${depthCls}${leafCls}${n ? ' is-filled' : ''}" data-node-id="${esc(r.id)}"${isGroup ? '' : ` title="เล่นไป ${n} ครั้ง"`}><span class="mt-count-val">${n || ''}</span></td>
      <td class="mt-col-rest${depthCls}${leafCls}" data-node-id="${esc(r.id)}"></td>
      ${cells}
    </tr>`;
  }).join('');
}

/**
 * The muscle log: 10 groups → small muscles × dates (newest → oldest), then cardio.
 * Muscle cell: ● main / • secondary (tap cycles). Group cell: main muscles worked that day.
 * Old move rows are shown folded in (toMuscleLayout) until the tree is saved that way.
 * @param {{ dates?: string[], todayKey?: string, selectedId?: string, expandAll?: boolean, expandedIds?: string[]|Set<string> }} opts
 */
export function renderMuscleLogTableHtml(tree, opts = {}) {
  const t = toMuscleLayout(tree).tree;
  const todayKey = opts.todayKey || muscleToDateKey();
  const dates = opts.dates || muscleDateKeys({ today: todayKey });
  const expandAll = Boolean(opts.expandAll);
  const expanded = opts.expandedIds instanceof Set
    ? opts.expandedIds
    : new Set(Array.isArray(opts.expandedIds) ? opts.expandedIds : []);
  const selectedId = opts.selectedId || '';
  const states = restStates(t, todayKey);
  const restMap = primaryRestMap(states, t.restProfile);
  const anyRestMap = computeRegionRest(states, t.restProfile);
  const marks = regionMarks(t);
  const mainDays = (rids) => {
    const days = new Set();
    rids.forEach((rid) => marks.get(rid)?.forEach((v, dk) => { if (v === MARK_MAIN) days.add(dk); }));
    return days.size;
  };

  const headDates = dates
    .map((dk) => `<th class="mt-col-date${dk === todayKey ? ' is-today' : ''}" data-date="${esc(dk)}">
        <span class="mt-col-wd">${esc(weekdayShortTh(dk))}</span>
        <span class="mt-col-dm">${esc(formatMuscleColDate(dk))}</span>
      </th>`)
    .join('');

  const groupRow = (g, open) => {
    const toggle = !expandAll;
    const sel = g.id === selectedId ? ' is-selected' : '';
    const cls = ` is-parent is-group${sel}${open ? ' is-open' : ''}`;
    const attrs = toggle ? ` data-group-toggle="1" title="${open ? 'แตะเพื่อหุบ' : 'แตะเพื่อขยายเป็นกล้ามย่อย'}"` : '';
    const count = mainDays(g.regions);
    const cells = dates.map((dk) => {
      const n = g.regions.filter((rid) => marks.get(rid)?.get(dk) === MARK_MAIN).length;
      const sec = !n && g.regions.some((rid) => marks.get(rid)?.get(dk) === MARK_SECONDARY);
      const html = n ? `<span class="mt-dose">${n}</span>` : sec ? '<span class="mt-dose is-sec" aria-label="โดนเป็นกล้ามรอง">•</span>' : '';
      return `<td class="mt-cell is-sum${dk === todayKey ? ' is-today' : ''}${n || sec ? ' is-hit' : ''}" data-date="${esc(dk)}"${n || sec ? ` data-mv-group="${esc(g.id)}"` : ''}>${html}</td>`;
    }).join('');
    return `<tr class="mt-row${cls}" data-node-id="${esc(g.id)}">
      ${nameCellHtml({ id: g.id, name: g.name, cls, attrs, toggle })}
      <td class="mt-col-count is-parent is-group${count ? ' is-filled' : ''}" data-node-id="${esc(g.id)}" title="วันที่มีกล้ามในกลุ่มนี้เป็นกล้ามหลัก ${count} วัน"><span class="mt-count-val">${count || ''}</span></td>
      ${regionRestCellHtml(t, g.regions, ' is-parent is-group', g.id, restMap, anyRestMap)}
      ${cells}
    </tr>`;
  };

  const muscleRow = (g, rid, solo = false) => {
    const id = regionLeafId(rid);
    const name = regionLabel(t, rid);
    const sel = id === selectedId ? ' is-selected' : '';
    const pos = solo ? ' is-parent is-solo' : ' is-child';
    const cls = `${pos} is-leaf${sel}`;
    const count = mainDays([rid]);
    const cells = dates.map((dk) => {
      const v = marks.get(rid)?.get(dk) || 0;
      const state = v === MARK_MAIN ? ' is-main' : v === MARK_SECONDARY ? ' is-sec' : '';
      const label = v === MARK_MAIN ? 'หลัก' : v === MARK_SECONDARY ? 'รอง' : 'ว่าง';
      return `<td class="mt-cell is-mark${state}${dk === todayKey ? ' is-today' : ''}" data-date="${esc(dk)}">
        <button type="button" class="mt-mark-btn" data-mark-node="${esc(id)}" data-date="${esc(dk)}" aria-label="${esc(`${name} ${dk} ${label} · แตะเพื่อเปลี่ยน`)}">${v === MARK_MAIN ? '●' : v === MARK_SECONDARY ? '•' : ''}</button>
      </td>`;
    }).join('');
    return `<tr class="mt-row${cls}" data-node-id="${esc(id)}"${solo ? '' : ` data-parent-id="${esc(g.id)}"`}>
      ${nameCellHtml({ id, name, cls, attrs: ` data-muscle-region="${esc(rid)}" title="แตะเพื่อดูท่าไกด์และตั้งวันพัก"` })}
      <td class="mt-col-count${pos} is-leaf${count ? ' is-filled' : ''}" data-node-id="${esc(id)}" title="เป็นกล้ามหลัก ${count} วัน"><span class="mt-count-val">${count || ''}</span></td>
      ${regionRestCellHtml(t, [rid], `${pos} is-leaf`, id, restMap, anyRestMap)}
      ${cells}
    </tr>`;
  };

  const body = BEGINNER_GROUPS.map((g) => {
    if (g.regions.length === 1) return muscleRow(g, g.regions[0], true);
    const open = expandAll || expanded.has(g.id);
    return groupRow(g, open) + (open ? g.regions.map((rid) => muscleRow(g, rid)).join('') : '');
  }).join('');
  const cardio = cardioRowsHtml(t, dates, todayKey, { expandAll, expanded, selectedId });

  return `<table class="muscle-table is-muscle-view" id="muscle-table" aria-label="ตารางกล้ามเนื้อรายวัน">
    <thead>
      <tr>
        <th class="mt-corner" scope="col">กล้ามเนื้อ</th>
        <th class="mt-col-count-head" scope="col" title="จำนวนวันที่เป็นกล้ามหลัก">วัน</th>
        <th class="mt-col-rest-head" scope="col" title="พักมากี่วันแล้ว นับเฉพาะตอนเป็นกล้ามหลัก (กลุ่ม = กล้ามที่ยังล้าที่สุด)">พัก</th>
        ${headDates}
      </tr>
    </thead>
    <tbody>${daySummaryRowHtml(t, dates, todayKey, marks, cardioLeafIds(t))}${body}${cardio}</tbody>
  </table>`;
}

/** Next value when a muscle cell is tapped: empty → main → secondary → empty. */
export function nextMark(value) {
  if (!(value > 0)) return MARK_MAIN;
  return value === MARK_SECONDARY ? null : MARK_SECONDARY;
}

/**
 * Mark a library move's muscles on a date (main 1, secondary 2 unless already main)
 * and note its name. Returns the tree unchanged when there is nothing new.
 * @returns {{ tree: object, changed: boolean }}
 */
export function markMoveMuscles(tree, move, dateKey, nowMs = clockNowMs()) {
  let t = toMuscleLayout(tree, nowMs).tree;
  const cells = { ...t.cells };
  let changed = false;
  const put = (rid, v) => {
    const key = cellKey(regionLeafId(rid), dateKey);
    const cur = cells[key];
    if (cur > 0 && (cur !== MARK_SECONDARY || v === MARK_SECONDARY)) return;
    cells[key] = v;
    changed = true;
  };
  (move?.p || []).forEach((rid) => put(rid, MARK_MAIN));
  (move?.s || []).forEach((rid) => put(rid, MARK_SECONDARY));
  if (changed) t = normalizeMuscleTree({ ...t, cells, updatedAt: nowIsoLocal() });
  const name = clampName(move?.name);
  const names = t.moveLog?.[dateKey]?.names || [];
  if (name && !names.includes(name)) {
    t = setMoveLogNames(t, dateKey, [...names, name], nowMs);
    changed = true;
  }
  return { tree: t, changed };
}

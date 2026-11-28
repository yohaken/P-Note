/**
 * Incremental pending-write queue for pre-hydrate / offline calorie edits.
 * Survives reload in localStorage; flushed by replaying ops on cloud base.
 */
import { STORAGE_KEYS } from './config.js?v=355';
import {
  appendQuickMeal,
  appendQuickExercise,
  normalizeCalorie,
  normalizeMeals,
  normalizeExercises,
  normalizeOpLog,
  OP_LOG_MAX,
  parseMealCell,
  parseExerciseCell,
  formatMealCell,
  formatExerciseCell,
  patchDay,
  ensureDay,
  exerciseEntryKey,
  buildExerciseEntryMap,
  normalizeExAt,
  normalizeExOrder,
  parseExAtEntry,
} from './calorie.js?v=355';
import {
  normalizeMuscleTree,
  mergeMuscleTrees,
  setMoveLogNames,
  setMovePlanIds,
  muscleLeafIndex,
  encodeSetSpec,
  parseSetSpec,
} from './muscle-tree.js?v=355';
import {
  normalizeExerciseFavs,
  normalizeExerciseMedia,
} from './settings.js?v=355';
import { nowIso, compareStamp } from './clock.js?v=355';
import { isQuotaError } from './local.js?v=355';

/** Note is handled via appendMeal labels unless it is the only change. */
const SCALAR_KEYS = ['weight', 'waist', 'bodyFat', 'base', 'addCal', 'water'];
const SHEET_META_KEYS = ['goalMode', 'fixedKcal', 'fixedProtG', 'proteinFactor', 'heightCm', 'sex', 'birthDate', 'tdeeBias', 'activityLevel'];

const SETTINGS_OP_KINDS = new Set(['setExerciseFav', 'setExerciseMedia']);

function newOpId() {
  return `pw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadPendingWrites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_WRITES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((o) => o && typeof o === 'object' && o.kind) : [];
  } catch {
    return [];
  }
}

export function savePendingWrites(ops) {
  try {
    const list = Array.isArray(ops) ? ops : [];
    if (!list.length) {
      localStorage.removeItem(STORAGE_KEYS.PENDING_WRITES);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.PENDING_WRITES, JSON.stringify(list));
  } catch (e) {
    if (isQuotaError(e)) throw e;
  }
}

export function clearPendingWrites() {
  savePendingWrites([]);
}

export function enqueuePendingWrites(ops) {
  if (!ops?.length) return loadPendingWrites();
  const next = [...loadPendingWrites(), ...ops];
  savePendingWrites(next);
  return next;
}

export function isSettingsPendingOp(op) {
  return Boolean(op && SETTINGS_OP_KINDS.has(op.kind));
}

/** True when calorie.opLog already contains this pending-op id. */
export function hasAppliedOp(calorie, opId) {
  const id = String(opId || '').trim();
  if (!id) return false;
  const log = calorie?.opLog;
  if (!Array.isArray(log) || !log.length) return false;
  return log.some((e) => (typeof e === 'string' ? e : e?.id) === id);
}

/** Append op id to calorie.opLog (capped); returns a new sheet object. */
function markOpApplied(calorie, opId) {
  const id = String(opId || '').trim().slice(0, 64);
  if (!id) return calorie;
  const prev = Array.isArray(calorie?.opLog) ? calorie.opLog : [];
  if (hasAppliedOp(calorie, id)) return calorie;
  const opLog = normalizeOpLog([...prev, { id, at: nowIso() }]);
  return { ...calorie, opLog: opLog.length > OP_LOG_MAX ? opLog.slice(-OP_LOG_MAX) : opLog };
}

/**
 * Diff previous calorie sheet vs next → incremental ops (not a full day snapshot).
 * Also diffs muscleTree movePlan / moveLog / cells so tree edits survive pending flush.
 */
export function diffCalorieToPendingOps(prevRaw, nextRaw) {
  const prev = normalizeCalorie(prevRaw);
  const next = normalizeCalorie(nextRaw);
  const prevByDate = new Map(prev.days.map((d) => [d.date, d]));
  const ops = [];
  const at = nowIso();

  for (const day of next.days) {
    const before = prevByDate.get(day.date);
    const dateKey = day.date;
    if (!before) {
      // Brand-new day: emit appends / scalars from empty base.
      const meals = normalizeMeals(day.meals);
      meals.forEach((cell, slot) => {
        const m = parseMealCell(cell);
        if (m.empty) return;
        const label = labelForNewMealSlot(day, before, slot);
        ops.push({
          id: newOpId(),
          kind: 'appendMeal',
          dateKey,
          cal: m.cal,
          prot: m.prot,
          label,
          at,
        });
      });
      const moveIndex = muscleLeafIndex(normalizeMuscleTree(next.muscleTree)).byLabel;
      for (const e of freeformExerciseEntries(day, moveIndex)) {
        ops.push({
          id: newOpId(),
          kind: 'upsertExerciseEntry',
          dateKey,
          label: e.label,
          n: e.n,
          burn: e.burn,
          at,
        });
      }
      const newOrder = normalizeExOrder(day.exOrder);
      if (newOrder.length) {
        ops.push({
          id: newOpId(),
          kind: 'setExerciseOrder',
          dateKey,
          order: newOrder,
          at: day.exOrderAt || at,
        });
      }
      const scalars = pickScalars(day, null);
      if (Object.keys(scalars).length) {
        ops.push({ id: newOpId(), kind: 'patchDayScalars', dateKey, patch: scalars, at });
      }
      continue;
    }

    const prevMeals = normalizeMeals(before.meals);
    const nextMeals = normalizeMeals(day.meals);
    const mealLen = Math.max(prevMeals.length, nextMeals.length);
    for (let slot = 0; slot < mealLen; slot += 1) {
      const a = parseMealCell(prevMeals[slot]);
      const b = parseMealCell(nextMeals[slot]);
      if (a.empty && b.empty) continue;
      if (a.empty && !b.empty) {
        ops.push({
          id: newOpId(),
          kind: 'appendMeal',
          dateKey,
          cal: b.cal,
          prot: b.prot,
          label: labelForNewMealSlot(day, before, slot),
          at,
        });
      } else if (!a.empty && b.empty) {
        ops.push({ id: newOpId(), kind: 'clearMealSlot', dateKey, slot, at });
      } else if (a.cal !== b.cal || a.prot !== b.prot) {
        ops.push({
          id: newOpId(),
          kind: 'replaceMealSlot',
          dateKey,
          slot,
          cal: b.cal,
          prot: b.prot,
          at,
        });
      }
    }

    const moveIndex = muscleLeafIndex(normalizeMuscleTree(next.muscleTree)).byLabel;
    const prevFF = freeformExerciseEntries(before, moveIndex);
    const nextFF = freeformExerciseEntries(day, moveIndex);
    const prevByKey = new Map(prevFF.map((e) => [e.key, e]));
    const nextByKey = new Map(nextFF.map((e) => [e.key, e]));
    let exOps = false;
    for (const e of nextFF) {
      const prev = prevByKey.get(e.key);
      if (prev && prev.cell === e.cell) continue;
      exOps = true;
      ops.push({
        id: newOpId(),
        kind: 'upsertExerciseEntry',
        dateKey,
        label: e.label,
        n: e.n,
        burn: e.burn,
        at,
      });
    }
    for (const e of prevFF) {
      if (nextByKey.has(e.key)) continue;
      exOps = true;
      ops.push({
        id: newOpId(),
        kind: 'deleteExerciseEntry',
        dateKey,
        label: e.label,
        n: e.n,
        at,
      });
    }
    // mus is derived from exercises on apply; only emit when no entry ops (legacy mus-only edits).
    if (!exOps && String(before?.mus ?? '') !== String(day?.mus ?? '')) {
      ops.push({
        id: newOpId(),
        kind: 'patchDayScalars',
        dateKey,
        patch: { mus: day.mus ?? null },
        at,
      });
    }

    const prevOrder = normalizeExOrder(before.exOrder);
    const nextOrder = normalizeExOrder(day.exOrder);
    if (JSON.stringify(prevOrder) !== JSON.stringify(nextOrder)) {
      ops.push({
        id: newOpId(),
        kind: 'setExerciseOrder',
        dateKey,
        order: nextOrder,
        at: day.exOrderAt || at,
      });
    }

    const scalars = pickScalars(day, before);
    // If we already emitted appendMeal (with labels), skip note — a full note
    // patch would clobber the cloud note when replaying on cloud base.
    const emittedMealAppend = ops.some(
      (o) => o.dateKey === dateKey && o.kind === 'appendMeal' && o.at === at,
    );
    const prevNote = String(before?.note || '');
    const nextNote = String(day?.note || '');
    if (!emittedMealAppend && prevNote !== nextNote) {
      scalars.note = day.note;
    }
    if (Object.keys(scalars).length) {
      ops.push({ id: newOpId(), kind: 'patchDayScalars', dateKey, patch: scalars, at });
    }
  }

  const meta = {};
  for (const k of SHEET_META_KEYS) {
    if (String(prev?.[k] ?? '') !== String(next?.[k] ?? '')) meta[k] = next?.[k] ?? null;
  }
  if (Object.keys(meta).length) {
    ops.push({ id: newOpId(), kind: 'patchSheetMeta', patch: meta, profileAt: next.profileAt || at, at });
  }

  ops.push(...diffMuscleTreeToPendingOps(prev.muscleTree, next.muscleTree, at));
  return ops;
}

function dayEntryEqual(a, b, key) {
  const aa = a?.[key];
  const bb = b?.[key];
  if (!aa && !bb) return true;
  if (!aa || !bb) return false;
  return JSON.stringify(aa) === JSON.stringify(bb);
}

function diffMuscleTreeToPendingOps(prevRaw, nextRaw, at) {
  const prev = normalizeMuscleTree(prevRaw);
  const next = normalizeMuscleTree(nextRaw);
  const ops = [];
  if (prev === next) return ops;

  const dates = new Set([
    ...Object.keys(prev.movePlan || {}),
    ...Object.keys(next.movePlan || {}),
    ...Object.keys(prev.moveLog || {}),
    ...Object.keys(next.moveLog || {}),
  ]);
  for (const dateKey of dates) {
    if (!dayEntryEqual(prev.movePlan, next.movePlan, dateKey)) {
      const entry = next.movePlan?.[dateKey];
      ops.push({
        id: newOpId(),
        kind: 'setMovePlan',
        dateKey,
        ids: entry ? [...(entry.ids || [])] : [],
        at: entry?.at ? new Date(entry.at).toISOString() : at,
      });
    }
    if (!dayEntryEqual(prev.moveLog, next.moveLog, dateKey)) {
      const entry = next.moveLog?.[dateKey];
      ops.push({
        id: newOpId(),
        kind: 'setMoveLog',
        dateKey,
        names: entry ? [...(entry.names || [])] : [],
        at: entry?.at ? new Date(entry.at).toISOString() : at,
      });
    }
  }

  // sets ride patchMuscleSets (not the 60k struct subset) so a large tree + sets stays under the cap.
  const pickStruct = (t) => ({
    nodes: t.nodes,
    removed: t.removed,
    hidden: t.hidden,
    orderMap: t.orderMap,
    parentMap: t.parentMap,
    groupNames: t.groupNames,
    regionNames: t.regionNames,
    aliases: t.aliases,
    cellNotes: t.cellNotes,
    restScale: t.restScale,
    restProfile: t.restProfile,
  });
  const nextStruct = pickStruct(next);
  const prevStruct = pickStruct(prev);
  if (JSON.stringify(nextStruct) !== JSON.stringify(prevStruct)) {
    const structOp = { id: newOpId(), kind: 'patchMuscleTreeStruct', tree: nextStruct, at };
    const structLen = JSON.stringify(structOp).length;
    if (structLen <= 60000) {
      ops.push(structOp);
    } else {
      console.warn('patchMuscleTreeStruct dropped: over 60000 chars', structLen);
    }
  }

  const cellKeys = new Set([...Object.keys(prev.cells), ...Object.keys(next.cells)]);
  const cells = {};
  let cellChanged = false;
  for (const k of cellKeys) {
    if (prev.cells[k] === next.cells[k]) continue;
    cells[k] = next.cells[k] == null ? null : next.cells[k];
    cellChanged = true;
  }
  if (cellChanged) {
    ops.push({ id: newOpId(), kind: 'patchMuscleCells', cells, at });
  }

  const setKeys = new Set([
    ...Object.keys(prev.sets || {}),
    ...Object.keys(next.sets || {}),
  ]);
  const setsPatch = {};
  let setsChanged = false;
  for (const k of setKeys) {
    const a = prev.sets?.[k];
    const b = next.sets?.[k];
    if ((a?.v || '') === (b?.v || '') && (a?.at || 0) === (b?.at || 0)) continue;
    if (!b) {
      // Fresh stamp so replay beats the equal-stamp "non-empty wins" branch.
      setsPatch[k] = { v: '', at: Date.parse(at) || Date.now() };
    } else {
      setsPatch[k] = { v: encodeSetSpec(parseSetSpec(b.v)), at: b.at };
    }
    setsChanged = true;
  }
  if (setsChanged) {
    ops.push({ id: newOpId(), kind: 'patchMuscleSets', sets: setsPatch, at });
  }
  return ops;
}

function pickScalars(day, before) {
  const patch = {};
  for (const key of SCALAR_KEYS) {
    const cur = day?.[key];
    const prev = before?.[key];
    if (cur === prev) continue;
    if (String(cur ?? '') === String(prev ?? '')) continue;
    patch[key] = cur;
  }
  return patch;
}

/** Freeform (non-tree) exercise entries keyed by label#n occurrence. */
function freeformExerciseEntries(day, moveIndex) {
  const counts = new Map();
  const out = [];
  for (const cell of normalizeExercises(day?.exercises)) {
    const p = parseExerciseCell(cell);
    if (p.empty) continue;
    if (moveIndex && moveIndex.has(p.label)) continue;
    const n = (counts.get(p.label) || 0) + 1;
    counts.set(p.label, n);
    out.push({
      key: exerciseEntryKey(p.label, n),
      label: p.label,
      n,
      burn: p.burn,
      cell,
    });
  }
  return out;
}

/** Split day exercises into tree-backed cells vs freeform cells (order preserved). */
function splitExerciseCells(day, moveIndex) {
  const tree = [];
  const freeform = [];
  for (const cell of normalizeExercises(day?.exercises)) {
    const p = parseExerciseCell(cell);
    if (p.empty) continue;
    if (moveIndex && moveIndex.has(p.label)) tree.push(cell);
    else freeform.push(cell);
  }
  return { tree, freeform };
}

/** Replace or insert the n-th freeform occurrence of label; returns new exercises list. */
function upsertFreeformInList(day, moveIndex, label, n, burn) {
  const { tree, freeform } = splitExerciseCells(day, moveIndex);
  const lab = String(label || '').trim().slice(0, 40);
  const idx = Math.max(1, Math.round(Number(n)) || 1) - 1;
  const nextFree = [];
  let seen = 0;
  let replaced = false;
  for (const cell of freeform) {
    const p = parseExerciseCell(cell);
    if (p.label === lab) {
      if (seen === idx) {
        const cellNext = formatExerciseCell(burn, lab);
        if (cellNext) nextFree.push(cellNext);
        replaced = true;
        seen += 1;
        continue;
      }
      seen += 1;
    }
    nextFree.push(cell);
  }
  if (!replaced) {
    const cellNext = formatExerciseCell(burn, lab);
    // Append as next occurrence (two devices each logging label#1 converge — documented).
    if (cellNext) nextFree.push(cellNext);
  }
  return normalizeExercises([...tree, ...nextFree]);
}

/** Remove the n-th freeform occurrence of label. */
function deleteFreeformFromList(day, moveIndex, label, n) {
  const { tree, freeform } = splitExerciseCells(day, moveIndex);
  const lab = String(label || '').trim().slice(0, 40);
  const idx = Math.max(1, Math.round(Number(n)) || 1) - 1;
  const nextFree = [];
  let seen = 0;
  for (const cell of freeform) {
    const p = parseExerciseCell(cell);
    if (p.label === lab) {
      if (seen === idx) {
        seen += 1;
        continue;
      }
      seen += 1;
    }
    nextFree.push(cell);
  }
  return normalizeExercises([...tree, ...nextFree]);
}

/** Best-effort label from note bits when a new meal cell appears. */
function labelForNewMealSlot(day, before, slot) {
  const nextBits = String(day?.note || '')
    .split(/\s*·\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  const prevBits = String(before?.note || '')
    .split(/\s*·\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (nextBits.length > prevBits.length) {
    return nextBits[nextBits.length - 1] || '';
  }
  // Same length but only one bit changed with this meal slot.
  if (nextBits.length && nextBits.length === prevBits.length + 0) {
    const idx = Math.min(slot, nextBits.length - 1);
    const changed = nextBits.map((b, i) => b !== prevBits[i]).filter(Boolean).length;
    if (changed === 1 && idx >= 0 && nextBits[idx] !== prevBits[idx]) return nextBits[idx] || '';
  }
  return '';
}

/**
 * Replay pending ops onto a notes payload (cloud as base).
 * appendMeal uses appendQuickMeal so it takes the next empty slot.
 */
export function applyPendingOpsToNotes(notesData, ops) {
  if (!ops?.length) return notesData;
  let calorie = normalizeCalorie(notesData?.calorie);
  for (const op of ops) {
    if (isSettingsPendingOp(op)) continue;
    if (op.id && hasAppliedOp(calorie, op.id)) continue;
    calorie = applyOneOp(calorie, op);
    if (op.id) calorie = markOpApplied(calorie, op.id);
  }
  return {
    ...notesData,
    calorie,
    updatedAt: nowIso(),
  };
}

/**
 * Replay settings-scoped pending ops onto a settings object (cloud as base).
 * Does not full-overwrite — only patches favs / media keys.
 */
export function applyPendingOpsToSettings(settings, ops) {
  if (!ops?.length) return settings;
  let next = settings && typeof settings === 'object' ? { ...settings } : {};
  let touched = false;
  for (const op of ops) {
    if (!isSettingsPendingOp(op)) continue;
    const applied = applyOneSettingsOp(next, op);
    if (applied !== next) {
      next = applied;
      touched = true;
    }
  }
  return touched ? next : settings;
}

function applyOneSettingsOp(settings, op) {
  if (op.kind === 'setExerciseFav') {
    const id = String(op.exerciseId || '').trim();
    if (!id) return settings;
    const favs = new Set(normalizeExerciseFavs(settings.exerciseFavs));
    if (op.on) favs.add(id);
    else favs.delete(id);
    return { ...settings, exerciseFavs: normalizeExerciseFavs([...favs]) };
  }
  if (op.kind === 'setExerciseMedia') {
    const id = String(op.exerciseId || '').trim();
    if (!id) return settings;
    const media = { ...normalizeExerciseMedia(settings.exerciseMedia) };
    if (Object.prototype.hasOwnProperty.call(op, 'entry')) {
      if (op.entry == null) {
        delete media[id];
      } else {
        const next = normalizeExerciseMedia({ [id]: op.entry })[id];
        if (!next) delete media[id];
        else media[id] = next;
      }
      return { ...settings, exerciseMedia: normalizeExerciseMedia(media) };
    }
    // 346-compat (no `entry` key): update only .yt; keep existing .items.
    const yt = String(op.yt || '').trim();
    const prev = media[id] && typeof media[id] === 'object' ? media[id] : {};
    const items = Array.isArray(prev.items) ? prev.items : [];
    if (yt) {
      media[id] = { ...prev, yt, items, at: op.at || nowIso() };
    } else if (!items.length) {
      delete media[id];
    } else {
      const kept = { items, at: op.at || prev.at || nowIso() };
      media[id] = kept;
    }
    return { ...settings, exerciseMedia: normalizeExerciseMedia(media) };
  }
  return settings;
}

export function applyOneOp(calorie, op) {
  if (!op?.kind) return calorie;

  if (op.kind === 'setMovePlan' || op.kind === 'setMoveLog' || op.kind === 'patchMuscleCells'
    || op.kind === 'patchMuscleTreeStruct' || op.kind === 'patchMuscleSets') {
    return applyMuscleOp(calorie, op);
  }

  if (op.kind === 'patchSheetMeta') {
    const patch = op.patch && typeof op.patch === 'object' ? op.patch : {};
    return normalizeCalorie({ ...calorie, ...patch, profileAt: op.profileAt || op.at || calorie.profileAt, updatedAt: nowIso() });
  }

  const dateKey = String(op.dateKey || '').slice(0, 10);
  if (!dateKey) return calorie;

  if (op.kind === 'appendMeal') {
    const text = op.label
      ? `${op.label} ${Math.round(op.cal)},${Math.round(op.prot)}`
      : `${Math.round(op.cal)},${Math.round(op.prot)}`;
    try {
      return appendQuickMeal(calorie, text, dateKey, { label: op.label || '', at: op.at }).sheet;
    } catch {
      return calorie;
    }
  }

  if (op.kind === 'appendExercise') {
    try {
      return appendQuickExercise(calorie, String(op.text || ''), dateKey).sheet;
    } catch {
      return calorie;
    }
  }

  if (op.kind === 'upsertExerciseEntry') {
    const { sheet, day } = ensureDay(calorie, dateKey);
    const label = String(op.label || '').trim().slice(0, 40);
    if (!label) return sheet;
    const n = Math.max(1, Math.round(Number(op.n)) || 1);
    const burn = Math.round(Number(op.burn) || 0);
    const moveIndex = muscleLeafIndex(normalizeMuscleTree(sheet.muscleTree)).byLabel;
    if (moveIndex.has(label)) return sheet; // tree-backed — patchMuscleCells owns these
    const exercises = upsertFreeformInList(day, moveIndex, label, n, burn);
    return patchDay(sheet, day.id, { exercises }, { entryAt: op.at });
  }

  if (op.kind === 'deleteExerciseEntry') {
    const { sheet, day } = ensureDay(calorie, dateKey);
    const label = String(op.label || '').trim().slice(0, 40);
    if (!label) return sheet;
    const n = Math.max(1, Math.round(Number(op.n)) || 1);
    const moveIndex = muscleLeafIndex(normalizeMuscleTree(sheet.muscleTree)).byLabel;
    if (moveIndex.has(label)) return sheet;
    const key = exerciseEntryKey(label, n);
    const fb = day.musAt || (normalizeExercises(day.exercises).length ? day.updatedAt : '') || '';
    const map = buildExerciseEntryMap(day.exercises, day.exAt, fb);
    const ent = map.get(key);
    // Newer live entry than the delete op → leave it (delete must not hit a later append).
    // When the cloud row has no per-entry exAt, stamp falls back to musAt and a
    // later whole-list touch would falsely block — still apply if the cell is present.
    if (ent && !ent.dead && op.at && compareStamp(ent.stamp, op.at) > 0) {
      let ownStamp = '';
      for (const raw of normalizeExAt(day.exAt)) {
        const p = parseExAtEntry(raw);
        if (p && p.key === key && !p.dead) {
          ownStamp = p.stamp;
          break;
        }
      }
      if (ownStamp && compareStamp(ownStamp, op.at) > 0) return sheet;
      // No real per-entry stamp (musAt fallback) — apply while the occurrence still exists.
      if (!ent.cell) return sheet;
    }
    const exercises = deleteFreeformFromList(day, moveIndex, label, n);
    return patchDay(sheet, day.id, { exercises }, { entryAt: op.at });
  }

  if (op.kind === 'setExerciseOrder') {
    // Order-only: never materialise an empty day via ensureDay.
    const sheet = normalizeCalorie(calorie);
    const day = sheet.days.find((d) => d.date === dateKey);
    if (!day) return sheet;
    if (op.at && day.exOrderAt && compareStamp(day.exOrderAt, op.at) > 0) return sheet;
    return patchDay(
      sheet,
      day.id,
      { exOrder: normalizeExOrder(op.order) },
      { entryAt: op.at },
    );
  }

  if (op.kind === 'replaceMealSlot' || op.kind === 'clearMealSlot') {
    const { sheet, day } = ensureDay(calorie, dateKey);
    const meals = normalizeMeals(day.meals);
    const slot = Number(op.slot);
    if (!Number.isInteger(slot) || slot < 0) return sheet;
    while (meals.length <= slot) meals.push('');
    if (op.kind === 'clearMealSlot') {
      meals[slot] = '';
    } else {
      meals[slot] = formatMealCell(op.cal, op.prot);
    }
    return patchDay(sheet, day.id, { meals: normalizeMeals(meals) }, { mealAt: op.at });
  }

  if (op.kind === 'replaceExerciseSlot' || op.kind === 'clearExerciseSlot') {
    const { sheet, day } = ensureDay(calorie, dateKey);
    const list = Array.isArray(day.exercises) ? day.exercises.map((c) => String(c || '')) : [];
    const slot = Number(op.slot);
    if (!Number.isInteger(slot) || slot < 0) return sheet;
    while (list.length <= slot) list.push('');
    if (op.kind === 'clearExerciseSlot') {
      list[slot] = '';
      while (list.length && !String(list[list.length - 1] || '').trim()) list.pop();
    } else {
      list[slot] = String(op.text || '');
    }
    return patchDay(sheet, day.id, { exercises: list });
  }

  if (op.kind === 'patchDayScalars') {
    const { sheet, day } = ensureDay(calorie, dateKey);
    const patch = { ...(op.patch || {}) };
    if (Array.isArray(patch.exercises)) {
      patch.exercises = patch.exercises.map((c) => String(c || ''));
    }
    return patchDay(sheet, day.id, patch);
  }

  return calorie;
}

function applyMuscleOp(calorie, op) {
  const sheet = normalizeCalorie(calorie);
  let tree = normalizeMuscleTree(sheet.muscleTree);
  const atMs = Date.parse(String(op.at || '')) || Date.now();

  if (op.kind === 'setMovePlan') {
    const dateKey = String(op.dateKey || '').slice(0, 10);
    if (!dateKey) return sheet;
    tree = setMovePlanIds(tree, dateKey, op.ids || [], atMs);
  } else if (op.kind === 'setMoveLog') {
    const dateKey = String(op.dateKey || '').slice(0, 10);
    if (!dateKey) return sheet;
    tree = setMoveLogNames(tree, dateKey, op.names || [], atMs);
  } else if (op.kind === 'patchMuscleTreeStruct') {
    // Op copy is a (wins per-node by at); cloud copy is b.
    tree = mergeMuscleTrees(
      normalizeMuscleTree({ ...tree, ...(op.tree && typeof op.tree === 'object' ? op.tree : {}) }),
      tree,
      atMs,
    );
  } else if (op.kind === 'patchMuscleCells') {
    const cells = { ...tree.cells };
    const cellAt = { ...(tree.cellAt || {}) };
    const patch = op.cells && typeof op.cells === 'object' ? op.cells : {};
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null) delete cells[k];
      else cells[k] = v;
      cellAt[k] = atMs;
    });
    tree = normalizeMuscleTree({ ...tree, cells, cellAt, updatedAt: nowIso() });
  } else if (op.kind === 'patchMuscleSets') {
    const sets = { ...(tree.sets || {}) };
    const patch = op.sets && typeof op.sets === 'object' ? op.sets : {};
    Object.entries(patch).forEach(([k, v]) => {
      const incoming = {
        v: encodeSetSpec(parseSetSpec(v?.v)),
        at: (typeof v?.at === 'number' && v.at > 0) ? v.at : (Date.parse(String(v?.at || '')) || atMs),
      };
      const cur = sets[k];
      if (!cur) {
        sets[k] = incoming;
        return;
      }
      if (incoming.at > cur.at) {
        sets[k] = incoming;
        return;
      }
      if (cur.at > incoming.at) return;
      // Equal stamp: non-empty wins.
      if (cur.v && !incoming.v) return;
      sets[k] = incoming;
    });
    tree = normalizeMuscleTree({ ...tree, sets, updatedAt: nowIso() });
  } else {
    return sheet;
  }

  return normalizeCalorie({
    ...sheet,
    muscleTree: tree,
    muscleTreeAt: tree.updatedAt || nowIso(),
    updatedAt: nowIso(),
  });
}

/** Build a setExerciseFav pending op. */
export function makeSetExerciseFavOp(exerciseId, on) {
  return {
    id: newOpId(),
    kind: 'setExerciseFav',
    exerciseId: String(exerciseId || '').trim(),
    on: Boolean(on),
    at: nowIso(),
  };
}

/**
 * Build a setExerciseMedia pending op.
 * New callers pass `entry` (object) or null to remove the id.
 * A bare yt string (no `entry` key on the op) stays 346-compatible.
 */
export function makeSetExerciseMediaOp(exerciseId, entryOrYt) {
  const exerciseIdNorm = String(exerciseId || '').trim();
  const at = nowIso();
  if (typeof entryOrYt === 'string') {
    return {
      id: newOpId(),
      kind: 'setExerciseMedia',
      exerciseId: exerciseIdNorm,
      yt: entryOrYt.trim(),
      at,
    };
  }
  if (entryOrYt == null) {
    return {
      id: newOpId(),
      kind: 'setExerciseMedia',
      exerciseId: exerciseIdNorm,
      entry: null,
      yt: '',
      at,
    };
  }
  const entry = entryOrYt && typeof entryOrYt === 'object' ? entryOrYt : null;
  const yt = entry ? String(entry.yt || '').trim() : '';
  return {
    id: newOpId(),
    kind: 'setExerciseMedia',
    exerciseId: exerciseIdNorm,
    entry,
    yt,
    at,
  };
}

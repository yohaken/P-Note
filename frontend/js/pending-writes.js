/**
 * Incremental pending-write queue for pre-hydrate / offline calorie edits.
 * Survives reload in localStorage; flushed by replaying ops on cloud base.
 */
import { STORAGE_KEYS } from './config.js?v=354';
import {
  appendQuickMeal,
  appendQuickExercise,
  normalizeCalorie,
  normalizeMeals,
  normalizeOpLog,
  OP_LOG_MAX,
  parseMealCell,
  formatMealCell,
  patchDay,
  ensureDay,
} from './calorie.js?v=354';
import {
  normalizeMuscleTree,
  setMoveLogNames,
  setMovePlanIds,
} from './muscle-tree.js?v=354';
import {
  normalizeExerciseFavs,
  normalizeExerciseMedia,
} from './settings.js?v=354';
import { nowIso } from './clock.js?v=354';
import { isQuotaError } from './local.js?v=354';

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
      const exercises = Array.isArray(day.exercises) ? day.exercises : [];
      exercises.forEach((cell) => {
        const text = String(cell || '').trim();
        if (!text) return;
        ops.push({ id: newOpId(), kind: 'appendExercise', dateKey, text, at });
      });
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

    const prevEx = (Array.isArray(before.exercises) ? before.exercises : []).map((c) => String(c || '').trim());
    const nextEx = (Array.isArray(day.exercises) ? day.exercises : []).map((c) => String(c || '').trim());
    const exLen = Math.max(prevEx.length, nextEx.length);
    for (let i = 0; i < Math.min(prevEx.length, exLen); i += 1) {
      if (prevEx[i] === nextEx[i]) continue;
      ops.push(nextEx[i]
        ? { id: newOpId(), kind: 'replaceExerciseSlot', dateKey, slot: i, text: nextEx[i], at }
        : { id: newOpId(), kind: 'clearExerciseSlot', dateKey, slot: i, at });
    }
    for (let i = prevEx.length; i < nextEx.length; i += 1) {
      if (!nextEx[i]) continue;
      ops.push({ id: newOpId(), kind: 'appendExercise', dateKey, text: nextEx[i], at });
    }
    if (String(before?.mus ?? '') !== String(day?.mus ?? '')) {
      ops.push({
        id: newOpId(),
        kind: 'patchDayScalars',
        dateKey,
        patch: { mus: day.mus ?? null },
        at,
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

  if (op.kind === 'setMovePlan' || op.kind === 'setMoveLog' || op.kind === 'patchMuscleCells') {
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

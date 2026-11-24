/**
 * Incremental pending-write queue for pre-hydrate / offline calorie edits.
 * Survives reload in localStorage; flushed by replaying ops on cloud base.
 */
import { STORAGE_KEYS } from './config.js?v=345';
import {
  appendQuickMeal,
  appendQuickExercise,
  normalizeCalorie,
  normalizeMeals,
  parseMealCell,
  formatMealCell,
  patchDay,
  ensureDay,
} from './calorie.js?v=345';
import { nowIso } from './clock.js?v=345';

/** Note is handled via appendMeal labels unless it is the only change. */
const SCALAR_KEYS = ['weight', 'waist', 'bodyFat', 'base', 'addCal', 'water'];

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
  } catch { /* quota */ }
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

/**
 * Diff previous calorie sheet vs next → incremental ops (not a full day snapshot).
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
    for (let i = prevEx.length; i < nextEx.length; i += 1) {
      if (!nextEx[i]) continue;
      ops.push({ id: newOpId(), kind: 'appendExercise', dateKey, text: nextEx[i], at });
    }
    // In-place exercise edits / clears → patch remaining list via scalars mus + exercises length mismatch:
    if (nextEx.length < prevEx.length || nextEx.slice(0, prevEx.length).some((c, i) => c !== prevEx[i])) {
      ops.push({
        id: newOpId(),
        kind: 'patchDayScalars',
        dateKey,
        patch: { exercises: nextEx, mus: day.mus ?? null },
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
  // Same length but last bit may have changed with the meal.
  if (nextBits.length && nextBits.length === prevBits.length + 0) {
    const idx = Math.min(slot, nextBits.length - 1);
    if (idx >= 0 && nextBits[idx] !== prevBits[idx]) return nextBits[idx] || '';
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
    calorie = applyOneOp(calorie, op);
  }
  return {
    ...notesData,
    calorie,
    updatedAt: nowIso(),
  };
}

export function applyOneOp(calorie, op) {
  if (!op?.kind) return calorie;
  const dateKey = String(op.dateKey || '').slice(0, 10);
  if (!dateKey) return calorie;

  if (op.kind === 'appendMeal') {
    const text = op.label
      ? `${op.label} ${Math.round(op.cal)},${Math.round(op.prot)}`
      : `${Math.round(op.cal)},${Math.round(op.prot)}`;
    try {
      return appendQuickMeal(calorie, text, dateKey, { label: op.label || '' }).sheet;
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
    return patchDay(sheet, day.id, { meals: normalizeMeals(meals) });
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

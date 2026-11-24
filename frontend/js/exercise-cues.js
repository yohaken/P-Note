/**
 * Lazy English instruction steps from free-exercise-db (detail sheet only).
 * Not imported from boot/app — callers must dynamic import() this module.
 */
const SHA = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const BASE = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${SHA}/exercises`;
const CACHE_NAME = 'pnote-ex-cues-v1';

const mem = new Map();

async function fromCacheStorage(url) {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (!hit || !hit.ok) return null;
    return await hit.json();
  } catch {
    return null;
  }
}

async function toCacheStorage(url, res) {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, res.clone());
  } catch { /* private mode / quota */ }
}

/**
 * @param {string} exerciseId free-exercise-db id
 * @returns {Promise<string[]>} English instruction steps (may be empty)
 */
export async function loadExerciseInstructions(exerciseId) {
  const id = String(exerciseId || '').trim();
  if (!id) return [];
  if (mem.has(id)) return mem.get(id);

  const url = `${BASE}/${encodeURIComponent(id)}.json`;
  try {
    const cached = await fromCacheStorage(url);
    if (cached) {
      const steps = normalizeSteps(cached);
      mem.set(id, steps);
      return steps;
    }
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) {
      mem.set(id, []);
      return [];
    }
    await toCacheStorage(url, res);
    const json = await res.json();
    const steps = normalizeSteps(json);
    mem.set(id, steps);
    return steps;
  } catch {
    mem.set(id, []);
    return [];
  }
}

function normalizeSteps(json) {
  const raw = Array.isArray(json?.instructions) ? json.instructions : [];
  return raw.map((s) => String(s || '').trim()).filter(Boolean);
}

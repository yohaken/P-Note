/**
 * Server-anchored clock for multi-device sync.
 *
 * Device clocks drift (timezone, NTP off, manual set) and that breaks merge
 * logic which compares client-stamped `updatedAt` fields. All new stamps are
 * therefore anchored to Firestore server time (captured from
 * DocumentSnapshot.readTime) so two devices compare timestamps in one shared
 * frame instead of each machine's local wall clock.
 */

let offsetMs = 0; // serverNowMs - clientNowMs

export function setClockOffset(serverNowMs, clientNowMs = Date.now()) {
  const off = Number(serverNowMs) - Number(clientNowMs);
  if (Number.isFinite(off)) offsetMs = off;
}

export function getClockOffsetMs() {
  return offsetMs;
}

/** Server-anchored "now" (falls back to the client clock before first anchor). */
export function nowMs() {
  return Date.now() + offsetMs;
}

export function nowIso() {
  return new Date(nowMs()).toISOString();
}

/** ISO string → epoch ms, tolerant of empty/invalid input (→ 0). */
export function stampMs(iso) {
  const t = new Date(iso || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * A stamp implausibly far in the future is almost always a client clock that
 * ran fast (or a legacy stamp written before the offset was known). Clamp it
 * back to server-now so it cannot dominate every later merge. Stamps within
 * tolerance are left untouched.
 */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export function clampStampMs(ms) {
  const m = Number(ms);
  if (!Number.isFinite(m) || m <= 0) return m;
  const cap = nowMs() + FUTURE_TOLERANCE_MS;
  return m > cap ? cap : m;
}

/**
 * Compare two client stamps in the shared (server-anchored) frame.
 * Returns >0 when `a` is newer, <0 when `b` is newer, 0 when effectively equal.
 */
export function compareStamp(aIso, bIso) {
  const a = clampStampMs(stampMs(aIso));
  const b = clampStampMs(stampMs(bIso));
  if (a > b) return 1;
  if (b > a) return -1;
  return 0;
}

/** Newer of two ISO stamps (empty treated as oldest). */
export function newerStampIso(aIso, bIso) {
  const a = stampMs(aIso);
  const b = stampMs(bIso);
  return a >= b ? (aIso || bIso) : (bIso || aIso);
}

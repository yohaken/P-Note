import crypto from 'node:crypto';
import { Router } from 'express';
import { adminAuth } from '../firebaseAdmin.js';

const router = Router();

/** @type {Map<string, { fails: number, until: number, last: number }>} */
const pinAttempts = new Map();

const GLOBAL_FAIL_WINDOW_MS = 15 * 60 * 1000;
const GLOBAL_LOCK_MS = 15 * 60 * 1000;
const GLOBAL_FAIL_THRESHOLD = 10;
/** @type {number[]} */
let globalFailAt = [];
let globalLockUntil = 0;

export function clientKey(req) {
  const xff = String(req.get?.('x-forwarded-for') || '').trim();
  const parts = xff ? xff.split(',') : [];
  // Cloud Run appends the real client IP last; client-supplied entries come first.
  return parts.length
    ? parts[parts.length - 1].trim()
    : String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function pruneAttempts(now) {
  for (const [ip, entry] of pinAttempts) {
    if (now - entry.last > 60 * 60 * 1000 && entry.until < now) pinAttempts.delete(ip);
  }
  globalFailAt = globalFailAt.filter((t) => now - t < GLOBAL_FAIL_WINDOW_MS);
}

function recordGlobalFail(now) {
  globalFailAt = globalFailAt.filter((t) => now - t < GLOBAL_FAIL_WINDOW_MS);
  globalFailAt.push(now);
  if (globalFailAt.length >= GLOBAL_FAIL_THRESHOLD) {
    globalLockUntil = now + GLOBAL_LOCK_MS;
  }
}

function pinHashOk(pin, expectedHex) {
  const got = crypto.createHash('sha256').update(String(pin || ''), 'utf8').digest();
  let expected;
  try {
    expected = Buffer.from(expectedHex, 'hex');
  } catch {
    return false;
  }
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(got, expected);
}

/** Per-key lock duration: fails≥5 → exponential backoff, capped at 15 min. */
function backoffMs(fails) {
  const exp = Math.max(0, fails - 5);
  return Math.min(15 * 60 * 1000, 60_000 * (2 ** Math.min(exp, 4)));
}

router.post('/auth/pin', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const expected = String(process.env.PNOTE_PIN_SHA256 || '').trim().toLowerCase();
  if (!expected || !/^[0-9a-f]{64}$/.test(expected)) {
    res.status(503).json({ error: 'pin_not_configured' });
    return;
  }

  const now = Date.now();
  pruneAttempts(now);
  const key = clientKey(req);
  const entry = pinAttempts.get(key) || { fails: 0, until: 0, last: now };
  entry.last = now;

  if (globalLockUntil > now) {
    const retryAfterSec = Math.ceil((globalLockUntil - now) / 1000);
    pinAttempts.set(key, entry);
    res.status(429).json({ error: 'too_many', retryAfterSec, scope: 'global' });
    return;
  }

  if (entry.until > now) {
    const retryAfterSec = Math.ceil((entry.until - now) / 1000);
    pinAttempts.set(key, entry);
    res.status(429).json({ error: 'too_many', retryAfterSec });
    return;
  }

  const pin = req.body?.pin;
  if (!pinHashOk(pin, expected)) {
    entry.fails += 1;
    recordGlobalFail(now);
    // Monotonic fail count — never reset on quiet. Lock after 5 fails.
    if (entry.fails >= 5) {
      entry.until = now + backoffMs(entry.fails);
    }
    pinAttempts.set(key, entry);
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  pinAttempts.delete(key);
  try {
    const token = await adminAuth().createCustomToken('pnote-owner', { pnote: true });
    res.json({ customToken: token, expiresInSec: 3600 });
  } catch {
    res.status(503).json({ error: 'token_failed' });
  }
});

/** Test-only: clear in-memory limiter between cases. */
export function __resetPinLimiterForTests() {
  pinAttempts.clear();
  globalFailAt = [];
  globalLockUntil = 0;
}

export default router;

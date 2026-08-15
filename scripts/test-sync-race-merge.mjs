/**
 * Regression: concurrent phone/desktop edits must union by id (LWW per entity).
 * Simulates the merge that runs inside pushRemoteNotesMerged's transaction
 * when device B retries after device A's write.
 *
 * Run: node scripts/test-sync-race-merge.mjs
 */
import { mergeNotesByUpdatedAt, localNeedsRemotePush, hasCloudContent } from '../frontend/js/import-data.js';
import { normalizeCalorie } from '../frontend/js/calorie.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('ok:', msg);
  }
}

const base = {
  version: 8,
  updatedAt: '2026-08-15T00:00:00.000Z',
  tags: [],
  notes: [],
  workspaces: [],
  notepads: [],
  homePins: [],
  homePinsAt: '',
  calorie: normalizeCalorie({
    updatedAt: '2026-08-15T00:00:00.000Z',
    days: [
      {
        id: 'day-shared',
        date: '2026-08-15',
        weight: 70,
        waist: 80,
        meals: ['100,10'],
        mus: '',
        updatedAt: '2026-08-15T00:00:00.000Z',
      },
    ],
  }),
};

/** Phone adds a new note + meal while computer still has base. */
const phoneLocal = {
  ...base,
  updatedAt: '2026-08-15T01:00:00.000Z',
  notes: [
    {
      id: 'n-phone',
      title: 'จากมือถือ',
      content: 'ใหม่',
      status: 'active',
      updatedAt: '2026-08-15T01:00:00.000Z',
      createdAt: '2026-08-15T01:00:00.000Z',
    },
  ],
  calorie: normalizeCalorie({
    updatedAt: '2026-08-15T01:00:00.000Z',
    days: [
      {
        id: 'day-shared',
        date: '2026-08-15',
        weight: 70,
        waist: 80,
        meals: ['100,10', '250,20'],
        mus: '',
        updatedAt: '2026-08-15T01:00:00.000Z',
      },
    ],
  }),
};

/** Computer adds a different note while still reading base (stale). */
const computerLocal = {
  ...base,
  updatedAt: '2026-08-15T01:00:05.000Z',
  notes: [
    {
      id: 'n-computer',
      title: 'จากคอม',
      content: 'ใหม่',
      status: 'active',
      updatedAt: '2026-08-15T01:00:05.000Z',
      createdAt: '2026-08-15T01:00:05.000Z',
    },
  ],
  notepads: [
    {
      id: 'pad-computer',
      name: 'โน้ตคอม',
      content: 'hello',
      updatedAt: '2026-08-15T01:00:05.000Z',
      createdAt: '2026-08-15T01:00:05.000Z',
    },
  ],
};

// Old broken path: computer setDoc(computerLocal) after phone setDoc(phoneLocal)
// → phone note + meal gone. Correct path: merge computerLocal with phone's cloud.
const cloudAfterPhone = mergeNotesByUpdatedAt(phoneLocal, base);
const afterTxnRetry = mergeNotesByUpdatedAt(computerLocal, cloudAfterPhone);

const noteIds = new Set((afterTxnRetry.notes || []).map((n) => n.id));
assert(noteIds.has('n-phone'), 'txn retry keeps phone note');
assert(noteIds.has('n-computer'), 'txn retry keeps computer note');
assert(
  (afterTxnRetry.notepads || []).some((p) => p.id === 'pad-computer'),
  'txn retry keeps computer notepad',
);

const day = (afterTxnRetry.calorie?.days || []).find((d) => d.date === '2026-08-15');
assert(Boolean(day), 'shared calorie day present');
assert(
  Array.isArray(day.meals) && day.meals.includes('250,20'),
  'phone meal survives computer concurrent save',
);

assert(localNeedsRemotePush(phoneLocal, base), 'phone local needs push vs base');
assert(localNeedsRemotePush(computerLocal, cloudAfterPhone), 'computer still needs push after phone');
assert(hasCloudContent(afterTxnRetry), 'merged doc has cloud content');

// Blind overwrite simulation (what setDoc without merge did)
const blind = computerLocal;
assert(
  !(blind.notes || []).some((n) => n.id === 'n-phone'),
  'sanity: blind computer snapshot lacks phone note (the bug)',
);

console.log(process.exitCode ? 'DONE with failures' : 'ALL PASS');

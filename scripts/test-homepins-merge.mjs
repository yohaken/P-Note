/**
 * Regression: home pin layout must survive newer meal edits on the other device.
 * Run: node scripts/test-homepins-merge.mjs
 */
import { mergeCalorieByUpdatedAt, normalizeCalorie } from '../frontend/js/calorie.js';
import { mergeNotesByUpdatedAt, localNeedsRemotePush } from '../frontend/js/import-data.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('ok:', msg);
  }
}

const day = (id, date, meals, updatedAt) => ({
  id, date, weight: 70, waist: 80, meals, mus: '', updatedAt,
});

const withPins = normalizeCalorie({
  updatedAt: '2026-08-13T01:00:00.000Z',
  homePins: ['chart-waist', 'chart-cal', 'card-bmi'],
  homePinsAt: '2026-08-13T01:00:00.000Z',
  days: [day('d1', '2026-08-13', ['100,10'], '2026-08-13T01:00:00.000Z')],
});

const newerMeal = normalizeCalorie({
  updatedAt: '2026-08-13T02:00:00.000Z',
  homePins: [],
  homePinsAt: '',
  days: [day('d1', '2026-08-13', ['200,20'], '2026-08-13T02:00:00.000Z')],
});

const mergedCal = mergeCalorieByUpdatedAt(newerMeal, withPins);
assert(
  JSON.stringify(mergedCal.homePins) === JSON.stringify(['chart-waist', 'chart-cal', 'card-bmi']),
  'calorie merge keeps pins after newer meal',
);

const localDoc = {
  version: 8,
  updatedAt: '2026-08-13T02:00:00.000Z',
  tags: [],
  notes: [],
  workspaces: [],
  notepads: [],
  homePins: [],
  homePinsAt: '',
  calorie: newerMeal,
};
const remoteDoc = {
  version: 8,
  updatedAt: '2026-08-13T01:00:00.000Z',
  tags: [],
  notes: [],
  workspaces: [],
  notepads: [],
  homePins: ['chart-waist', 'ex-mus'],
  homePinsAt: '2026-08-13T01:05:00.000Z',
  calorie: withPins,
};

const mergedDoc = mergeNotesByUpdatedAt(localDoc, remoteDoc);
assert(
  JSON.stringify(mergedDoc.homePins) === JSON.stringify(['chart-waist', 'ex-mus']),
  'notes merge keeps root homePins by homePinsAt',
);
assert(
  JSON.stringify(mergedDoc.calorie.homePins) === JSON.stringify(['chart-waist', 'ex-mus']),
  'nested calorie.homePins mirrors root',
);

const cleared = {
  ...remoteDoc,
  homePins: [],
  homePinsAt: '2026-08-13T03:00:00.000Z',
  calorie: { ...withPins, homePins: [], homePinsAt: '2026-08-13T03:00:00.000Z' },
};
const clearedMerge = mergeNotesByUpdatedAt(remoteDoc, cleared);
assert(
  JSON.stringify(clearedMerge.homePins) === '[]',
  'intentional clear wins with newer homePinsAt',
);

const needsPush = localNeedsRemotePush(
  { ...localDoc, homePins: ['chart-waist'], homePinsAt: '2026-08-13T04:00:00.000Z', calorie: { ...newerMeal, homePins: ['chart-waist'], homePinsAt: '2026-08-13T04:00:00.000Z' } },
  remoteDoc,
);
assert(needsPush === true, 'localNeedsRemotePush true when local pins newer');

if (process.exitCode) {
  console.error('homepins merge tests failed');
  process.exit(1);
}
console.log('all homepins merge tests passed');

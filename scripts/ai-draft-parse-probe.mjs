/**
 * Probe AI draft parsing / title+summary sanitization.
 * Run: node scripts/ai-draft-parse-probe.mjs
 */
import {
  draftFromModelText,
  ensureLeadingEmoji,
  isJunkTitle,
  sanitizeNoteTitle,
  sanitizeNoteSummary,
} from '../frontend/js/gemini.js';

const source = 'พรุ่งนี้เช้าไปตรวจโฉนดที่ดินที่สระบุรี ด่วนมาก อย่าลืมเอกสาร นส.3';

const cases = [
  {
    name: 'valid json',
    model: JSON.stringify({
      title: '🏞️ ตรวจโฉนดที่ดิน',
      summary: 'ไปสระบุรี พรุ่งนี้เช้า พก นส.3',
      tags: ['ที่ดิน'],
      priority: 'urgent',
      scheduledAt: null,
      recurrence: null,
    }),
    expectTitleIncludes: 'ตรวจโฉนด',
    expectSummaryIncludes: 'สระบุรี',
  },
  {
    name: 'user bug: brace crumbs',
    model: '{ ,',
    expectTitleIncludes: 'โฉนด',
    expectSummaryIncludes: 'โฉนด',
    rejectTitle: /[{},]/,
  },
  {
    name: 'truncated json first line',
    model: '{\n"title": "🚗 ไปเที่ยว",\n"summary": "เชียงใหม่"\n',
    expectTitleIncludes: 'ไปเที่ยว',
    expectSummaryIncludes: 'เชียงใหม่',
  },
  {
    name: 'markdown title',
    model: '{"title":"**🚗 ไปเที่ยว**","summary":"แพลนทริป"}',
    expectTitle: '🚗 ไปเที่ยว',
    expectSummaryIncludes: 'แพลน',
  },
  {
    name: 'fenced json',
    model: '```json\n{"title":"💼 ประชุมทีม","summary":"10:00 ห้อง A"}\n```',
    expectTitle: '💼 ประชุมทีม',
    expectSummaryIncludes: 'ห้อง',
  },
  {
    name: 'prose before json',
    model: 'นี่คือผลลัพธ์\n{"title":"🛒 ซื้อของ","summary":"นม ไข่"}\nจบ',
    expectTitle: '🛒 ซื้อของ',
    expectSummaryIncludes: 'นม',
  },
  {
    name: 'title is opening brace',
    model: '{"title":"{","summary":"เนื้อหาจริงเกี่ยวกับที่ดิน"}',
    expectTitleIncludes: 'โฉนด',
    expectSummaryIncludes: 'ที่ดิน',
    rejectTitle: /[{}]/,
  },
  {
    name: 'title empty quotes',
    model: '{"title":"","summary":"จองร้านอาหารเย็น"}',
    expectTitleIncludes: 'โฉนด',
    expectSummaryIncludes: 'ร้านอาหาร',
  },
  {
    name: 'quoted title',
    model: '{"title":"\\"🏞️ ตรวจโฉนด\\"","summary":"เอกสารครบ"}',
    expectTitleIncludes: 'ตรวจโฉนด',
  },
  {
    name: 'hash heading',
    model: '{"title":"### ประชุม","summary":"วาระ 1"}',
    expectTitle: '📝 ประชุม',
  },
  {
    name: 'raw json dumped as title path',
    model: '{\n  "title": "📝 { ,",\n  "summary": "{ \\"a\\": 1 }"\n}',
    expectTitleIncludes: 'โฉนด',
    rejectTitle: /[{},]/,
    rejectSummary: /^\s*\{/,
  },
  {
    name: 'trailing comma json',
    model: '{"title":"🏠 งานบ้าน","summary":"ทำความสะอาด",}',
    expectTitle: '🏠 งานบ้าน',
    expectSummaryIncludes: 'ทำความสะอาด',
  },
];

let failed = 0;
for (const c of cases) {
  const draft = draftFromModelText(c.model, source);
  const title = draft.title;
  const summary = draft.summary;
  const problems = [];

  if (c.expectTitle && title !== c.expectTitle) {
    problems.push(`title want ${JSON.stringify(c.expectTitle)} got ${JSON.stringify(title)}`);
  }
  if (c.expectTitleIncludes && !title.includes(c.expectTitleIncludes)) {
    problems.push(`title missing ${c.expectTitleIncludes}: ${JSON.stringify(title)}`);
  }
  if (c.expectSummaryIncludes && !summary.includes(c.expectSummaryIncludes)) {
    problems.push(`summary missing ${c.expectSummaryIncludes}: ${JSON.stringify(summary)}`);
  }
  if (c.rejectTitle && c.rejectTitle.test(title)) {
    problems.push(`title still junk: ${JSON.stringify(title)}`);
  }
  if (c.rejectSummary && c.rejectSummary.test(summary)) {
    problems.push(`summary still junk: ${JSON.stringify(summary.slice(0, 80))}`);
  }
  if (isJunkTitle(sanitizeNoteTitle(title.replace(/^📝\s*/, ''))) && !title.endsWith('โน้ต')) {
    // allow default 📝 โน้ต only
  }
  if (/[{}]/.test(title) || title.includes('{ ,') || title.trim() === '📝 { ,') {
    problems.push(`title has brace junk: ${JSON.stringify(title)}`);
  }
  if (!title.match(/^\S+\s+\S/)) {
    problems.push(`title not emoji+text: ${JSON.stringify(title)}`);
  }

  if (problems.length) {
    failed += 1;
    console.error(`FAIL ${c.name}`);
    problems.forEach((p) => console.error('  -', p));
  } else {
    console.log(`OK   ${c.name} → ${title}`);
  }
}

// Direct sanitizer checks
const direct = [
  ['{ ,', ''],
  ['📝 { ,', ''],
  ['{', ''],
  [',', ''],
  ['**🚗 ไป**', '🚗 ไป'],
];
for (const [inn, want] of direct) {
  const got = sanitizeNoteTitle(inn);
  if (want === '' ? got !== '' : got !== want) {
    // for empty want, got must be empty; for non-empty exact
    if (want === '') {
      if (got !== '') {
        failed += 1;
        console.error('FAIL sanitize', { inn, got, want });
      } else console.log('OK   sanitize empty', JSON.stringify(inn));
    } else if (got !== want) {
      failed += 1;
      console.error('FAIL sanitize', { inn, got, want });
    }
  } else {
    console.log('OK   sanitize', JSON.stringify(inn), '→', JSON.stringify(got || ensureLeadingEmoji(got)));
  }
}

if (failed) {
  console.error(`\nPROBE_FAIL ${failed}`);
  process.exit(1);
}
console.log('\nPROBE_OK all draft formats look user-normal');

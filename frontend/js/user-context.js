/**
 * User context memory for AI note drafting.
 * Learns roughly from existing notes/tags and stores a compact .md profile.
 */
import { NOTE_STATUS, notePriority, NOTE_PRIORITY } from './notes.js?v=86';

/** Keep in sync with STORAGE_KEYS.USER_CONTEXT_MD in config.js */
const CONTEXT_KEY = 'pnote_user_context_md';
const MAX_MD_CHARS = 4500;
const MAX_KEYWORDS_PER_TAG = 8;
const MAX_RECENT = 12;

const STOP = new Set([
  'และ',
  'หรือ',
  'ที่',
  'ใน',
  'ของ',
  'เป็น',
  'ให้',
  'ได้',
  'แล้ว',
  'กับ',
  'จาก',
  'นี้',
  'นั้น',
  'จะ',
  'ไม่',
  'มี',
  'ไป',
  'มา',
  'ทำ',
  'การ',
  'เพื่อ',
  'ครับ',
  'ค่ะ',
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'a',
  'an',
  'to',
  'of',
  'in',
  'on',
]);

const URGENT_HINTS = ['ด่วน', 'เร่ง', 'ทันที', 'วันนี้', 'พรุ่งนี้เช้า', 'asap', 'urgent', 'เลย', 'ด่วนมาก'];
const IMPORTANT_HINTS = ['สำคัญ', 'ต้อง', 'จำเป็น', 'critical', 'สำคัญมาก', 'ห้ามลืม', 'deadline'];
const CRITICAL_HINTS = ['วิกฤต', 'ฉุกเฉิน', 'critical', 'สำคัญเร่งด่วน', 'ไฟไหม้'];

function tokenize(text) {
  let raw = String(text || '').toLowerCase();
  try {
    raw = raw.replace(/[\u{1F300}-\u{1FAFF}]/gu, ' ');
    raw = raw.replace(/[^\p{L}\p{N}\s._-]/gu, ' ');
  } catch {
    raw = raw.replace(/[^\w\u0E00-\u0E7F\s._-]+/g, ' ');
  }
  const parts = raw.split(/[\s/|,;:·\-–—]+/).filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (p.length < 2 || STOP.has(p)) continue;
    out.push(p);
    if (/[\u0E00-\u0E7F]/.test(p) && p.length >= 6) {
      for (let i = 0; i < p.length - 2; i += 2) {
        const chunk = p.slice(i, i + 3);
        if (chunk.length >= 3 && !STOP.has(chunk)) out.push(chunk);
      }
    }
  }
  return out;
}

function topCounts(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function activeNotes(notesData) {
  return (notesData?.notes || []).filter((n) => n && n.status === NOTE_STATUS.ACTIVE);
}

/**
 * Build structured stats + markdown memory from the user's notes.
 * @param {object} notesData
 */
export function buildUserContext(notesData) {
  const tags = Array.isArray(notesData?.tags) ? notesData.tags : [];
  const notes = activeNotes(notesData);
  const tagById = new Map(tags.map((t) => [t.id, t]));

  const tagUse = new Map();
  const tagKeywords = new Map(); // tagName -> Map(word -> count)
  const tagPriority = new Map(); // tagName -> Map(priority -> count)
  const tagRecurrence = new Map();

  for (const note of notes) {
    const ids = Array.isArray(note.tagIds) ? note.tagIds : [];
    const words = tokenize(`${note.title || ''} ${note.content || ''}`);
    const pri = notePriority(note);
    for (const id of ids) {
      const tag = tagById.get(id);
      if (!tag?.name) continue;
      const name = tag.name;
      tagUse.set(name, (tagUse.get(name) || 0) + 1);

      if (!tagKeywords.has(name)) tagKeywords.set(name, new Map());
      const km = tagKeywords.get(name);
      for (const w of words) km.set(w, (km.get(w) || 0) + 1);

      if (!tagPriority.has(name)) tagPriority.set(name, new Map());
      const pm = tagPriority.get(name);
      pm.set(pri, (pm.get(pri) || 0) + 1);

      if (note.recurrence) {
        if (!tagRecurrence.has(name)) tagRecurrence.set(name, new Map());
        const rm = tagRecurrence.get(name);
        rm.set(note.recurrence, (rm.get(note.recurrence) || 0) + 1);
      }
    }
  }

  const tagProfiles = topCounts(tagUse, 24).map(([name, count]) => {
    const kw = topCounts(tagKeywords.get(name) || new Map(), MAX_KEYWORDS_PER_TAG).map(([w]) => w);
    const priMap = tagPriority.get(name) || new Map();
    const topPri = topCounts(priMap, 1)[0]?.[0] || NOTE_PRIORITY.NORMAL;
    return { name, count, keywords: kw, typicalPriority: topPri };
  });

  const recent = [...notes]
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, MAX_RECENT)
    .map((n) => {
      const tnames = (n.tagIds || [])
        .map((id) => tagById.get(id)?.name)
        .filter(Boolean)
        .slice(0, 3);
      return {
        title: String(n.title || 'ไม่มีหัวข้อ').slice(0, 60),
        tags: tnames,
        priority: notePriority(n),
      };
    });

  const md = renderContextMarkdown({
    updatedAt: new Date().toISOString(),
    tagProfiles,
    recent,
    noteCount: notes.length,
    tagCount: tags.length,
  });

  return {
    md,
    tagProfiles,
    recent,
    noteCount: notes.length,
    tagCount: tags.length,
  };
}

function renderContextMarkdown({ updatedAt, tagProfiles, recent, noteCount, tagCount }) {
  const lines = [
    '# P-Note · ความจำผู้ใช้',
    '',
    `อัปเดต: ${updatedAt}`,
    `โน้ตใช้งาน: ${noteCount} · แท็ก: ${tagCount}`,
    '',
    '## แท็กที่ใช้อยู่ (เรียงตามความถี่)',
  ];

  if (!tagProfiles.length) {
    lines.push('- (ยังน้อย — เรียนรู้เพิ่มเมื่อมีโน้ต/แท็ก)');
  } else {
    for (const t of tagProfiles) {
      const kw = t.keywords.length ? ` · คำที่เจอบ่อย: ${t.keywords.join(', ')}` : '';
      const pri =
        t.typicalPriority && t.typicalPriority !== NOTE_PRIORITY.NORMAL
          ? ` · มักเป็น ${t.typicalPriority}`
          : '';
      lines.push(`- ${t.name} (${t.count})${kw}${pri}`);
    }
  }

  lines.push('', '## โน้ตล่าสุด (ย่อ)');
  if (!recent.length) {
    lines.push('- (ยังไม่มี)');
  } else {
    for (const r of recent) {
      const tags = r.tags.length ? ` [${r.tags.join(', ')}]` : '';
      const pri = r.priority !== NOTE_PRIORITY.NORMAL ? ` · ${r.priority}` : '';
      lines.push(`- ${r.title}${tags}${pri}`);
    }
  }

  lines.push(
    '',
    '## วิธีใช้ความจำนี้',
    '- เลือกแท็กที่มีอยู่ก่อน ถ้าเนื้อหาใกล้เคียงคำที่เจอบ่อยของแท็กนั้น',
    '- ตัวอย่าง: เนื้อหาเรื่องที่ดิน/โฉนด/ไร่ → ใช้แท็กที่เกี่ยวกับที่ดินถ้ามีในรายการ',
    '- ความสำคัญ: ดูนิสัยแท็ก + คำว่าด่วน/สำคัญในข้อความ',
    '- สร้างแท็กใหม่เฉพาะเมื่อไม่มีแท็กเดิมที่ใกล้เคียง',
    '',
  );

  let md = lines.join('\n');
  if (md.length > MAX_MD_CHARS) md = `${md.slice(0, MAX_MD_CHARS - 20)}\n…\n`;
  return md;
}

export function loadUserContextMd() {
  try {
    return String(localStorage.getItem(CONTEXT_KEY) || '');
  } catch {
    return '';
  }
}

export function saveUserContextMd(md) {
  try {
    localStorage.setItem(CONTEXT_KEY, String(md || ''));
  } catch (err) {
    console.warn('save user context failed', err);
  }
}

/** Rebuild + persist markdown memory from current notes. */
export function refreshUserContext(notesData) {
  const ctx = buildUserContext(notesData);
  saveUserContextMd(ctx.md);
  return ctx;
}

/**
 * Score existing tags against free text using learned keywords.
 * @returns {Array<{ name: string, score: number, typicalPriority: string }>}
 */
export function rankTagsForText(text, notesData) {
  const ctx = buildUserContext(notesData);
  const words = new Set(tokenize(text));
  if (!words.size && !ctx.tagProfiles.length) return [];

  return ctx.tagProfiles
    .map((t) => {
      let score = 0;
      const nameKey = t.name.toLowerCase();
      if ([...words].some((w) => nameKey.includes(w) || w.includes(nameKey))) score += 5;
      // substring match for Thai compound titles
      const blob = String(text || '').toLowerCase();
      if (blob.includes(nameKey)) score += 6;
      for (const kw of t.keywords) {
        if (words.has(kw) || blob.includes(kw)) score += 2;
      }
      score += Math.min(3, Math.log2((t.count || 1) + 1));
      return { name: t.name, score, typicalPriority: t.typicalPriority };
    })
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function hintPriorityFromText(text) {
  const s = String(text || '').toLowerCase();
  if (CRITICAL_HINTS.some((h) => s.includes(h))) return NOTE_PRIORITY.CRITICAL;
  if (URGENT_HINTS.some((h) => s.includes(h))) return NOTE_PRIORITY.URGENT;
  if (IMPORTANT_HINTS.some((h) => s.includes(h))) return NOTE_PRIORITY.IMPORTANT;
  return null;
}

const PRI_RANK = {
  [NOTE_PRIORITY.NORMAL]: 0,
  [NOTE_PRIORITY.IMPORTANT]: 1,
  [NOTE_PRIORITY.URGENT]: 2,
  [NOTE_PRIORITY.CRITICAL]: 3,
};

function maxPriority(a, b) {
  return (PRI_RANK[a] || 0) >= (PRI_RANK[b] || 0) ? a : b;
}

/**
 * Refine AI draft using local history: prefer known tags, tune priority.
 * @param {object} draft
 * @param {object} notesData
 * @param {string} sourceText
 */
export function refineDraftWithContext(draft, notesData, sourceText) {
  const next = { ...draft, tags: Array.isArray(draft.tags) ? [...draft.tags] : [] };
  const ranked = rankTagsForText(
    `${sourceText || ''}\n${draft.title || ''}\n${draft.summary || ''}`,
    notesData,
  );
  const existingNames = new Set((notesData?.tags || []).map((t) => t.name.toLowerCase()));

  // Merge: keep AI tags that match existing (case-insensitive), else swap in top ranked
  const resolved = [];
  const seen = new Set();

  const pushTag = (name) => {
    const n = String(name || '').trim();
    if (!n) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    // Prefer canonical existing casing
    const existing = (notesData?.tags || []).find((t) => t.name.toLowerCase() === key);
    const finalName = existing?.name || n;
    seen.add(key);
    resolved.push(finalName);
  };

  // 1) AI tags that already exist
  for (const name of next.tags) {
    if (existingNames.has(String(name).toLowerCase())) pushTag(name);
  }
  // 2) Top ranked from history if still room
  for (const r of ranked) {
    if (resolved.length >= 3) break;
    if (r.score >= 3) pushTag(r.name);
  }
  // 3) Remaining AI suggestions (may create new) if still empty/room
  for (const name of next.tags) {
    if (resolved.length >= 3) break;
    pushTag(name);
  }
  // 4) If still empty but we have a strong history match
  if (!resolved.length && ranked[0] && ranked[0].score >= 4) {
    pushTag(ranked[0].name);
  }

  next.tags = resolved.slice(0, 3);

  // Priority: max of AI, text hints, and typical priority of matched tags
  let pri = next.priority || NOTE_PRIORITY.NORMAL;
  const hinted = hintPriorityFromText(`${sourceText || ''} ${draft.title || ''} ${draft.summary || ''}`);
  if (hinted) pri = maxPriority(pri, hinted);
  for (const r of ranked.slice(0, 2)) {
    if (r.score >= 4 && r.typicalPriority) pri = maxPriority(pri, r.typicalPriority);
  }
  next.priority = Object.values(NOTE_PRIORITY).includes(pri) ? pri : NOTE_PRIORITY.NORMAL;

  return next;
}

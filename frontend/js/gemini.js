/**
 * Gemini API helpers for P-Note (browser → Google AI REST).
 * API key stays on-device in settings; never logged.
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/** Shown before API list loads / as fallbacks */
export const FALLBACK_GEMINI_MODELS = [
  { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro (ฉลาด)' },
  { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash (เร็ว)' },
  { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
  { id: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite (เบา)' },
];

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const API_MODELS = `${API_ROOT}/models`;

const PRIORITIES = new Set(['normal', 'important', 'urgent', 'critical']);
const RECURRENCES = new Set(['daily', 'weekly', 'monthly', 'yearly']);

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
}

function extractJsonField(body, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i');
  const m = String(body || '').match(re);
  if (!m) return null;
  try {
    return JSON.parse(`"${m[1]}"`);
  } catch {
    return m[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

function extractJsonArrayField(body, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*(\\[(.*?)\\])`, 'is');
  const m = String(body || '').match(re);
  if (!m) return null;
  try {
    const arr = JSON.parse(m[1]);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

/** Parse model output into a plain object; tolerate fences / trailing junk. */
export function parseJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let body = (fenced ? fenced[1] : raw).trim();
  // Strip BOM / leading prose before first {
  const brace = body.indexOf('{');
  if (brace > 0) body = body.slice(brace);
  const end = body.lastIndexOf('}');
  if (end > 0) body = body.slice(0, end + 1);

  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(body);
  if (parsed && typeof parsed === 'object') return parsed;

  // Trailing commas
  parsed = tryParse(body.replace(/,\s*([}\]])/g, '$1'));
  if (parsed && typeof parsed === 'object') return parsed;

  // Field-level salvage when JSON is truncated/broken
  const title = extractJsonField(body, 'title');
  const summary = extractJsonField(body, 'summary') || extractJsonField(body, 'content');
  if (title || summary) {
    return {
      title: title || '',
      summary: summary || '',
      tags: extractJsonArrayField(body, 'tags') || extractJsonArrayField(body, 'tagNames') || [],
      scheduledAt: extractJsonField(body, 'scheduledAt') || extractJsonField(body, 'dueAt'),
      priority: extractJsonField(body, 'priority'),
      recurrence: extractJsonField(body, 'recurrence'),
    };
  }
  return null;
}

const JSONISH_TITLE = /^[\s{[\],":}\\]+$/;
const JSON_KEY_WORDS = /^(title|summary|content|tags|priority|scheduledat|recurrence|null|true|false)$/i;

/** True if string looks like JSON debris, not a human title. */
export function isJunkTitle(value) {
  const t = String(value || '').trim();
  if (!t) return true;
  if (t.length <= 2 && /[{}\[\]",:]/.test(t)) return true;
  if (JSONISH_TITLE.test(t)) return true;
  if (/^[{[]/.test(t) && /[}\]]$/.test(t) && t.includes(':')) return true;
  if (JSON_KEY_WORDS.test(t.replace(/^📝\s*/, ''))) return true;
  // Mostly punctuation / braces
  let letters = t;
  try {
    letters = t.replace(/[\p{Extended_Pictographic}\s]/gu, '');
  } catch {
    letters = t.replace(/\s/g, '');
  }
  try {
    if (letters && !/[\p{L}\p{N}]/u.test(letters)) return true;
  } catch {
    if (letters && !/[A-Za-z0-9\u0E00-\u0E7F]/.test(letters)) return true;
  }
  if (/^[{[]/.test(t) || /^",?\s*$/.test(t) || /^,\s*$/.test(t)) return true;
  return false;
}

/** Strip markdown / technical wrappers from AI titles. */
export function sanitizeNoteTitle(raw) {
  let t = String(raw ?? '')
    .replace(/\r/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();

  for (let i = 0; i < 4; i += 1) {
    const prev = t;
    t = t.replace(/^["'`“”‘’«»]+|["'`“”‘’«»]+$/g, '').trim();
    t = t.replace(/^#+\s*/, '').trim();
    t = t.replace(/^\*\*\s*|\s*\*\*$/g, '').trim();
    t = t.replace(/^__\s*|\s*__$/g, '').trim();
    t = t.replace(/^`+|`+$/g, '').trim();
    t = t.replace(/^\[+|\]+$/g, '').trim();
    t = t.replace(/^\(+|\)+$/g, '').trim();
    t = t.replace(/^【+|】+$/g, '').trim();
    t = t.replace(/^\{+\s*|\s*\}+$/g, '').trim();
    if (t === prev) break;
  }

  t = t.replace(/\*\*/g, '').replace(/__/g, '').replace(/`/g, '');
  t = t.replace(/^[\s|*_#>\-–—•·{},[\]]+/, '').trim();
  t = t.replace(/[\s|*_#>\-–—•·{},[\]]+$/, '').trim();
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/^:[a-z0-9_+-]+:\s*/i, '').trim();
  // Drop leading JSON crumbs like `{ ,` or `"title":`
  t = t.replace(/^[{}\[\]",:]+/, '').trim();
  t = t.replace(/^title\s*[:=]\s*/i, '').trim();

  // Must contain real letters/numbers — emoji-only or punctuation-only is junk
  let textOnly = t;
  try {
    textOnly = t
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/[\uFE0F\u200D]/g, '')
      .trim();
  } catch {
    textOnly = t.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim();
  }
  let hasWord = false;
  try {
    hasWord = /[\p{L}\p{N}]/u.test(textOnly);
  } catch {
    hasWord = /[A-Za-z0-9\u0E00-\u0E7F]/.test(textOnly);
  }
  if (!hasWord) return '';

  if (isJunkTitle(textOnly)) return '';
  return t.slice(0, 120);
}

export function sanitizeNoteSummary(raw) {
  let t = String(raw ?? '')
    .replace(/\r/g, '')
    .replace(/\\n/g, '\n')
    .trim();
  // If whole summary is raw JSON, don't show it
  if (/^\s*[{[]/.test(t) && /[}\]]\s*$/.test(t) && /"(title|summary|tags)"/.test(t)) {
    return '';
  }
  t = t.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
  // Unwrap accidental quotes
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t.slice(0, 8000);
}

function isLeadingEmojiChar(ch) {
  if (!ch) return false;
  try {
    return /\p{Extended_Pictographic}/u.test(ch);
  } catch {
    return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(ch);
  }
}

/** Clean title + ensure one real emoji prefix (no markdown / technical marks). */
export function ensureLeadingEmoji(title) {
  let t = sanitizeNoteTitle(title);
  if (!t || isJunkTitle(t)) return '📝 โน้ต';

  let emoji = '';
  let rest = t;
  try {
    const m = t.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*(.*)$/u);
    if (m) {
      emoji = m[1];
      rest = sanitizeNoteTitle(m[2]);
    }
  } catch {
    const first = [...t][0];
    if (isLeadingEmojiChar(first)) {
      emoji = first;
      rest = sanitizeNoteTitle(t.slice(first.length));
    }
  }

  if (emoji && /^[*#_`|\\/<>{}[\]§†‡※,."']+$/.test(emoji)) {
    emoji = '';
    rest = sanitizeNoteTitle(t);
  }

  if (!rest || isJunkTitle(rest)) rest = 'โน้ต';
  try {
    rest = rest.replace(/^\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\s*/u, '').trim() || rest;
  } catch {
    /* ignore */
  }
  if (isJunkTitle(rest)) rest = 'โน้ต';

  return `${emoji || '📝'} ${rest}`.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function humanLineFromText(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => sanitizeNoteTitle(l))
    .filter((l) => l && !isJunkTitle(l) && !/^[{[]/.test(l) && !/"title"\s*:/i.test(l));
  let line = lines[0] || '';
  if (!line) return '';
  // Prefer a short headline: first clause / ~40 chars
  const cut = line.split(/[.!?。！？\n]/)[0] || line;
  line = cut.trim();
  if (line.length > 42) {
    const slice = line.slice(0, 42);
    const sp = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('า'));
    line = (sp > 16 ? slice.slice(0, sp) : slice).trim();
  }
  return line;
}

function emptyDraft(summary = '') {
  return {
    title: '📝 โน้ต',
    summary: sanitizeNoteSummary(summary),
    tags: [],
    scheduledAt: null,
    priority: 'normal',
    recurrence: null,
  };
}

function fallbackDraft(rawText, sourceText = '') {
  const fromSource = humanLineFromText(sourceText);
  const fromRaw = humanLineFromText(rawText);
  const titleBase = fromSource || fromRaw || 'โน้ต';
  let summary = sanitizeNoteSummary(sourceText || '');
  if (!summary) {
    const lines = String(rawText || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^[{[]/.test(l) && !/"title"\s*:/i.test(l));
    summary = sanitizeNoteSummary(lines.slice(1).join('\n') || lines[0] || '');
  }
  return {
    ...emptyDraft(summary),
    title: ensureLeadingEmoji(titleBase),
  };
}

function normalizeTagNames(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of value) {
    const name = String(raw || '')
      .trim()
      .replace(/^#/, '')
      .slice(0, 40);
    if (!name || isJunkTitle(name) || JSON_KEY_WORDS.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= 5) break;
  }
  return out;
}

function normalizeScheduledAt(value) {
  if (value == null || value === '' || value === false) return null;
  const s = String(value).trim();
  if (!s || s === 'null' || s === 'none') return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function normalizePriority(value) {
  const v = String(value || '').toLowerCase();
  return PRIORITIES.has(v) ? v : 'normal';
}

function normalizeRecurrenceValue(value) {
  if (value == null || value === '' || value === 'none' || value === 'null') return null;
  const v = String(value).toLowerCase();
  return RECURRENCES.has(v) ? v : null;
}

/**
 * Normalize model JSON (or salvage object) into a user-facing note draft.
 * @param {object|null} parsed
 * @param {string} [fallbackText] original user text preferred over raw model dump
 */
export function normalizeAiDraft(parsed, fallbackText = '') {
  if (!parsed || typeof parsed !== 'object') {
    return fallbackDraft('', fallbackText);
  }

  let titleRaw = parsed.title;
  let summaryRaw = parsed.summary || parsed.content || '';

  const cleanedTitle = sanitizeNoteTitle(titleRaw);
  if (!cleanedTitle) {
    titleRaw = humanLineFromText(fallbackText) || humanLineFromText(summaryRaw) || 'โน้ต';
  } else {
    titleRaw = cleanedTitle;
  }

  let summary = sanitizeNoteSummary(summaryRaw);
  if (!summary || isJunkTitle(summary) || (/^\s*\{/.test(summary) && /[{:]/.test(summary))) {
    summary = sanitizeNoteSummary(fallbackText);
  }
  // Never put raw JSON blob into summary
  if (/^\s*\{/.test(summary) && /"title"\s*:/.test(summary)) {
    summary = sanitizeNoteSummary(fallbackText);
  }
  // JSON-looking one-liners like `{ "a": 1 }`
  if (/^\s*\{[\s\S]*\}\s*$/.test(summary) && /:/.test(summary) && !/[\u0E00-\u0E7F]/.test(summary)) {
    summary = sanitizeNoteSummary(fallbackText);
  }

  return {
    title: ensureLeadingEmoji(titleRaw),
    summary,
    tags: normalizeTagNames(parsed.tags || parsed.tagNames),
    scheduledAt: normalizeScheduledAt(parsed.scheduledAt ?? parsed.dueAt),
    priority: normalizePriority(parsed.priority),
    recurrence: normalizeRecurrenceValue(parsed.recurrence),
  };
}

/** Full pipeline: model text → draft (for tests + summarize). */
export function draftFromModelText(modelText, sourceText = '') {
  const parsed = parseJsonObject(modelText);
  if (parsed) return normalizeAiDraft(parsed, sourceText || '');
  return fallbackDraft(modelText, sourceText || '');
}

function modelScore(id) {
  const s = String(id || '').toLowerCase();
  let score = 0;
  if (s.includes('pro')) score += 300;
  else if (s.includes('flash-lite') || s.includes('flash_lite')) score += 80;
  else if (s.includes('flash')) score += 200;
  else score += 100;
  const ver = s.match(/(\d+(?:\.\d+)?)/);
  if (ver) score += Number(ver[1]) * 10;
  if (s.includes('exp') || s.includes('preview')) score -= 20;
  return score;
}

function normalizeModelId(name) {
  return String(name || '')
    .replace(/^models\//, '')
    .trim();
}

/**
 * List models that support generateContent for this API key.
 * @param {string} apiKey
 * @returns {Promise<Array<{ id: string, label: string, displayName: string }>>}
 */
export async function listGeminiModels(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) {
    const err = new Error('missing_api_key');
    err.code = 'missing_api_key';
    throw err;
  }

  const out = [];
  let pageToken = '';
  let guard = 0;
  while (guard < 8) {
    guard += 1;
    const qs = new URLSearchParams({ pageSize: '100' });
    if (pageToken) qs.set('pageToken', pageToken);
    let res;
    try {
      res = await fetch(`${API_MODELS}?${qs}`, {
        headers: { 'x-goog-api-key': key },
      });
    } catch (networkErr) {
      const err = new Error('network');
      err.code = 'network';
      err.cause = networkErr;
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.code = res.status === 400 || res.status === 403 ? 'bad_key' : 'api_error';
      err.status = res.status;
      throw err;
    }
    const models = Array.isArray(data.models) ? data.models : [];
    for (const m of models) {
      const methods = m.supportedGenerationMethods || m.supported_actions || [];
      if (!methods.includes('generateContent')) continue;
      const id = normalizeModelId(m.name || m.baseModelId);
      if (!id || !id.toLowerCase().includes('gemini')) continue;
      if (/embed|imagen|tts|aqa|gemma/i.test(id)) continue;
      const displayName = String(m.displayName || id).trim();
      const smart = /pro/i.test(id)
        ? ' · ฉลาด'
        : /flash-lite|lite/i.test(id)
          ? ' · เบา'
          : /flash/i.test(id)
            ? ' · เร็ว'
            : '';
      out.push({ id, displayName, label: `${id}${smart}` });
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }

  const seen = new Set();
  const unique = out.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
  unique.sort((a, b) => modelScore(b.id) - modelScore(a.id) || a.id.localeCompare(b.id));
  return unique;
}

function buildPrompt({ text, existingTags, nowIso, hasImage, userContextMd }) {
  const tagList =
    existingTags.length > 0
      ? existingTags.map((t) => t.name).join(', ')
      : '(ยังไม่มีแท็ก — เสนอชื่อแท็กใหม่ได้)';

  const memory = String(userContextMd || '').trim();

  return [
    'คุณช่วยแปลงข้อความ/รูป เป็นโน้ตงานในแอปจดโน้ตของผู้ใช้นี้',
    'ตอบเป็น JSON เท่านั้น:',
    JSON.stringify({
      title: '🚗 หัวข้อสั้น',
      summary: 'สรุปสั้น อ่านง่าย',
      tags: ['งาน', 'ส่วนตัว'],
      scheduledAt: '2026-07-12T18:00:00+07:00',
      priority: 'normal',
      recurrence: null,
    }),
    '',
    'กฎ:',
    '- title: รูปแบบตายตัว = อีโมจิจริง 1 ตัว + ช่องว่าง 1 ช่อง + ข้อความธรรมดาเท่านั้น',
    '- ตัวอย่างถูก: "🏞️ ตรวจโฉนดที่ดิน" · "💼 ประชุมทีม"',
    '- ห้าม: markdown (** # `), อัญประกาศครอบทั้งประโยค, โค้ด, สัญลักษณ์เทคนิค, หลายอีโมจิ, หรือขึ้นต้นด้วยเครื่องหมายพิเศษ',
    '- summary: สรุปกระชับ ภาษาเดียวกับต้นฉบับ อย่าแต่งเติม',
    '- tags: 1–3 ชื่อ · ใช้แท็กที่มีอยู่ก่อนถ้าเข้ากับบริบท/ความจำผู้ใช้ · ถ้ามีความจำส่วน「กฎแมปคำ → แท็ก」ให้ทำตามก่อน · สร้างใหม่เฉพาะเมื่อไม่มีที่ใกล้เคียง',
    '- อ่าน「โปรไฟล์ผู้ใช้」ในความจำถ้ามี — ใช้ปรับโทน/บริบทธุรกิจให้ถูก',
    '- priority: normal | important | urgent | critical ตามความน่าจะเป็นจากข้อความ + นิสัยในความจำผู้ใช้',
    '- scheduledAt: ISO 8601 พร้อมโซนเวลา ถ้ามีกำหนดชัด/พอเดาได้ · ไม่มีใส่ null',
    '- recurrence: null | daily | weekly | monthly | yearly (เฉพาะงานที่ทำซ้ำจริง)',
    hasImage ? '- ถ้ามีรูป: อ่านข้อความ/บริบทจากรูปแล้วสรุปเป็นงาน' : '',
    '',
    `ตอนนี้: ${nowIso}`,
    `แท็กที่มีอยู่: ${tagList}`,
    '',
    memory
      ? `## ความจำผู้ใช้ (จากประวัติในแอป — ใช้เป็นบริบท)\n${memory}\n`
      : '## ความจำผู้ใช้\n(ยังน้อย — เดาจากข้อความและแท็กที่มี)\n',
    text ? `ข้อความต้นฉบับ:\n${text}` : 'ข้อความต้นฉบับ: (ไม่มี — ใช้จากรูป)',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Summarize text and/or image into a rich note draft.
 * @param {string} apiKey
 * @param {string} rawText
 * @param {{
 *   model?: string,
 *   existingTags?: Array<{ id?: string, name: string }>,
 *   image?: { mimeType: string, data: string } | null,
 *   userContextMd?: string,
 *   now?: Date,
 * }} [opts]
 */
export async function summarizeToNoteDraft(apiKey, rawText, opts = {}) {
  const key = String(apiKey || '').trim();
  if (!key) {
    const err = new Error('missing_api_key');
    err.code = 'missing_api_key';
    throw err;
  }
  const text = String(rawText || '').trim();
  const images = Array.isArray(opts.images)
    ? opts.images.filter((i) => i && i.data)
    : opts.image && opts.image.data
      ? [opts.image]
      : [];
  if (!text && !images.length) {
    const err = new Error('empty_input');
    err.code = 'empty_input';
    throw err;
  }
  if (text.length > 12000) {
    const err = new Error('too_long');
    err.code = 'too_long';
    throw err;
  }

  const model = String(opts.model || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
  const url = `${API_MODELS}/${encodeURIComponent(model)}:generateContent`;
  const existingTags = Array.isArray(opts.existingTags) ? opts.existingTags : [];
  const now = opts.now instanceof Date ? opts.now : new Date();
  const nowIso = now.toISOString();

  const prompt = buildPrompt({
    text,
    existingTags,
    nowIso,
    hasImage: images.length > 0,
    userContextMd: opts.userContextMd || '',
  });

  const parts = [{ text: prompt }];
  for (const image of images) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType || 'image/jpeg',
        data: image.data,
      },
    });
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1536,
          responseMimeType: 'application/json',
        },
      }),
    });
  } catch (networkErr) {
    const err = new Error('network');
    err.code = 'network';
    err.cause = networkErr;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.code = res.status === 400 || res.status === 403 ? 'bad_key' : 'api_error';
    err.status = res.status;
    throw err;
  }

  const outText = extractText(data);
  return draftFromModelText(outText, text || '');
}

/**
 * Keep original file bytes for note attachment (full resolution).
 * Only re-encodes oversized images so sync stays workable.
 */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
/** High-res edge for Gemini vision (separate from stored original). */
export const AI_IMAGE_MAX_EDGE = 4096;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read_failed'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlParts(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return { mimeType: 'application/octet-stream', data: '' };
  return { mimeType: m[1], data: m[2] };
}

/**
 * Read a File/Blob as a note attachment at full quality when possible.
 * @param {File|Blob} file
 * @param {{ maxBytes?: number }} [opts]
 */
export async function readFileAsAttachment(file, opts = {}) {
  if (!file) {
    const err = new Error('empty_input');
    err.code = 'empty_input';
    throw err;
  }
  const maxBytes = opts.maxBytes ?? MAX_ATTACHMENT_BYTES;
  const name = (file.name || (file.type?.startsWith('image/') ? 'photo.jpg' : 'file')).slice(0, 120);
  const mimeType = file.type || 'application/octet-stream';
  const isImage = mimeType.startsWith('image/');

  if (file.size <= maxBytes) {
    const dataUrl = await blobToDataUrl(file);
    const parts = dataUrlParts(dataUrl);
    return {
      id: crypto.randomUUID(),
      name,
      mimeType: parts.mimeType || mimeType,
      data: parts.data,
      size: file.size,
      kind: isImage ? 'image' : 'file',
      previewUrl: isImage ? dataUrl : '',
      fullRes: true,
    };
  }

  if (isImage) {
    // Oversized photo: keep very high quality still (near full res)
    const compressed = await fileToInlineImage(file, { maxEdge: 4096, quality: 0.92 });
    return {
      id: crypto.randomUUID(),
      name: name.replace(/\.\w+$/, '') + '.jpg',
      mimeType: compressed.mimeType,
      data: compressed.data,
      size: Math.ceil((compressed.data.length * 3) / 4),
      kind: 'image',
      previewUrl: compressed.previewUrl,
      fullRes: false,
    };
  }

  const err = new Error('too_large');
  err.code = 'too_large';
  throw err;
}

/**
 * Resize/compress an image for Gemini only (does not replace the stored original).
 * @param {File|Blob} file
 * @param {{ maxEdge?: number, quality?: number }} [opts]
 */
export async function fileToInlineImage(file, opts = {}) {
  const maxEdge = opts.maxEdge || AI_IMAGE_MAX_EDGE;
  const quality = opts.quality ?? 0.9;
  if (!file) {
    const err = new Error('empty_input');
    err.code = 'empty_input';
    throw err;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const mimeType = 'image/jpeg';
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const data = dataUrl.split(',')[1] || '';
  return { mimeType, data, previewUrl: dataUrl };
}

/**
 * Prepare media for AI note: keep full attachment + optional AI vision part.
 * @param {File|Blob} file
 */
export async function prepareAiMedia(file) {
  const attachment = await readFileAsAttachment(file);
  let aiPart = null;

  if (attachment.kind === 'image') {
    // Prefer original for AI when under ~4MB payload; else high-res downscale
    const approxBytes = Math.ceil((attachment.data.length * 3) / 4);
    if (approxBytes <= 4 * 1024 * 1024) {
      aiPart = {
        mimeType: attachment.mimeType,
        data: attachment.data,
      };
    } else {
      aiPart = await fileToInlineImage(file, { maxEdge: AI_IMAGE_MAX_EDGE, quality: 0.9 });
    }
  } else if (attachment.mimeType === 'application/pdf') {
    const approxBytes = Math.ceil((attachment.data.length * 3) / 4);
    if (approxBytes <= 8 * 1024 * 1024) {
      aiPart = { mimeType: 'application/pdf', data: attachment.data };
    }
  }

  return { attachment, aiPart };
}

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

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
}

function parseJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Ensure title starts with one emoji (vibe cue in the list). */
export function ensureLeadingEmoji(title) {
  const t = String(title || '').trim();
  if (!t) return '📝 โน้ตจาก AI';
  try {
    if (/^\p{Extended_Pictographic}/u.test(t)) return t.slice(0, 120);
  } catch {
    // Older engines without Unicode property escapes
    if (/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t)) return t.slice(0, 120);
  }
  return `📝 ${t}`.slice(0, 120);
}

function fallbackDraft(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const title = ensureLeadingEmoji(lines[0] || 'โน้ตจาก AI');
  const summary = lines.slice(1).join('\n').trim() || String(rawText || '').trim();
  return { title, summary };
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
      // Skip embedding / TTS / image-only style ids if they slipped through
      if (/embed|imagen|tts|aqa|gemma/i.test(id)) continue;
      const displayName = String(m.displayName || id).trim();
      const smart = /pro/i.test(id) ? ' · ฉลาด' : /flash-lite|lite/i.test(id) ? ' · เบา' : /flash/i.test(id) ? ' · เร็ว' : '';
      out.push({
        id,
        displayName,
        label: `${id}${smart}`,
      });
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

/**
 * Summarize free text into a note draft { title, summary }.
 * @param {string} apiKey
 * @param {string} rawText
 * @param {{ model?: string }} [opts]
 */
export async function summarizeToNoteDraft(apiKey, rawText, opts = {}) {
  const key = String(apiKey || '').trim();
  if (!key) {
    const err = new Error('missing_api_key');
    err.code = 'missing_api_key';
    throw err;
  }
  const text = String(rawText || '').trim();
  if (!text) {
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

  const prompt = [
    'คุณช่วยสรุปข้อความให้เป็นโน้ต/งานสั้นๆ สำหรับแอปจดโน้ต',
    'ตอบเป็น JSON เท่านั้น ไม่มีคำอธิบายอื่น:',
    '{"title":"🚗 หัวข้อสั้น","summary":"สรุปเนื้อหาชัดเจน อ่านง่าย"}',
    '',
    'กฎหัวข้อ (สำคัญ):',
    '- ขึ้นต้นด้วยอีโมจิ 1 ตัวที่สื่อความหมายของงาน ตามด้วยช่องว่าง แล้วข้อความหัวข้อ',
    '- ตัวอย่าง: เดินทาง/ขับรถ → "🚗 ไปเชียงใหม่" · ซื้อของ → "🛒 ซื้อของเข้าบ้าน" · กิน → "🍽️ จองร้านอาหาร" · งาน/ประชุม → "💼 ประชุมทีม" · เรียน → "📚 อ่านบทที่ 3" · สุขภาพ → "💪 ออกกำลังกาย"',
    '- ถ้าไม่แน่ใจใช้อีโมจิ 📝',
    '- ใช้ภาษาเดียวกับต้นฉบับ · อย่าแต่งเติมข้อเท็จจริง',
    '',
    'ข้อความต้นฉบับ:',
    text,
  ].join('\n');

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1024,
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
  const parsed = parseJsonObject(outText);
  if (parsed && (parsed.title || parsed.summary)) {
    return {
      title: ensureLeadingEmoji(parsed.title || 'โน้ตจาก AI'),
      summary: String(parsed.summary || parsed.content || text).trim(),
    };
  }

  if (outText) {
    return fallbackDraft(outText);
  }
  return fallbackDraft(text);
}

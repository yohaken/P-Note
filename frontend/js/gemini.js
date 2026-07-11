/**
 * Gemini API helpers for P-Note (browser → Google AI REST).
 * API key stays on-device in settings; never logged.
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

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

function fallbackDraft(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const title = (lines[0] || 'โน้ตจาก AI').slice(0, 80);
  const summary = lines.slice(1).join('\n').trim() || String(rawText || '').trim();
  return { title, summary };
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
  const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`;

  const prompt = [
    'คุณช่วยสรุปข้อความให้เป็นโน้ต/งานสั้นๆ สำหรับแอปจดโน้ต',
    'ตอบเป็น JSON เท่านั้น ไม่มีคำอธิบายอื่น:',
    '{"title":"หัวข้อสั้น 1 บรรทัด","summary":"สรุปเนื้อหาชัดเจน อ่านง่าย"}',
    'ใช้ภาษาเดียวกับต้นฉบับ · อย่าแต่งเติมข้อเท็จจริง',
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
          temperature: 0.3,
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
      title: String(parsed.title || 'โน้ตจาก AI').trim().slice(0, 120) || 'โน้ตจาก AI',
      summary: String(parsed.summary || parsed.content || text).trim(),
    };
  }

  // Model returned plain text — still usable
  if (outText) {
    return fallbackDraft(outText);
  }
  return fallbackDraft(text);
}

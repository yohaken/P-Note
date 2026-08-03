/**
 * Compact notepad text prefs + Tab/indent helpers (code-editor feel).
 * Prefs are stored per notepad so they sync with the note title/content.
 */

export const DEFAULT_TEXT_PREFS = Object.freeze({
  fontSize: 16,
  codeMode: false,
  tabWidth: 2,
});

const FONT_MIN = 12;
const FONT_MAX = 22;

export function normalizeTextPrefs(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  let fontSize = Number(src.fontSize);
  if (!Number.isFinite(fontSize)) fontSize = DEFAULT_TEXT_PREFS.fontSize;
  fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(fontSize)));
  let tabWidth = Number(src.tabWidth);
  if (tabWidth !== 4 && tabWidth !== 2) tabWidth = DEFAULT_TEXT_PREFS.tabWidth;
  return {
    fontSize,
    codeMode: Boolean(src.codeMode),
    tabWidth,
  };
}

export function clampFontSize(size, delta = 0) {
  const next = Math.round(Number(size) || DEFAULT_TEXT_PREFS.fontSize) + delta;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, next));
}

function indentUnit(tabWidth) {
  return '\t';
}

function leadingWs(line) {
  const m = String(line || '').match(/^[ \t]*/);
  return m ? m[0] : '';
}

function outdentLine(line, tabWidth) {
  if (line.startsWith('\t')) return line.slice(1);
  const spaces = Math.max(1, Number(tabWidth) || 2);
  if (/^ +/.test(line)) {
    const n = Math.min(spaces, line.match(/^ +/)[0].length);
    return line.slice(n);
  }
  return line;
}

/**
 * Tab / Shift+Tab in a textarea: insert indent, or indent/outdent selected lines.
 * Returns true if handled.
 */
export function handleTextareaTab(el, { shiftKey = false, tabWidth = 2 } = {}) {
  if (!el || el.selectionStart == null) return false;
  const value = el.value;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const unit = indentUnit(tabWidth);

  // Multi-line selection → indent/outdent each line
  if (start !== end && value.slice(start, end).includes('\n')) {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = (() => {
      const n = value.indexOf('\n', end);
      return n === -1 ? value.length : n;
    })();
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const nextLines = shiftKey
      ? lines.map((ln) => outdentLine(ln, tabWidth))
      : lines.map((ln) => unit + ln);
    const nextBlock = nextLines.join('\n');
    el.value = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);
    el.selectionStart = lineStart;
    el.selectionEnd = lineStart + nextBlock.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  if (shiftKey) {
    // Outdent current line
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEndIdx = value.indexOf('\n', start);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
    const line = value.slice(lineStart, lineEnd);
    const next = outdentLine(line, tabWidth);
    if (next === line) return true;
    const removed = line.length - next.length;
    el.value = value.slice(0, lineStart) + next + value.slice(lineEnd);
    el.selectionStart = Math.max(lineStart, start - removed);
    el.selectionEnd = Math.max(lineStart, end - removed);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // Insert indent at caret (replace selection)
  el.value = value.slice(0, start) + unit + value.slice(end);
  const caret = start + unit.length;
  el.selectionStart = caret;
  el.selectionEnd = caret;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/**
 * Enter: keep leading whitespace of the current line (notepad / code feel).
 * Returns true if handled.
 */
export function handleTextareaEnterIndent(el) {
  if (!el || el.selectionStart == null) return false;
  const value = el.value;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineBeforeCaret = value.slice(lineStart, start);
  const ws = leadingWs(lineBeforeCaret);
  const insert = `\n${ws}`;
  el.value = value.slice(0, start) + insert + value.slice(end);
  const caret = start + insert.length;
  el.selectionStart = caret;
  el.selectionEnd = caret;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/** Apply CSS vars / classes for notepad content textarea. */
export function applyTextPrefsToTextarea(el, prefs) {
  if (!el) return;
  const p = normalizeTextPrefs(prefs);
  el.style.fontSize = `${p.fontSize}px`;
  el.style.tabSize = String(p.tabWidth);
  el.style.MozTabSize = String(p.tabWidth);
  el.classList.toggle('note-content-code', p.codeMode);
}

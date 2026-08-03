/**
 * Lightweight spreadsheet blocks for Note-mode notepads.
 * Insertable (not always-on): each notepad can hold zero or more sheet blocks.
 * Formulas: =A1+B1, =A1*B2/C1, =SUM(A1:A10), AVERAGE/MIN/MAX/COUNT.
 */

export const SHEET_DEFAULT_COLS = 5; // A–E
export const SHEET_DEFAULT_ROWS = 12;

const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function colIndexToLetter(index) {
  let n = Number(index);
  if (!Number.isFinite(n) || n < 0) return 'A';
  let s = '';
  n += 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = COL_LETTERS[rem] + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || 'A';
}

export function colLetterToIndex(letter) {
  const s = String(letter || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]+$/.test(s)) return -1;
  let n = 0;
  for (let i = 0; i < s.length; i += 1) {
    n = n * 26 + (s.charCodeAt(i) - 64);
  }
  return n - 1;
}

export function cellKey(col, row) {
  return `${colIndexToLetter(col)}${row + 1}`;
}

export function parseCellRef(ref) {
  const m = String(ref || '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  const col = colLetterToIndex(m[1]);
  const row = Number(m[2]) - 1;
  if (col < 0 || row < 0) return null;
  return { col, row };
}

export function createSheetBlock({ cols = SHEET_DEFAULT_COLS, rows = SHEET_DEFAULT_ROWS } = {}) {
  return {
    id: crypto.randomUUID(),
    type: 'sheet',
    cols: clampInt(cols, 2, 12, SHEET_DEFAULT_COLS),
    rows: clampInt(rows, 3, 40, SHEET_DEFAULT_ROWS),
    cells: {},
  };
}

export function normalizeSheetBlock(raw) {
  if (!raw || typeof raw !== 'object') return createSheetBlock();
  const cols = clampInt(raw.cols, 2, 12, SHEET_DEFAULT_COLS);
  const rows = clampInt(raw.rows, 3, 40, SHEET_DEFAULT_ROWS);
  const cells = {};
  const src = raw.cells && typeof raw.cells === 'object' ? raw.cells : {};
  Object.keys(src).forEach((key) => {
    const ref = parseCellRef(key);
    if (!ref || ref.col >= cols || ref.row >= rows) return;
    const val = src[key];
    if (val == null) return;
    const s = String(val);
    if (!s) return;
    cells[cellKey(ref.col, ref.row)] = s.slice(0, 200);
  });
  return {
    id: String(raw.id || crypto.randomUUID()),
    type: 'sheet',
    cols,
    rows,
    cells,
  };
}

export function normalizeSheetBlocks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b) => b && typeof b === 'object')
    .map((b) => normalizeSheetBlock(b))
    .slice(0, 8);
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function toNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim().replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function expandRange(a, b) {
  const ra = parseCellRef(a);
  const rb = parseCellRef(b);
  if (!ra || !rb) return [];
  const c0 = Math.min(ra.col, rb.col);
  const c1 = Math.max(ra.col, rb.col);
  const r0 = Math.min(ra.row, rb.row);
  const r1 = Math.max(ra.row, rb.row);
  const out = [];
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      out.push(cellKey(c, r));
    }
  }
  return out;
}

/**
 * Evaluate all cells. Returns { values: {A1: display}, errors: {A1: msg} }.
 */
export function evaluateSheet(sheet) {
  const block = normalizeSheetBlock(sheet);
  const values = {};
  const errors = {};
  const visiting = new Set();

  const rawOf = (key) => {
    const v = block.cells[key];
    return v == null ? '' : String(v);
  };

  const evalRef = (key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
    if (visiting.has(key)) {
      errors[key] = '#CYCLE!';
      values[key] = null;
      return null;
    }
    const ref = parseCellRef(key);
    if (!ref || ref.col >= block.cols || ref.row >= block.rows) return null;
    const raw = rawOf(key);
    visiting.add(key);
    let result = null;
    if (!raw) {
      result = null;
    } else if (raw.trim().startsWith('=')) {
      try {
        result = evalFormula(raw.trim().slice(1), evalRef);
      } catch (err) {
        errors[key] = err?.message || '#ERR!';
        result = null;
      }
    } else {
      const num = toNumber(raw);
      result = num == null ? raw : num;
    }
    visiting.delete(key);
    values[key] = result;
    return result;
  };

  for (let r = 0; r < block.rows; r += 1) {
    for (let c = 0; c < block.cols; c += 1) {
      evalRef(cellKey(c, r));
    }
  }

  return { values, errors, sheet: block };
}

function evalFormula(expr, evalRef) {
  const tokens = tokenize(expr);
  let i = 0;

  const peek = () => tokens[i];
  const next = () => {
    const t = tokens[i];
    i += 1;
    return t;
  };

  const parsePrimary = () => {
    const t = peek();
    if (!t) throw new Error('#ERR!');
    if (t.type === 'num') {
      next();
      return t.value;
    }
    if (t.type === 'ref') {
      next();
      const n = toNumber(evalRef(t.value));
      return n == null ? 0 : n;
    }
    if (t.type === 'func') {
      next();
      if (peek()?.type !== 'lparen') throw new Error('#ERR!');
      next();
      const args = [];
      if (peek()?.type !== 'rparen') {
        for (;;) {
          // range A1:B2 as one arg list of numbers
          if (peek()?.type === 'ref' && tokens[i + 1]?.type === 'colon' && tokens[i + 2]?.type === 'ref') {
            const a = next().value;
            next(); // :
            const b = next().value;
            expandRange(a, b).forEach((key) => {
              const n = toNumber(evalRef(key));
              if (n != null) args.push(n);
            });
          } else {
            args.push(parseExpr());
          }
          if (peek()?.type === 'comma') {
            next();
            continue;
          }
          break;
        }
      }
      if (peek()?.type !== 'rparen') throw new Error('#ERR!');
      next();
      return applyFunc(t.value, args);
    }
    if (t.type === 'lparen') {
      next();
      const v = parseExpr();
      if (peek()?.type !== 'rparen') throw new Error('#ERR!');
      next();
      return v;
    }
    if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
      next();
      const v = parsePrimary();
      return t.value === '-' ? -v : v;
    }
    throw new Error('#ERR!');
  };

  const parseMul = () => {
    let v = parsePrimary();
    while (peek()?.type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = next().value;
      const r = parsePrimary();
      v = op === '*' ? v * r : r === 0 ? NaN : v / r;
      if (!Number.isFinite(v)) throw new Error('#DIV/0!');
    }
    return v;
  };

  const parseExpr = () => {
    let v = parseMul();
    while (peek()?.type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = next().value;
      const r = parseMul();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };

  const result = parseExpr();
  if (i < tokens.length) throw new Error('#ERR!');
  if (!Number.isFinite(result)) throw new Error('#ERR!');
  return result;
}

function applyFunc(name, args) {
  const fn = String(name || '').toUpperCase();
  const nums = args.map((a) => toNumber(a)).filter((n) => n != null);
  if (fn === 'SUM') return nums.reduce((a, b) => a + b, 0);
  if (fn === 'AVERAGE' || fn === 'AVG') {
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }
  if (fn === 'MIN') return nums.length ? Math.min(...nums) : 0;
  if (fn === 'MAX') return nums.length ? Math.max(...nums) : 0;
  if (fn === 'COUNT') return nums.length;
  throw new Error('#NAME?');
}

function tokenize(expr) {
  const s = String(expr || '');
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if ('+-*/(),:'.includes(ch)) {
      if (ch === '(') tokens.push({ type: 'lparen' });
      else if (ch === ')') tokens.push({ type: 'rparen' });
      else if (ch === ',') tokens.push({ type: 'comma' });
      else if (ch === ':') tokens.push({ type: 'colon' });
      else tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i + 1;
      while (j < s.length && /[0-9.]/.test(s[j])) j += 1;
      const num = Number(s.slice(i, j));
      if (!Number.isFinite(num)) throw new Error('#ERR!');
      tokens.push({ type: 'num', value: num });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j += 1;
      const word = s.slice(i, j);
      // function name if followed by (
      let k = j;
      while (k < s.length && /\s/.test(s[k])) k += 1;
      if (s[k] === '(') {
        tokens.push({ type: 'func', value: word.toUpperCase() });
        i = j;
        continue;
      }
      const ref = parseCellRef(word);
      if (!ref) throw new Error('#NAME?');
      tokens.push({ type: 'ref', value: cellKey(ref.col, ref.row) });
      i = j;
      continue;
    }
    throw new Error('#ERR!');
  }
  return tokens;
}

export function formatSheetDisplay(value, error) {
  if (error) return error;
  if (value == null || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '#ERR!';
    // trim long floats
    const rounded = Math.round(value * 1e8) / 1e8;
    return String(rounded);
  }
  return String(value);
}

export function sheetFingerprint(sheets) {
  return normalizeSheetBlocks(sheets)
    .map((s) => `${s.id}:${s.cols}x${s.rows}:${JSON.stringify(s.cells)}`)
    .join('|');
}

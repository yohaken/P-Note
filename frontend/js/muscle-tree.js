/**
 * Muscle tree log — hierarchical groups × date columns (newest → oldest).
 * Leaf cells store burn kcal; parents show per-day sums.
 * Day.exercises sync is applied by the caller (calorie helpers).
 */

export const MUSCLE_DATE_COLS = 21;
export const MUSCLE_NAME_MAX = 40;

/** Seed tree matching the preferred Thai grouping. */
export function defaultMuscleNodes() {
  const mk = (id, name, parentId, order) => ({ id, name, parentId, order });
  return [
    mk('m-chest', 'อก', null, 0),
    mk('m-chest-up', 'อกบน', 'm-chest', 0),
    mk('m-chest-low', 'อกล่าง', 'm-chest', 1),
    mk('m-chest-mid', 'อกกลาง', 'm-chest', 2),
    mk('m-legs', 'ขา', null, 1),
    mk('m-legs-front', 'หน้าขา', 'm-legs', 0),
    mk('m-legs-back', 'หลังขา', 'm-legs', 1),
    mk('m-shoulders', 'ไหล่', null, 2),
    mk('m-shoulders-main', 'หลัก', 'm-shoulders', 0),
    mk('m-shoulders-side', 'ข้าง', 'm-shoulders', 1),
  ];
}

function newId(prefix = 'm') {
  try {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `${prefix}-${Date.now().toString(36)}`;
  }
}

function clampName(raw) {
  return String(raw || '').trim().slice(0, MUSCLE_NAME_MAX);
}

function clampKcal(raw) {
  if (raw == null || raw === '') return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(5000, n);
}

function nowIsoLocal() {
  try {
    return new Date().toISOString();
  } catch {
    return '';
  }
}

/** Local YYYY-MM-DD (matches calorie.toDateKey style). */
export function muscleToDateKey(d = new Date()) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function normalizeMuscleNode(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const name = clampName(raw.name);
  if (!id || !name) return null;
  const parentId = raw.parentId == null || raw.parentId === ''
    ? null
    : String(raw.parentId).trim();
  const order = Number.isFinite(Number(raw.order)) ? Number(raw.order) : 0;
  return { id, name, parentId, order };
}

/** Flat cells map: `${nodeId}|${dateKey}` → kcal */
export function normalizeMuscleCells(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  Object.keys(raw).forEach((key) => {
    const k = String(key || '');
    if (!k.includes('|')) return;
    const kcal = clampKcal(raw[k]);
    if (kcal != null) out[k] = kcal;
  });
  return out;
}

export function cellKey(nodeId, dateKey) {
  return `${nodeId}|${dateKey}`;
}

export function normalizeMuscleTree(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  let nodes = (Array.isArray(src.nodes) ? src.nodes : [])
    .map(normalizeMuscleNode)
    .filter(Boolean);
  if (!nodes.length) nodes = defaultMuscleNodes();

  const byId = new Map(nodes.map((n) => [n.id, n]));
  nodes = nodes.filter((n) => {
    if (!n.parentId) return true;
    const p = byId.get(n.parentId);
    return Boolean(p && !p.parentId);
  });

  const roots = nodes
    .filter((n) => !n.parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'th'));
  const childrenOf = (pid) =>
    nodes
      .filter((n) => n.parentId === pid)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'th'));
  const ordered = [];
  roots.forEach((r, i) => {
    ordered.push({ ...r, order: i });
    childrenOf(r.id).forEach((c, j) => ordered.push({ ...c, order: j }));
  });

  const idSet = new Set(ordered.map((n) => n.id));
  const cells = normalizeMuscleCells(src.cells);
  Object.keys(cells).forEach((k) => {
    const nodeId = k.split('|')[0];
    if (!idSet.has(nodeId)) delete cells[k];
  });

  return {
    nodes: ordered,
    cells,
    updatedAt: String(src.updatedAt || '').trim(),
  };
}

export function mergeMuscleTreeField(local, remote) {
  const lt = normalizeMuscleTree(local?.muscleTree);
  const rt = normalizeMuscleTree(remote?.muscleTree);
  const lAt = Date.parse(String(local?.muscleTreeAt || lt.updatedAt || '').trim()) || 0;
  const rAt = Date.parse(String(remote?.muscleTreeAt || rt.updatedAt || '').trim()) || 0;
  if (rAt > lAt) {
    return {
      muscleTree: rt,
      muscleTreeAt: remote?.muscleTreeAt || rt.updatedAt || '',
    };
  }
  if (lAt > rAt) {
    return {
      muscleTree: lt,
      muscleTreeAt: local?.muscleTreeAt || lt.updatedAt || '',
    };
  }
  const lScore = lt.nodes.length + Object.keys(lt.cells).length;
  const rScore = rt.nodes.length + Object.keys(rt.cells).length;
  if (rScore > lScore) {
    return {
      muscleTree: rt,
      muscleTreeAt: remote?.muscleTreeAt || rt.updatedAt || local?.muscleTreeAt || '',
    };
  }
  return {
    muscleTree: lt,
    muscleTreeAt: local?.muscleTreeAt || lt.updatedAt || remote?.muscleTreeAt || '',
  };
}

export function isLeafNode(node, nodes) {
  if (!node) return false;
  if (node.parentId) return true;
  return !(nodes || []).some((n) => n.parentId === node.id);
}

export function flattenMuscleRows(tree) {
  const t = normalizeMuscleTree(tree);
  const roots = t.nodes.filter((n) => !n.parentId);
  const rows = [];
  roots.forEach((root) => {
    const kids = t.nodes.filter((n) => n.parentId === root.id);
    rows.push({ ...root, depth: 0, leaf: kids.length === 0, childIds: kids.map((k) => k.id) });
    kids.forEach((c) => {
      rows.push({ ...c, depth: 1, leaf: true, childIds: [] });
    });
  });
  return rows;
}

/** Newest → oldest date keys for columns. */
export function muscleDateKeys({ count = MUSCLE_DATE_COLS, today = muscleToDateKey() } = {}) {
  const out = [];
  const base = new Date(`${today}T12:00:00`);
  if (Number.isNaN(base.getTime())) return [muscleToDateKey()];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(muscleToDateKey(d));
  }
  return out;
}

export function getMuscleCell(tree, nodeId, dateKey) {
  const cells = normalizeMuscleTree(tree).cells;
  return cells[cellKey(nodeId, dateKey)] ?? null;
}

export function leafLabelPath(tree, nodeId) {
  const t = normalizeMuscleTree(tree);
  const node = t.nodes.find((n) => n.id === nodeId);
  if (!node) return '';
  if (!node.parentId) return node.name;
  const parent = t.nodes.find((n) => n.id === node.parentId);
  return parent ? `${parent.name} · ${node.name}` : node.name;
}

/** Labels that belong to the current tree (used to rebuild day.exercises). */
export function muscleTreeLabels(tree) {
  const rows = flattenMuscleRows(tree);
  const labels = new Set();
  rows.forEach((r) => {
    if (!r.leaf) return;
    labels.add(r.name);
    labels.add(leafLabelPath(tree, r.id));
  });
  return labels;
}

/** Leaf exercise slots for one date: [{ burn, label }]. */
export function muscleSlotsForDate(tree, dateKey) {
  const t = normalizeMuscleTree(tree);
  const rows = flattenMuscleRows(t).filter((r) => r.leaf);
  const out = [];
  rows.forEach((r) => {
    const kcal = t.cells[cellKey(r.id, dateKey)];
    if (!(kcal > 0)) return;
    const label = r.depth === 1 ? leafLabelPath(t, r.id) : r.name;
    out.push({ burn: kcal, label });
  });
  return out;
}

/** Pure tree update — does not touch day rows. */
export function setMuscleCellInTree(tree, nodeId, dateKey, kcalRaw) {
  const t = normalizeMuscleTree(tree);
  const node = t.nodes.find((n) => n.id === nodeId);
  if (!node || !isLeafNode(node, t.nodes)) {
    return { tree: t, changed: false, dateKey };
  }
  const key = cellKey(nodeId, dateKey);
  const kcal = clampKcal(kcalRaw);
  const prev = t.cells[key] ?? null;
  if (prev === kcal) return { tree: t, changed: false, dateKey };

  const cells = { ...t.cells };
  if (kcal == null) delete cells[key];
  else cells[key] = kcal;

  return {
    tree: { ...t, cells, updatedAt: nowIsoLocal() },
    changed: true,
    dateKey,
  };
}

export function addMuscleCategory(tree, name) {
  const label = clampName(name);
  if (!label) return { tree: normalizeMuscleTree(tree), node: null };
  const t = normalizeMuscleTree(tree);
  const roots = t.nodes.filter((n) => !n.parentId);
  const node = {
    id: newId('cat'),
    name: label,
    parentId: null,
    order: roots.length,
  };
  const next = {
    ...t,
    nodes: [...t.nodes, node],
    updatedAt: nowIsoLocal(),
  };
  return { tree: normalizeMuscleTree(next), node };
}

export function addMuscleChild(tree, parentId, name) {
  const label = clampName(name);
  const t = normalizeMuscleTree(tree);
  const parent = t.nodes.find((n) => n.id === parentId && !n.parentId);
  if (!parent || !label) return { tree: t, node: null };
  const siblings = t.nodes.filter((n) => n.parentId === parent.id);
  const node = {
    id: newId('leaf'),
    name: label,
    parentId: parent.id,
    order: siblings.length,
  };
  const cells = { ...t.cells };
  Object.keys(cells).forEach((k) => {
    if (k.startsWith(`${parent.id}|`)) delete cells[k];
  });
  const next = {
    ...t,
    nodes: [...t.nodes, node],
    cells,
    updatedAt: nowIsoLocal(),
  };
  return { tree: normalizeMuscleTree(next), node };
}

export function renameMuscleNode(tree, nodeId, name) {
  const label = clampName(name);
  const t = normalizeMuscleTree(tree);
  if (!label) return { tree: t, changed: false };
  if (!t.nodes.some((n) => n.id === nodeId)) return { tree: t, changed: false };
  const nodes = t.nodes.map((n) => (n.id === nodeId ? { ...n, name: label } : n));
  return {
    tree: normalizeMuscleTree({ ...t, nodes, updatedAt: nowIsoLocal() }),
    changed: true,
  };
}

export function removeMuscleNode(tree, nodeId) {
  const t = normalizeMuscleTree(tree);
  const target = t.nodes.find((n) => n.id === nodeId);
  if (!target) return { tree: t, changed: false, touchDates: [] };
  const dropIds = new Set([nodeId]);
  t.nodes.forEach((n) => {
    if (n.parentId === nodeId) dropIds.add(n.id);
  });
  const touchDates = new Set();
  Object.keys(t.cells).forEach((k) => {
    const [id, date] = k.split('|');
    if (dropIds.has(id)) touchDates.add(date);
  });
  const nodes = t.nodes.filter((n) => !dropIds.has(n.id));
  const cells = { ...t.cells };
  Object.keys(cells).forEach((k) => {
    const id = k.split('|')[0];
    if (dropIds.has(id)) delete cells[k];
  });
  const next = normalizeMuscleTree({
    nodes: nodes.length ? nodes : defaultMuscleNodes(),
    cells: nodes.length ? cells : {},
    updatedAt: nowIsoLocal(),
  });
  return { tree: next, changed: true, touchDates: [...touchDates] };
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Compact date header: D/M */
export function formatMuscleColDate(dateKey) {
  const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateKey || '';
  return `${Number(m[3])}/${Number(m[2])}`;
}

export function weekdayShortTh(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][d.getDay()] || '';
}

/**
 * Compact sticky muscle matrix HTML.
 * @param {object} tree
 * @param {{ dates?: string[], selectedId?: string, todayKey?: string }} opts
 */
export function renderMuscleTableHtml(tree, opts = {}) {
  const t = normalizeMuscleTree(tree);
  const todayKey = opts.todayKey || muscleToDateKey();
  const dates = opts.dates || muscleDateKeys({ today: todayKey });
  const rows = flattenMuscleRows(t);
  const selectedId = opts.selectedId || '';

  const headDates = dates
    .map((dk) => {
      const todayCls = dk === todayKey ? ' is-today' : '';
      return `<th class="mt-col-date${todayCls}" data-date="${esc(dk)}">
        <span class="mt-col-wd">${esc(weekdayShortTh(dk))}</span>
        <span class="mt-col-dm">${esc(formatMuscleColDate(dk))}</span>
      </th>`;
    })
    .join('');

  const body = rows
    .map((r) => {
      const sel = r.id === selectedId ? ' is-selected' : '';
      const depthCls = r.depth ? ' is-child' : ' is-parent';
      const leafCls = r.leaf ? ' is-leaf' : ' is-group';
      const nameCell = `<th class="mt-row-name${depthCls}${leafCls}${sel}" scope="row" data-node-id="${esc(r.id)}">
        <button type="button" class="mt-name-btn" data-node-id="${esc(r.id)}" title="เลือก / แก้ชื่อ">
          <span class="mt-name-text">${esc(r.name)}</span>
        </button>
        <button type="button" class="mt-del-btn" data-del-node="${esc(r.id)}" title="ลบ" aria-label="ลบ ${esc(r.name)}">×</button>
      </th>`;

      const cells = dates
        .map((dk) => {
          if (!r.leaf) {
            let sum = 0;
            (r.childIds || []).forEach((cid) => {
              const v = t.cells[cellKey(cid, dk)];
              if (v > 0) sum += v;
            });
            if (!(r.childIds || []).length) {
              const own = t.cells[cellKey(r.id, dk)];
              if (own > 0) sum = own;
            }
            const shown = sum > 0 ? String(sum) : '';
            return `<td class="mt-cell is-sum${dk === todayKey ? ' is-today' : ''}" data-date="${esc(dk)}">${shown}</td>`;
          }
          const val = t.cells[cellKey(r.id, dk)];
          const filled = val > 0 ? ' is-filled' : '';
          return `<td class="mt-cell is-input${filled}${dk === todayKey ? ' is-today' : ''}" data-node-id="${esc(r.id)}" data-date="${esc(dk)}">
            <input class="mt-kcal" type="number" inputmode="numeric" min="0" max="5000" step="1"
              value="${val > 0 ? val : ''}" placeholder="" aria-label="${esc(r.name)} ${esc(dk)}"
              data-node-id="${esc(r.id)}" data-date="${esc(dk)}">
          </td>`;
        })
        .join('');

      return `<tr class="mt-row${depthCls}${leafCls}${sel}" data-node-id="${esc(r.id)}">${nameCell}${cells}</tr>`;
    })
    .join('');

  return `<table class="muscle-table" id="muscle-table" aria-label="ตารางกล้ามเนื้อรายวัน">
    <thead>
      <tr>
        <th class="mt-corner" scope="col">กล้ามเนื้อ</th>
        ${headDates}
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

import { normalizeNotifyRepeat, normalizeRecurrence, normalizeCycleAnchor } from './schedule.js?v=148';
import { bestIconForLabel, normalizeIconId } from './icons.js?v=148';
import { createEmptyCalorie, normalizeCalorie } from './calorie.js?v=191';

/** Lite notepad helpers — keep notes.js free of sheet.js / note-text.js on boot. */
function normalizeTextPrefs(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  let fontSize = Number(src.fontSize);
  if (!Number.isFinite(fontSize)) fontSize = 16;
  fontSize = Math.min(22, Math.max(12, Math.round(fontSize)));
  let tabWidth = Number(src.tabWidth);
  if (tabWidth !== 4 && tabWidth !== 2) tabWidth = 2;
  return { fontSize, codeMode: Boolean(src.codeMode), tabWidth };
}

function normalizeSheetBlocks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b) => b && typeof b === 'object')
    .map((b) => {
      const cols = Math.min(12, Math.max(2, Math.round(Number(b.cols) || 4)));
      const rows = Math.min(40, Math.max(2, Math.round(Number(b.rows) || 8)));
      const cells =
        b.cells && typeof b.cells === 'object' && !Array.isArray(b.cells)
          ? { ...b.cells }
          : {};
      return {
        id: String(b.id || `sheet-${Math.random().toString(36).slice(2, 9)}`),
        name: String(b.name || 'Sheet').trim().slice(0, 40) || 'Sheet',
        cols,
        rows,
        cells,
      };
    })
    .slice(0, 8);
}

export const TAG_PALETTE = [
  '#6c63ff',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#a855f7',
  '#84cc16',
];

export function pickTagColor(index = 0) {
  return TAG_PALETTE[Math.abs(index) % TAG_PALETTE.length];
}

export function safeTagColor(color) {
  return typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color)
    ? color
    : TAG_PALETTE[0];
}

/** Keep known icon ids; empty → suggest from tag name. */
export function normalizeTagIcon(value, tagName = '') {
  const raw = String(value || '').trim();
  if (raw) return normalizeIconId(raw, 'doc');
  return bestIconForLabel(tagName);
}

export const NOTE_STATUS = {
  ACTIVE: 'active',
  DONE: 'done',
  TRASH: 'trash',
};

/** Eisenhower-style priority for filtering. */
export const NOTE_PRIORITY = {
  NORMAL: 'normal',
  IMPORTANT: 'important',
  URGENT: 'urgent',
  CRITICAL: 'critical',
};

export const PRIORITY_OPTIONS = [
  { id: NOTE_PRIORITY.CRITICAL, label: 'สำคัญเร่งด่วน', short: 'สำคัญ+ด่วน' },
  { id: NOTE_PRIORITY.IMPORTANT, label: 'สำคัญ', short: 'สำคัญ' },
  { id: NOTE_PRIORITY.URGENT, label: 'เร่งด่วน', short: 'เร่งด่วน' },
  { id: NOTE_PRIORITY.NORMAL, label: 'ทั่วไป', short: 'ทั่วไป' },
];

export function notePriority(note) {
  const value = note?.priority;
  return Object.values(NOTE_PRIORITY).includes(value) ? value : NOTE_PRIORITY.NORMAL;
}

export function priorityLabel(priority, { short = false } = {}) {
  const opt = PRIORITY_OPTIONS.find((o) => o.id === priority);
  if (!opt) return short ? 'ทั่วไป' : 'ทั่วไป';
  return short ? opt.short : opt.label;
}

export function filterNotesByPriority(notes, priority) {
  if (!priority) return notes;
  return notes.filter((note) => notePriority(note) === priority);
}

/** Case-insensitive match on title + content (+ tag names if provided). */
export function filterNotesBySearch(notes, query, tags = []) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return notes;
  const tagById = new Map((tags || []).map((t) => [t.id, String(t.name || '').toLowerCase()]));
  return notes.filter((note) => {
    const title = String(note.title || '').toLowerCase();
    const content = String(note.content || '').toLowerCase();
    if (title.includes(q) || content.includes(q)) return true;
    const ids = Array.isArray(note.tagIds) ? note.tagIds : [];
    return ids.some((id) => (tagById.get(id) || '').includes(q));
  });
}

export function countNotesByPriority(notes, priority) {
  return notes.reduce(
    (total, note) =>
      total + (isActiveNote(note) && notePriority(note) === priority ? 1 : 0),
    0,
  );
}

export function noteStatus(note) {
  return note.status || NOTE_STATUS.ACTIVE;
}

export function isActiveNote(note) {
  return noteStatus(note) === NOTE_STATUS.ACTIVE;
}

export function filterNotesByStatus(notes, status) {
  return notes.filter((note) => noteStatus(note) === status);
}

export function activeNotes(notes) {
  return filterNotesByStatus(notes, NOTE_STATUS.ACTIVE);
}

export function markNoteDone(note) {
  const now = new Date().toISOString();
  return {
    ...note,
    status: NOTE_STATUS.DONE,
    completedAt: now,
    updatedAt: now,
  };
}

export function markNoteActive(note) {
  return {
    ...note,
    status: NOTE_STATUS.ACTIVE,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function moveNoteToTrash(note) {
  const now = new Date().toISOString();
  return {
    ...note,
    status: NOTE_STATUS.TRASH,
    deletedAt: now,
    updatedAt: now,
  };
}

export function restoreNoteFromTrash(note) {
  return {
    ...note,
    status: NOTE_STATUS.ACTIVE,
    deletedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function purgeNote(noteId, data) {
  return {
    ...data,
    notes: data.notes.filter((note) => note.id !== noteId),
  };
}

export function updateNoteInData(data, updatedNote) {
  return {
    ...data,
    notes: data.notes.map((note) => (note.id === updatedNote.id ? updatedNote : note)),
  };
}

export const DEFAULT_WORKSPACE_ID = 'ws-general';
export const DEFAULT_WORKSPACE_NAME = 'ทั่วไป';

export function createWorkspace(name = DEFAULT_WORKSPACE_NAME, order = Date.now()) {
  const now = new Date().toISOString();
  const trimmed = String(name || '').trim() || DEFAULT_WORKSPACE_NAME;
  return {
    id: crypto.randomUUID(),
    name: trimmed.slice(0, 40),
    order: Number.isFinite(order) ? order : Date.now(),
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultWorkspace() {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_WORKSPACE_ID,
    name: DEFAULT_WORKSPACE_NAME,
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeWorkspaces(raw) {
  const list = Array.isArray(raw)
    ? raw
        .filter((w) => w && typeof w === 'object' && w.id)
        .map((w, i) => ({
          id: String(w.id),
          name: String(w.name || DEFAULT_WORKSPACE_NAME).trim().slice(0, 40) || DEFAULT_WORKSPACE_NAME,
          order: Number.isFinite(w.order) ? w.order : i,
          createdAt: w.createdAt || new Date().toISOString(),
          updatedAt: w.updatedAt || w.createdAt || new Date().toISOString(),
        }))
    : [];
  if (!list.length) return [defaultWorkspace()];
  list.sort((a, b) => a.order - b.order || String(a.name).localeCompare(String(b.name), 'th'));
  return list;
}

export function filterNotesByWorkspace(notes, workspaceId) {
  if (!workspaceId) return notes;
  return (notes || []).filter(
    (note) => (note.workspaceId || DEFAULT_WORKSPACE_ID) === workspaceId,
  );
}

export function countNotesInWorkspace(notes, workspaceId) {
  return filterNotesByWorkspace(notes, workspaceId).length;
}

export function getWorkspace(data, workspaceId) {
  const list = normalizeWorkspaces(data?.workspaces);
  return list.find((w) => w.id === workspaceId) || list[0] || defaultWorkspace();
}

export function renameWorkspace(data, workspaceId, name) {
  const trimmed = String(name || '').trim().slice(0, 40);
  if (!trimmed) return data;
  const now = new Date().toISOString();
  return {
    ...data,
    workspaces: normalizeWorkspaces(data.workspaces).map((w) =>
      w.id === workspaceId ? { ...w, name: trimmed, updatedAt: now } : w,
    ),
    updatedAt: now,
  };
}

/** False when the workspace still has any notes (active/done/trash). */
export function canDeleteWorkspace(data, workspaceId) {
  const list = normalizeWorkspaces(data?.workspaces);
  if (list.length <= 1) return false;
  if (!list.some((w) => w.id === workspaceId)) return false;
  return countNotesInWorkspace(data?.notes || [], workspaceId) === 0;
}

export function deleteWorkspace(data, workspaceId) {
  if (!canDeleteWorkspace(data, workspaceId)) {
    throw new Error('ลบแผ่นงานไม่ได้ — ยังมีโน้ตอยู่ในแผ่นนี้ หรือเหลือแผ่นเดียว');
  }
  const now = new Date().toISOString();
  return {
    ...data,
    workspaces: normalizeWorkspaces(data.workspaces).filter((w) => w.id !== workspaceId),
    updatedAt: now,
  };
}

export function addWorkspace(data, name) {
  const list = normalizeWorkspaces(data.workspaces);
  const ws = createWorkspace(name, (list[list.length - 1]?.order || 0) + 1);
  const now = new Date().toISOString();
  return {
    data: {
      ...data,
      workspaces: [...list, ws],
      updatedAt: now,
    },
    workspace: ws,
  };
}

/** Plain-text notepad pages (Note mode) — separate from งานหลัก tasks. */
export function createNotepad(name = 'Note ใหม่', order = Date.now()) {
  const now = new Date().toISOString();
  const trimmed = String(name || '').trim() || 'Note ใหม่';
  return {
    id: crypto.randomUUID(),
    name: trimmed.slice(0, 40),
    content: '',
    sheets: [],
    textPrefs: normalizeTextPrefs(null),
    order: Number.isFinite(order) ? order : Date.now(),
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeNotepads(raw) {
  const list = Array.isArray(raw)
    ? raw
        .filter((n) => n && typeof n === 'object' && n.id)
        .map((n, i) => ({
          id: String(n.id),
          name: String(n.name || 'Note').trim().slice(0, 40) || 'Note',
          content: typeof n.content === 'string' ? n.content : '',
          sheets: normalizeSheetBlocks(n.sheets),
          textPrefs: normalizeTextPrefs(n.textPrefs),
          order: Number.isFinite(n.order) ? n.order : i,
          createdAt: n.createdAt || new Date().toISOString(),
          updatedAt: n.updatedAt || n.createdAt || new Date().toISOString(),
        }))
    : [];
  list.sort((a, b) => b.order - a.order || String(a.name).localeCompare(String(b.name), 'th'));
  return list;
}

/**
 * v7 migrate: former non-default "workspaces" become empty notepads
 * (งานหลัก no longer splits tasks by workspace).
 */
export function migrateWorkspacesToNotepads(workspaces, existingNotepads) {
  const pads = normalizeNotepads(existingNotepads);
  if (pads.length) return pads;
  const extras = normalizeWorkspaces(workspaces).filter((w) => w.id !== DEFAULT_WORKSPACE_ID);
  if (!extras.length) return pads;
  return extras.map((w, i) => ({
    id: w.id.startsWith('ws-') ? `np-${w.id.slice(3)}` : `np-${w.id}`,
    name: w.name,
    content: '',
    sheets: [],
    textPrefs: normalizeTextPrefs(null),
    order: Date.now() - i,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }));
}

export function getNotepad(data, notepadId) {
  const list = normalizeNotepads(data?.notepads);
  return list.find((n) => n.id === notepadId) || null;
}

export function addNotepad(data, name) {
  const list = normalizeNotepads(data.notepads);
  const pad = createNotepad(name, Date.now());
  const now = new Date().toISOString();
  return {
    data: {
      ...data,
      notepads: [pad, ...list],
      updatedAt: now,
    },
    notepad: pad,
  };
}

export function renameNotepad(data, notepadId, name) {
  const trimmed = String(name || '').trim().slice(0, 40);
  if (!trimmed) return data;
  const now = new Date().toISOString();
  return {
    ...data,
    notepads: normalizeNotepads(data.notepads).map((n) =>
      n.id === notepadId ? { ...n, name: trimmed, updatedAt: now } : n,
    ),
    updatedAt: now,
  };
}

export function updateNotepadContent(data, notepadId, { name, content, sheets, textPrefs } = {}) {
  const now = new Date().toISOString();
  return {
    ...data,
    notepads: normalizeNotepads(data.notepads).map((n) => {
      if (n.id !== notepadId) return n;
      return {
        ...n,
        name: name !== undefined ? String(name).trim().slice(0, 40) || n.name : n.name,
        content: content !== undefined ? String(content) : n.content,
        sheets: sheets !== undefined ? normalizeSheetBlocks(sheets) : normalizeSheetBlocks(n.sheets),
        textPrefs: textPrefs !== undefined ? normalizeTextPrefs(textPrefs) : normalizeTextPrefs(n.textPrefs),
        updatedAt: now,
      };
    }),
    updatedAt: now,
  };
}

export function deleteNotepad(data, notepadId) {
  const list = normalizeNotepads(data.notepads);
  if (!list.some((n) => n.id === notepadId)) {
    throw new Error('ไม่พบ Note นี้');
  }
  const now = new Date().toISOString();
  return {
    ...data,
    notepads: list.filter((n) => n.id !== notepadId),
    updatedAt: now,
  };
}

export function createNote(title = '', content = '', workspaceId = DEFAULT_WORKSPACE_ID) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    content,
    workspaceId: workspaceId || DEFAULT_WORKSPACE_ID,
    tagIds: [],
    attachments: [],
    checklist: [],
    scheduledAt: null,
    recurrence: null,
    remindBefore: 'default',
    notifyRepeat: 'none',
    priority: NOTE_PRIORITY.NORMAL,
    status: NOTE_STATUS.ACTIVE,
    completedAt: null,
    deletedAt: null,
    order: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createTag(name, color, icon) {
  const now = new Date().toISOString();
  const trimmed = name.trim();
  return {
    id: crypto.randomUUID(),
    name: trimmed,
    color: safeTagColor(color),
    icon: normalizeTagIcon(icon, trimmed),
    createdAt: now,
  };
}

export function updateNote(note, { title, content, scheduledAt, recurrence, priority, remindBefore, notifyRepeat, checklist }) {
  const next = {
    ...note,
    title: title !== undefined ? title.trim() : note.title,
    content: content !== undefined ? content : note.content,
    updatedAt: new Date().toISOString(),
  };
  if (scheduledAt !== undefined) {
    next.scheduledAt = scheduledAt || null;
    // Manual due change replaces a postpone — series base resets to the new date.
    if (scheduledAt !== note.scheduledAt) next.cycleAnchor = null;
  }
  if (recurrence !== undefined) {
    next.recurrence = normalizeRecurrence(recurrence);
  }
  if (remindBefore !== undefined) {
    const allowed = [
      'default',
      'at',
      '5m',
      '15m',
      '30m',
      '1h',
      '2h',
      '1d',
      '2d',
      '1w',
      '2w',
      '1mo',
    ];
    next.remindBefore = allowed.includes(remindBefore) ? remindBefore : 'default';
  }
  if (notifyRepeat !== undefined) {
    next.notifyRepeat = normalizeNotifyRepeat(notifyRepeat);
  }
  if (checklist !== undefined) {
    next.checklist = normalizeChecklist(checklist);
  }
  if (priority !== undefined) {
    next.priority = Object.values(NOTE_PRIORITY).includes(priority)
      ? priority
      : NOTE_PRIORITY.NORMAL;
  }
  return next;
}

export function sortNotes(notes) {
  return [...notes].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function sortNotesManual(notes) {
  return [...notes].sort((a, b) => {
    const ao = Number.isFinite(a.order) ? a.order : Infinity;
    const bo = Number.isFinite(b.order) ? b.order : Infinity;
    if (ao !== bo) return ao - bo;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function applyManualOrder(data, orderedIds) {
  const idx = new Map(orderedIds.map((id, i) => [id, i]));
  return {
    ...data,
    notes: data.notes.map((note) =>
      idx.has(note.id) ? { ...note, order: idx.get(note.id) } : note,
    ),
  };
}

export function previewText(note) {
  const checks = normalizeChecklist(note?.checklist);
  if (checks.length) {
    const done = checks.filter((c) => c.done).length;
    const open = checks.find((c) => !c.done);
    const prog = `${done}/${checks.length}`;
    if (open?.text) return `☑ ${prog} · ${open.text}`;
    return `☑ ${prog} เสร็จครบ`;
  }
  const text = String(note.content || '').replace(/\s+/g, ' ').trim();
  if (text) {
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  }
  const n = Array.isArray(note.attachments) ? note.attachments.length : 0;
  if (n === 1) {
    const a = note.attachments[0];
    return a?.mimeType?.startsWith('image/') ? '📷 รูปแนบ' : `📎 ${a?.name || 'ไฟล์แนบ'}`;
  }
  if (n > 1) return `📎 ไฟล์แนบ ${n} รายการ`;
  return '';
}

export function noteHasContent(note) {
  return Boolean(previewText(note));
}

/** @param {unknown} raw @returns {{ id: string, text: string, done: boolean }[]} */
export function normalizeChecklist(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const text = String(item.text || item.title || '').trim().slice(0, 200);
    if (!text) return;
    out.push({
      id: String(item.id || (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `c-${Date.now()}-${out.length}`)),
      text,
      done: Boolean(item.done),
    });
  });
  return out.slice(0, 40);
}

export function checklistProgress(note) {
  const list = normalizeChecklist(note?.checklist);
  if (!list.length) return null;
  const done = list.filter((c) => c.done).length;
  return { total: list.length, done, open: list.length - done };
}

export function toggleChecklistItem(note, itemId) {
  const list = normalizeChecklist(note?.checklist).map((item) =>
    item.id === itemId ? { ...item, done: !item.done } : item,
  );
  return {
    ...note,
    checklist: list,
    updatedAt: new Date().toISOString(),
  };
}

/** @param {unknown} raw */
export function normalizeAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (a) =>
        a &&
        typeof a === 'object' &&
        a.mimeType &&
        (a.data || a.storagePath || a.previewUrl),
    )
    .map((a) => {
      const mimeType = String(a.mimeType || 'application/octet-stream').slice(0, 120);
      const data = a.data ? String(a.data) : '';
      const storagePath = a.storagePath ? String(a.storagePath) : '';
      const size = Number.isFinite(a.size)
        ? a.size
        : data
          ? Math.ceil((data.length * 3) / 4)
          : 0;
      return {
        id: String(a.id || crypto.randomUUID()),
        name: String(a.name || 'ไฟล์').slice(0, 120),
        mimeType,
        ...(data ? { data } : {}),
        ...(storagePath ? { storagePath } : {}),
        ...(a.previewUrl ? { previewUrl: String(a.previewUrl) } : {}),
        size,
        kind:
          a.kind === 'image' || mimeType.startsWith('image/') ? 'image' : 'file',
        fullRes: a.fullRes !== false,
      };
    })
    .slice(0, 8);
}

/** Persist shape: prefer cloud path; keep base64 only when no storagePath. */
export function attachmentsForPersist(raw) {
  return normalizeAttachments(raw)
    .map((a) => {
      const base = {
        id: a.id,
        name: a.name,
        mimeType: a.mimeType,
        size: a.size,
        kind: a.kind,
        fullRes: a.fullRes !== false,
      };
      if (a.storagePath) return { ...base, storagePath: a.storagePath };
      if (a.data) return { ...base, data: a.data };
      return null;
    })
    .filter(Boolean);
}

export function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

// Upgrades any older payload to the current shape.
// v5: snap all scheduledAt times to local 09:00 (one-time when version < 5).
// v6: workspaces[] + note.workspaceId (legacy; งานหลัก no longer filters by these).
// v7: notepads[] for Note mode (plain text); migrate extra workspaces → notepads.
// v8: calorie spreadsheet payload (day rows + protein/base settings).
export function normalizeNotesData(data) {
  const base = data && typeof data === 'object' ? data : {};
  const prevVersion = Number(base.version) || 1;
  const snapScheduleTimes = prevVersion < 5;
  const workspaces = normalizeWorkspaces(base.workspaces);
  const workspaceIds = new Set(workspaces.map((w) => w.id));
  const fallbackWs = workspaces[0]?.id || DEFAULT_WORKSPACE_ID;
  const notepads =
    prevVersion < 7
      ? migrateWorkspacesToNotepads(workspaces, base.notepads)
      : normalizeNotepads(base.notepads);
  const calorie = base.calorie
    ? normalizeCalorie(base.calorie)
    : createEmptyCalorie();

  const tags = Array.isArray(base.tags)
    ? base.tags
        .filter((tag) => tag && typeof tag === 'object' && tag.id)
        .map((tag) => {
          const name = typeof tag.name === 'string' ? tag.name : '';
          return {
            id: String(tag.id),
            name,
            color: safeTagColor(tag.color),
            icon: normalizeTagIcon(tag.icon, name),
            createdAt: tag.createdAt || new Date().toISOString(),
          };
        })
    : [];

  const tagIds = new Set(tags.map((tag) => tag.id));

  const notes = Array.isArray(base.notes)
    ? base.notes.map((note) => {
        let scheduledAt = note.scheduledAt || null;
        if (snapScheduleTimes && scheduledAt) {
          const d = new Date(scheduledAt);
          if (!Number.isNaN(d.getTime())) {
            d.setHours(9, 0, 0, 0);
            scheduledAt = d.toISOString();
          }
        }
        const ws =
          note.workspaceId && workspaceIds.has(String(note.workspaceId))
            ? String(note.workspaceId)
            : fallbackWs;
        return {
          ...note,
          workspaceId: ws,
          tagIds: Array.isArray(note.tagIds)
            ? note.tagIds.filter((id) => tagIds.has(id))
            : [],
          scheduledAt,
          cycleAnchor: normalizeCycleAnchor(note.cycleAnchor),
          recurrence: normalizeRecurrence(note.recurrence),
          remindBefore: [
            'default',
            'at',
            '5m',
            '15m',
            '30m',
            '1h',
            '2h',
            '1d',
            '2d',
            '1w',
            '2w',
            '1mo',
          ].includes(note.remindBefore)
            ? note.remindBefore
            : 'default',
          notifyRepeat: normalizeNotifyRepeat(note.notifyRepeat),
          checklist: normalizeChecklist(note.checklist),
          attachments: attachmentsForPersist(note.attachments),
          priority: Object.values(NOTE_PRIORITY).includes(note.priority)
            ? note.priority
            : NOTE_PRIORITY.NORMAL,
          status: [NOTE_STATUS.ACTIVE, NOTE_STATUS.DONE, NOTE_STATUS.TRASH].includes(note.status)
            ? note.status
            : NOTE_STATUS.ACTIVE,
          completedAt: note.completedAt || null,
          deletedAt: note.deletedAt || null,
          order: Number.isFinite(note.order) ? note.order : null,
        };
      })
    : [];

  const bumped =
    (snapScheduleTimes && Array.isArray(base.notes) && base.notes.some((n) => n?.scheduledAt)) ||
    prevVersion < 8;

  return {
    version: 8,
    updatedAt: bumped ? new Date().toISOString() : base.updatedAt || new Date().toISOString(),
    workspaces,
    notepads,
    calorie,
    tags,
    notes,
  };
}

export function addTag(data, name, color) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    return { data, tag: null };
  }

  const existing = data.tags.find(
    (tag) => tag.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) {
    return { data, tag: existing };
  }

  const tag = createTag(trimmed, color || pickTagColor(data.tags.length));
  return { data: { ...data, tags: [...data.tags, tag] }, tag };
}

export function renameTag(data, tagId, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    return data;
  }
  return {
    ...data,
    tags: data.tags.map((tag) =>
      tag.id === tagId ? { ...tag, name: trimmed } : tag,
    ),
  };
}

export function setTagColor(data, tagId, color) {
  return {
    ...data,
    tags: data.tags.map((tag) =>
      tag.id === tagId ? { ...tag, color: safeTagColor(color) } : tag,
    ),
  };
}

export function setTagIcon(data, tagId, icon) {
  return {
    ...data,
    tags: data.tags.map((tag) =>
      tag.id === tagId
        ? { ...tag, icon: normalizeTagIcon(icon, tag.name) }
        : tag,
    ),
  };
}

export function deleteTag(data, tagId) {
  return {
    ...data,
    tags: data.tags.filter((tag) => tag.id !== tagId),
    notes: data.notes.map((note) => ({
      ...note,
      tagIds: (note.tagIds || []).filter((id) => id !== tagId),
    })),
  };
}

export function toggleNoteTag(note, tagId) {
  const tagIds = note.tagIds || [];
  const hasTag = tagIds.includes(tagId);
  return {
    ...note,
    tagIds: hasTag ? tagIds.filter((id) => id !== tagId) : [...tagIds, tagId],
    updatedAt: new Date().toISOString(),
  };
}

export function getTagsForNote(note, tags) {
  const ids = note.tagIds || [];
  return tags.filter((tag) => ids.includes(tag.id));
}

/** Sentinel for filter: notes with no tags */
export const TAG_FILTER_UNTAGGED = '__untagged__';

export function filterNotesByTag(notes, tagId) {
  if (!tagId) return notes;
  if (tagId === TAG_FILTER_UNTAGGED) {
    return notes.filter((note) => !(Array.isArray(note.tagIds) && note.tagIds.length));
  }
  return notes.filter((note) => (note.tagIds || []).includes(tagId));
}

export function countNotesByTag(notes, tagId) {
  if (tagId === TAG_FILTER_UNTAGGED) {
    return notes.reduce(
      (total, note) =>
        total + (isActiveNote(note) && !(Array.isArray(note.tagIds) && note.tagIds.length) ? 1 : 0),
      0,
    );
  }
  return notes.reduce(
    (total, note) =>
      total + (isActiveNote(note) && (note.tagIds || []).includes(tagId) ? 1 : 0),
    0,
  );
}

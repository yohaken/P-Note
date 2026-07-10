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

export function createNote(title = '', content = '') {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    content,
    tagIds: [],
    scheduledAt: null,
    priority: NOTE_PRIORITY.NORMAL,
    status: NOTE_STATUS.ACTIVE,
    completedAt: null,
    deletedAt: null,
    order: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createTag(name, color) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    color: safeTagColor(color),
    createdAt: now,
  };
}

export function updateNote(note, { title, content, scheduledAt, priority }) {
  const next = {
    ...note,
    title: title !== undefined ? title.trim() : note.title,
    content: content !== undefined ? content : note.content,
    updatedAt: new Date().toISOString(),
  };
  if (scheduledAt !== undefined) {
    next.scheduledAt = scheduledAt || null;
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
  const text = note.content.replace(/\s+/g, ' ').trim();
  if (!text) return 'ไม่มีเนื้อหา';
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
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

// Upgrades any older payload (v1: no tags/tagIds) to the current v2 shape.
// Idempotent — safe to run on already-migrated data.
export function normalizeNotesData(data) {
  const base = data && typeof data === 'object' ? data : {};

  const tags = Array.isArray(base.tags)
    ? base.tags
        .filter((tag) => tag && typeof tag === 'object' && tag.id)
        .map((tag) => ({
          id: String(tag.id),
          name: typeof tag.name === 'string' ? tag.name : '',
          color: safeTagColor(tag.color),
          createdAt: tag.createdAt || new Date().toISOString(),
        }))
    : [];

  const tagIds = new Set(tags.map((tag) => tag.id));

  const notes = Array.isArray(base.notes)
    ? base.notes.map((note) => ({
        ...note,
        tagIds: Array.isArray(note.tagIds)
          ? note.tagIds.filter((id) => tagIds.has(id))
          : [],
        scheduledAt: note.scheduledAt || null,
        priority: Object.values(NOTE_PRIORITY).includes(note.priority)
          ? note.priority
          : NOTE_PRIORITY.NORMAL,
        status: [NOTE_STATUS.ACTIVE, NOTE_STATUS.DONE, NOTE_STATUS.TRASH].includes(note.status)
          ? note.status
          : NOTE_STATUS.ACTIVE,
        completedAt: note.completedAt || null,
        deletedAt: note.deletedAt || null,
        order: Number.isFinite(note.order) ? note.order : null,
      }))
    : [];

  return {
    version: 4,
    updatedAt: base.updatedAt || new Date().toISOString(),
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

export function filterNotesByTag(notes, tagId) {
  if (!tagId) {
    return notes;
  }
  return notes.filter((note) => (note.tagIds || []).includes(tagId));
}

export function countNotesByTag(notes, tagId) {
  return notes.reduce(
    (total, note) =>
      total + (isActiveNote(note) && (note.tagIds || []).includes(tagId) ? 1 : 0),
    0,
  );
}

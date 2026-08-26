/**
 * Tombstones for hard deletes — survives multi-device merge (v9+).
 */
import { compareStamp, nowIso, newerStampIso } from './clock.js?v=224';

const KINDS = ['notes', 'notepads', 'tags'];

export function emptyDeletions() {
  return {
    notes: [],
    notepads: [],
    tags: [],
    updatedAt: '',
  };
}

function normalizeList(raw) {
  if (!Array.isArray(raw)) return [];
  const byId = new Map();
  for (const row of raw) {
    if (!row || typeof row !== 'object' || !row.id) continue;
    const id = String(row.id);
    const deletedAt = String(row.deletedAt || '').trim();
    const prev = byId.get(id);
    if (!prev || compareStamp(deletedAt, prev.deletedAt) > 0) {
      byId.set(id, { id, deletedAt });
    }
  }
  return [...byId.values()];
}

export function normalizeDeletions(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const notes = normalizeList(src.notes);
  const notepads = normalizeList(src.notepads);
  const tags = normalizeList(src.tags);
  const maxAt = newerStampIso(
    newerStampIso(src.updatedAt, notes.reduce((m, r) => newerStampIso(m, r.deletedAt), '')),
    notepads.reduce((m, r) => newerStampIso(m, r.deletedAt), ''),
  );
  const tagMax = tags.reduce((m, r) => newerStampIso(m, r.deletedAt), '');
  return {
    notes,
    notepads,
    tags,
    updatedAt: newerStampIso(maxAt, tagMax),
  };
}

export function mergeDeletions(localRaw, remoteRaw) {
  const local = normalizeDeletions(localRaw);
  const remote = normalizeDeletions(remoteRaw);
  const out = emptyDeletions();
  for (const kind of KINDS) {
    const map = new Map();
    local[kind].forEach((r) => map.set(r.id, r));
    remote[kind].forEach((r) => {
      const prev = map.get(r.id);
      if (!prev || compareStamp(r.deletedAt, prev.deletedAt) > 0) {
        map.set(r.id, r);
      }
    });
    out[kind] = [...map.values()];
  }
  out.updatedAt = newerStampIso(local.updatedAt, remote.updatedAt);
  for (const kind of KINDS) {
    for (const r of out[kind]) {
      out.updatedAt = newerStampIso(out.updatedAt, r.deletedAt);
    }
  }
  return out;
}

/** Tombstone wins when deletedAt is newer than (or equal to) entity updatedAt. */
export function isEntityTombstoned(deletionsRaw, kind, entityId, entityUpdatedAt = '') {
  if (!KINDS.includes(kind)) return false;
  const list = normalizeDeletions(deletionsRaw)[kind];
  const row = list.find((r) => r.id === String(entityId));
  if (!row || !row.deletedAt) return false;
  return compareStamp(row.deletedAt, entityUpdatedAt) >= 0;
}

function upsertTombstone(deletions, kind, id, deletedAt) {
  const list = [...deletions[kind]];
  const sid = String(id);
  const at = deletedAt || nowIso();
  const idx = list.findIndex((r) => r.id === sid);
  if (idx >= 0) {
    list[idx] = { id: sid, deletedAt: newerStampIso(list[idx].deletedAt, at) };
  } else {
    list.push({ id: sid, deletedAt: at });
  }
  return {
    ...deletions,
    [kind]: list,
    updatedAt: newerStampIso(deletions.updatedAt, at),
  };
}

/**
 * Record hard delete: tombstone + remove from live array.
 * @param {object} data normalized notes payload
 * @param {'notes'|'notepads'|'tags'} kind
 * @param {string} id
 */
export function recordHardDelete(data, kind, id) {
  const at = nowIso();
  const deletions = upsertTombstone(normalizeDeletions(data.deletions), kind, id, at);
  const sid = String(id);
  if (kind === 'notes') {
    return {
      ...data,
      notes: (data.notes || []).filter((n) => n.id !== sid),
      deletions,
      updatedAt: newerStampIso(data.updatedAt, at),
    };
  }
  if (kind === 'notepads') {
    return {
      ...data,
      notepads: (data.notepads || []).filter((n) => n.id !== sid),
      deletions,
      updatedAt: newerStampIso(data.updatedAt, at),
    };
  }
  if (kind === 'tags') {
    return {
      ...data,
      tags: (data.tags || []).filter((t) => t.id !== sid),
      notes: (data.notes || []).map((n) => ({
        ...n,
        tagIds: (n.tagIds || []).filter((tid) => tid !== sid),
      })),
      deletions,
      updatedAt: newerStampIso(data.updatedAt, at),
    };
  }
  return { ...data, deletions, updatedAt: newerStampIso(data.updatedAt, at) };
}

/** Drop entities superseded by tombstones after union merge. */
export function applyDeletionFilter(data) {
  const deletions = normalizeDeletions(data.deletions);
  const notes = (data.notes || []).filter(
    (n) => !isEntityTombstoned(deletions, 'notes', n.id, n.updatedAt),
  );
  const notepads = (data.notepads || []).filter(
    (n) => !isEntityTombstoned(deletions, 'notepads', n.id, n.updatedAt),
  );
  const tags = (data.tags || []).filter(
    (t) => !isEntityTombstoned(deletions, 'tags', t.id, t.createdAt),
  );
  const tagIds = new Set(tags.map((t) => t.id));
  return {
    ...data,
    notes: notes.map((n) => ({
      ...n,
      tagIds: (n.tagIds || []).filter((id) => tagIds.has(id)),
    })),
    notepads,
    tags,
    deletions,
  };
}

export function createNote(title = '', content = '') {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    content,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateNote(note, { title, content }) {
  return {
    ...note,
    title: title !== undefined ? title.trim() : note.title,
    content: content !== undefined ? content : note.content,
    updatedAt: new Date().toISOString(),
  };
}

export function sortNotes(notes) {
  return [...notes].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
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

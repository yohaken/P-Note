import { loadNotes, exportNotesBlob, parseNotesImport } from './local.js?v=15';
import { registerServiceWorker } from './cache.js?v=15';
import {
  addTag,
  countNotesByTag,
  createNote,
  deleteTag,
  filterNotesByTag,
  formatDate,
  getTagsForNote,
  previewText,
  renameTag,
  safeTagColor,
  setTagColor,
  sortNotes,
  toggleNoteTag,
  updateNote,
} from './notes.js?v=15';
import { SaveManager } from './sync.js?v=15';
import { getAppBuild } from './version.js?v=15';

const state = {
  notesData: { version: 2, updatedAt: '', tags: [], notes: [] },
  activeNoteId: null,
  tagFilterId: null,
  view: 'list',
};

const saveManager = new SaveManager();
let statusTimer = null;

const els = {
  app: document.getElementById('app'),
  listView: document.getElementById('list-view'),
  editorView: document.getElementById('editor-view'),
  notesList: document.getElementById('notes-list'),
  emptyState: document.getElementById('empty-state'),
  addNoteBtn: document.getElementById('add-note-btn'),
  manageTagsBtn: document.getElementById('manage-tags-btn'),
  exportBtn: document.getElementById('export-btn'),
  importBtn: document.getElementById('import-btn'),
  importInput: document.getElementById('import-input'),
  appVersion: document.getElementById('app-version'),
  tagFilterBar: document.getElementById('tag-filter-bar'),
  backBtn: document.getElementById('back-btn'),
  saveBtn: document.getElementById('save-btn'),
  deleteBtn: document.getElementById('delete-btn'),
  noteTitle: document.getElementById('note-title'),
  noteContent: document.getElementById('note-content'),
  editorTags: document.getElementById('editor-tags'),
  syncStatus: document.getElementById('sync-status'),
  editorSyncStatus: document.getElementById('editor-sync-status'),
  tagModal: document.getElementById('tag-modal'),
  tagAddForm: document.getElementById('tag-add-form'),
  newTagInput: document.getElementById('new-tag-input'),
  tagManagerList: document.getElementById('tag-manager-list'),
  closeTagModalBtn: document.getElementById('close-tag-modal-btn'),
  loadingOverlay: document.getElementById('loading-overlay'),
};

function showView(view) {
  state.view = view;
  els.listView.hidden = view !== 'list';
  els.editorView.hidden = view !== 'editor';
}

function setLoading(visible, message = 'กำลังโหลด...') {
  els.loadingOverlay.hidden = !visible;
  els.loadingOverlay.querySelector('p').textContent = message;
}

function setStatus(message, target = 'both') {
  if (target === 'both' || target === 'list') {
    els.syncStatus.textContent = message;
  }
  if (target === 'both' || target === 'editor') {
    els.editorSyncStatus.textContent = message;
  }

  clearTimeout(statusTimer);
  if (message === 'บันทึกแล้ว') {
    statusTimer = setTimeout(() => {
      els.syncStatus.textContent = '';
      els.editorSyncStatus.textContent = '';
    }, 2000);
  }
}

function getActiveNote() {
  return state.notesData.notes.find((note) => note.id === state.activeNoteId) || null;
}

function persistLocalChanges() {
  const note = getActiveNote();
  if (!note) return;

  const updated = updateNote(note, {
    title: els.noteTitle.value,
    content: els.noteContent.value,
  });

  state.notesData.notes = state.notesData.notes.map((item) =>
    item.id === updated.id ? updated : item,
  );
}

// Replaces the whole payload, persists it, and refreshes tag-aware views.
function commitData(newData) {
  state.notesData = newData;
  saveManager.saveNow(state.notesData);
  renderNotesList();
  renderEditorTags();
  renderTagManager();
}

function renderTagFilterBar() {
  const tags = state.notesData.tags || [];
  els.tagFilterBar.innerHTML = '';
  if (!tags.length) return;

  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = `tag-filter-chip${state.tagFilterId ? '' : ' active'}`;
  allChip.textContent = 'ทั้งหมด';
  allChip.addEventListener('click', () => {
    state.tagFilterId = null;
    renderNotesList();
  });
  els.tagFilterBar.appendChild(allChip);

  tags.forEach((tag) => {
    const active = state.tagFilterId === tag.id;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `tag-filter-chip${active ? ' active' : ''}`;
    chip.style.setProperty('--tag', safeTagColor(tag.color));
    chip.textContent = `${tag.name} (${countNotesByTag(state.notesData.notes, tag.id)})`;
    chip.addEventListener('click', () => {
      state.tagFilterId = active ? null : tag.id;
      renderNotesList();
    });
    els.tagFilterBar.appendChild(chip);
  });
}

function renderNotesList() {
  renderTagFilterBar();

  const filtered = filterNotesByTag(state.notesData.notes, state.tagFilterId);
  const notes = sortNotes(filtered);
  els.notesList.innerHTML = '';

  notes.forEach((note) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'note-card';

    const tags = getTagsForNote(note, state.notesData.tags || []);
    const chipsHtml = tags.length
      ? `<div class="tag-chips">${tags
          .map(
            (tag) =>
              `<span class="tag-chip" style="--tag:${safeTagColor(tag.color)}">${escapeHtml(tag.name)}</span>`,
          )
          .join('')}</div>`
      : '';

    item.innerHTML = `
      <h3>${escapeHtml(note.title || 'ไม่มีหัวข้อ')}</h3>
      <p>${escapeHtml(previewText(note))}</p>
      ${chipsHtml}
      <time>${escapeHtml(formatDate(note.updatedAt))}</time>
    `;
    item.addEventListener('click', () => openEditor(note.id));
    els.notesList.appendChild(item);
  });

  els.emptyState.hidden = notes.length > 0;
}

function renderEditorTags() {
  const note = getActiveNote();
  els.editorTags.innerHTML = '';
  if (!note) return;

  const tags = state.notesData.tags || [];
  tags.forEach((tag) => {
    const selected = (note.tagIds || []).includes(tag.id);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `editor-tag-chip${selected ? ' selected' : ''}`;
    chip.style.setProperty('--tag', safeTagColor(tag.color));
    chip.textContent = tag.name;
    chip.addEventListener('click', () => toggleActiveNoteTag(tag.id));
    els.editorTags.appendChild(chip);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'editor-tag-chip add-tag';
  addBtn.textContent = '+ แท็ก';
  addBtn.addEventListener('click', openTagManager);
  els.editorTags.appendChild(addBtn);
}

function toggleActiveNoteTag(tagId) {
  const note = getActiveNote();
  if (!note) return;

  const updated = toggleNoteTag(note, tagId);
  state.notesData = {
    ...state.notesData,
    notes: state.notesData.notes.map((item) =>
      item.id === updated.id ? updated : item,
    ),
  };
  saveManager.saveNow(state.notesData);
  renderEditorTags();
}

function openTagManager() {
  renderTagManager();
  els.tagModal.hidden = false;
  els.newTagInput.value = '';
  els.newTagInput.focus();
}

function closeTagManager() {
  els.tagModal.hidden = true;
}

function renderTagManager() {
  const tags = state.notesData.tags || [];
  els.tagManagerList.innerHTML = '';

  tags.forEach((tag) => {
    const row = document.createElement('div');
    row.className = 'tag-manager-row';

    const color = document.createElement('input');
    color.type = 'color';
    color.className = 'tag-color-input';
    color.value = safeTagColor(tag.color);
    color.setAttribute('aria-label', 'สีแท็ก');
    color.addEventListener('change', () => {
      commitData(setTagColor(state.notesData, tag.id, color.value));
    });

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'tag-manager-name';
    name.value = tag.name;
    name.maxLength = 40;
    name.addEventListener('change', () => {
      const value = name.value.trim();
      if (value) {
        commitData(renameTag(state.notesData, tag.id, value));
      } else {
        name.value = tag.name;
      }
    });

    const count = document.createElement('span');
    count.className = 'tag-manager-count';
    count.textContent = `${countNotesByTag(state.notesData.notes, tag.id)} โน้ต`;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'tag-delete-btn';
    del.setAttribute('aria-label', 'ลบแท็ก');
    del.textContent = '✕';
    del.addEventListener('click', () => {
      if (window.confirm(`ลบแท็ก "${tag.name}"? โน้ตจะไม่ถูกลบ`)) {
        commitData(deleteTag(state.notesData, tag.id));
      }
    });

    row.append(color, name, count, del);
    els.tagManagerList.appendChild(row);
  });
}

function openEditor(noteId) {
  const note = state.notesData.notes.find((item) => item.id === noteId);
  if (!note) return;

  state.activeNoteId = noteId;
  els.noteTitle.value = note.title;
  els.noteContent.value = note.content;
  setStatus('');
  showView('editor');
  renderEditorTags();
}

function openNewNote() {
  const note = createNote();
  state.notesData.notes.unshift(note);
  openEditor(note.id);
  saveManager.saveNow(state.notesData).then(() => renderNotesList());
}

function backToList() {
  persistLocalChanges();
  state.activeNoteId = null;
  renderNotesList();
  showView('list');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateAppVersionLabel() {
  if (els.appVersion) {
    els.appVersion.textContent = `v${getAppBuild()} · เก็บในเครื่อง`;
  }
}

function exportBackup() {
  const blob = exportNotesBlob(state.notesData);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pnote-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus('ส่งออกไฟล์แล้ว');
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = parseNotesImport(reader.result);
      if (!window.confirm('แทนที่โน้ตทั้งหมดด้วยไฟล์สำรอง?')) {
        return;
      }
      state.notesData = data;
      state.tagFilterId = null;
      saveManager.saveNow(state.notesData);
      renderNotesList();
      setStatus('นำเข้าสำเร็จ');
    } catch {
      window.alert('ไฟล์ไม่ถูกต้อง');
    }
  };
  reader.readAsText(file);
}

function bootstrapData() {
  setLoading(true, 'กำลังโหลดโน้ต...');
  const { data } = loadNotes();
  state.notesData = data;
  state.tagFilterId = null;

  saveManager.configure({
    onStatus: (message) => setStatus(message),
  });

  renderNotesList();
  showView('list');
  setLoading(false);
  updateAppVersionLabel();
}

async function init() {
  registerServiceWorker();

  els.addNoteBtn.addEventListener('click', openNewNote);
  els.manageTagsBtn.addEventListener('click', openTagManager);
  els.exportBtn.addEventListener('click', exportBackup);
  els.importBtn.addEventListener('click', () => els.importInput.click());
  els.importInput.addEventListener('change', () => {
    importBackup(els.importInput.files?.[0]);
    els.importInput.value = '';
  });
  els.backBtn.addEventListener('click', backToList);

  els.tagAddForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const { data, tag } = addTag(state.notesData, els.newTagInput.value);
    if (tag) {
      commitData(data);
    }
    els.newTagInput.value = '';
    els.newTagInput.focus();
  });
  els.closeTagModalBtn.addEventListener('click', closeTagManager);
  els.tagModal.addEventListener('click', (event) => {
    if (event.target === els.tagModal) {
      closeTagManager();
    }
  });

  els.saveBtn.addEventListener('click', () => {
    persistLocalChanges();
    saveManager.saveNow(state.notesData);
  });

  els.deleteBtn.addEventListener('click', async () => {
    const note = getActiveNote();
    if (!note) return;
    if (!window.confirm('ลบโน้ตนี้?')) return;

    state.notesData.notes = state.notesData.notes.filter((item) => item.id !== note.id);
    await saveManager.saveNow(state.notesData);
    backToList();
  });

  const handleInput = () => {
    persistLocalChanges();
    saveManager.scheduleSave(state.notesData);
  };

  els.noteTitle.addEventListener('input', handleInput);
  els.noteContent.addEventListener('input', handleInput);

  bootstrapData();
}

init();

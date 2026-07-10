import { autoLogin, handleAuthRedirect, isAuthRedirectPending, signOut, startLogin } from './auth.js?v=11';
import { loadNotes } from './drive.js?v=11';
import {
  addTag,
  countNotesByTag,
  createNote,
  deleteTag,
  filterNotesByTag,
  formatDate,
  getTagsForNote,
  normalizeNotesData,
  previewText,
  renameTag,
  safeTagColor,
  setTagColor,
  sortNotes,
  toggleNoteTag,
  updateNote,
} from './notes.js?v=11';
import { SaveManager } from './sync.js?v=11';

const state = {
  accessToken: null,
  notesData: { version: 2, updatedAt: '', tags: [], notes: [] },
  activeNoteId: null,
  tagFilterId: null,
  view: 'login',
};

const saveManager = new SaveManager();
let statusTimer = null;

const els = {
  app: document.getElementById('app'),
  loginView: document.getElementById('login-view'),
  listView: document.getElementById('list-view'),
  editorView: document.getElementById('editor-view'),
  deniedView: document.getElementById('denied-view'),
  loginBtn: document.getElementById('login-btn'),
  loginError: document.getElementById('login-error'),
  deniedMessage: document.getElementById('denied-message'),
  notesList: document.getElementById('notes-list'),
  emptyState: document.getElementById('empty-state'),
  addNoteBtn: document.getElementById('add-note-btn'),
  manageTagsBtn: document.getElementById('manage-tags-btn'),
  tagFilterBar: document.getElementById('tag-filter-bar'),
  signOutBtn: document.getElementById('sign-out-btn'),
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
  conflictModal: document.getElementById('conflict-modal'),
  useLocalBtn: document.getElementById('use-local-btn'),
  useRemoteBtn: document.getElementById('use-remote-btn'),
  loadingOverlay: document.getElementById('loading-overlay'),
};

function showView(view) {
  state.view = view;
  els.loginView.hidden = view !== 'login';
  els.listView.hidden = view !== 'list';
  els.editorView.hidden = view !== 'editor';
  els.deniedView.hidden = view !== 'denied';
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

async function bootstrapData(accessToken) {
  setLoading(true, 'กำลังโหลดโน้ตจาก Drive...');
  const { fileId, modifiedTime, data } = await loadNotes(accessToken);
  state.accessToken = accessToken;
  state.notesData = normalizeNotesData(data);
  state.tagFilterId = null;

  saveManager.configure({
    accessToken,
    fileId,
    modifiedTime,
    onStatus: (message) => setStatus(message),
    onConflict: () => {
      els.conflictModal.hidden = false;
    },
  });

  renderNotesList();
  showView('list');
  setStatus('โหลดเสร็จแล้ว');
  setLoading(false);
}

async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  els.loginBtn.addEventListener('click', async () => {
    els.loginError.textContent = '';
    setLoading(true, 'กำลังไปยัง Google...');
    try {
      const accessToken = await startLogin();
      if (!accessToken) {
        // Mobile redirect — page will navigate away to Google.
        return;
      }
      await bootstrapData(accessToken);
    } catch (error) {
      setLoading(false);
      if (error.message.includes('Access Denied')) {
        els.deniedMessage.textContent = error.message;
        showView('denied');
        return;
      }
      els.loginError.textContent = error.message;
      showView('login');
    }
  });
  els.addNoteBtn.addEventListener('click', openNewNote);
  els.manageTagsBtn.addEventListener('click', openTagManager);
  els.backBtn.addEventListener('click', backToList);
  els.signOutBtn.addEventListener('click', async () => {
    await signOut();
    state.accessToken = null;
    showView('login');
  });

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

  els.useLocalBtn.addEventListener('click', async () => {
    els.conflictModal.hidden = true;
    persistLocalChanges();
    saveManager.updateKnownModifiedTime(null);
    await saveManager.saveNow(state.notesData);
    saveManager.updateKnownModifiedTime(localStorage.getItem('pnote_modified_time'));
    setStatus('บันทึกทับข้อมูลบน cloud แล้ว');
  });

  els.useRemoteBtn.addEventListener('click', async () => {
    els.conflictModal.hidden = true;
    setLoading(true, 'กำลังโหลดข้อมูลล่าสุด...');
    await bootstrapData(state.accessToken);
  });

  setLoading(true, 'กำลังตรวจสอบการล็อกอิน...');

  try {
    const redirectToken = await handleAuthRedirect();
    if (redirectToken) {
      await bootstrapData(redirectToken);
      return;
    }

    const accessToken = await autoLogin();
    if (!accessToken) {
      if (isAuthRedirectPending()) {
        setLoading(true, 'กำลังไปยัง Google...');
        return;
      }
      setLoading(false);
      showView('login');
      return;
    }

    await bootstrapData(accessToken);
  } catch (error) {
    setLoading(false);
    if (error.message.includes('Access Denied')) {
      els.deniedMessage.textContent = error.message;
      showView('denied');
      return;
    }

    els.loginError.textContent = error.message;
    showView('login');
  }
}

init();

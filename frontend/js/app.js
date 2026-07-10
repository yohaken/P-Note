import { autoLogin, signOut, startLogin } from './auth.js?v=8';
import { loadNotes } from './drive.js?v=8';
import {
  createNote,
  formatDate,
  previewText,
  sortNotes,
  updateNote,
} from './notes.js?v=8';
import { SaveManager } from './sync.js?v=8';

const state = {
  accessToken: null,
  notesData: { version: 1, updatedAt: '', notes: [] },
  activeNoteId: null,
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
  signOutBtn: document.getElementById('sign-out-btn'),
  backBtn: document.getElementById('back-btn'),
  saveBtn: document.getElementById('save-btn'),
  deleteBtn: document.getElementById('delete-btn'),
  noteTitle: document.getElementById('note-title'),
  noteContent: document.getElementById('note-content'),
  syncStatus: document.getElementById('sync-status'),
  editorSyncStatus: document.getElementById('editor-sync-status'),
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

function renderNotesList() {
  const notes = sortNotes(state.notesData.notes);
  els.notesList.innerHTML = '';

  notes.forEach((note) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'note-card';
    item.innerHTML = `
      <h3>${escapeHtml(note.title || 'ไม่มีหัวข้อ')}</h3>
      <p>${escapeHtml(previewText(note))}</p>
      <time>${escapeHtml(formatDate(note.updatedAt))}</time>
    `;
    item.addEventListener('click', () => openEditor(note.id));
    els.notesList.appendChild(item);
  });

  els.emptyState.hidden = notes.length > 0;
}

function openEditor(noteId) {
  const note = state.notesData.notes.find((item) => item.id === noteId);
  if (!note) return;

  state.activeNoteId = noteId;
  els.noteTitle.value = note.title;
  els.noteContent.value = note.content;
  setStatus('');
  showView('editor');
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
  state.notesData = data;

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
    try {
      const accessToken = await startLogin();
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
  els.backBtn.addEventListener('click', backToList);
  els.signOutBtn.addEventListener('click', async () => {
    await signOut();
    state.accessToken = null;
    showView('login');
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
    const accessToken = await autoLogin();
    if (!accessToken) {
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

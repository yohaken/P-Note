import { loadNotes, exportNotesBlob, parseNotesImport, saveNotes } from './local.js?v=21';
import { registerServiceWorker } from './cache.js?v=21';
import { attachNoteCardInteractions, positionContextMenu } from './context-menu.js?v=21';
import { CONFIG } from './config.js?v=21';
import {
  hasAnyNotes,
  importFromText,
  mergeNotesData,
  recoverLegacyLocalStorage,
  tryAutoImport,
} from './import-data.js?v=21';
import {
  addTag,
  countNotesByTag,
  createNote,
  deleteTag,
  filterNotesByStatus,
  filterNotesByTag,
  formatDate,
  getTagsForNote,
  markNoteActive,
  markNoteDone,
  moveNoteToTrash,
  NOTE_STATUS,
  previewText,
  purgeNote,
  renameTag,
  restoreNoteFromTrash,
  safeTagColor,
  setTagColor,
  sortNotes,
  toggleNoteTag,
  updateNote,
  updateNoteInData,
} from './notes.js?v=21';
import {
  formatScheduleDisplay,
  fromDatetimeLocalValue,
  getScheduleStatus,
  sortNotesBySchedule,
  toDatetimeLocalValue,
} from './schedule.js?v=21';
import { densityToCssUnit, loadSettings, saveSettings } from './settings.js?v=21';
import { SaveManager } from './sync.js?v=21';
import { forceRefresh, startUpdateWatcher } from './update.js?v=21';
import { getAppBuild } from './version.js?v=21';

const state = {
  notesData: { version: 4, updatedAt: '', tags: [], notes: [] },
  settings: loadSettings(),
  activeNoteId: null,
  tagFilterId: null,
  listGroup: NOTE_STATUS.ACTIVE,
  sortMode: 'updated',
  view: 'list',
  contextNoteId: null,
};

const saveManager = new SaveManager();
let statusTimer = null;

const els = {
  listView: document.getElementById('list-view'),
  editorView: document.getElementById('editor-view'),
  notesList: document.getElementById('notes-list'),
  emptyState: document.getElementById('empty-state'),
  emptyStateText: document.getElementById('empty-state-text'),
  addNoteBtn: document.getElementById('add-note-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  manageTagsBtn: document.getElementById('manage-tags-btn'),
  exportBtn: document.getElementById('export-btn'),
  importBtn: document.getElementById('import-btn'),
  importInput: document.getElementById('import-input'),
  appVersion: document.getElementById('app-version'),
  tagFilterBar: document.getElementById('tag-filter-bar'),
  sortBar: document.getElementById('sort-bar'),
  sortUpdatedBtn: document.getElementById('sort-updated-btn'),
  sortScheduleBtn: document.getElementById('sort-schedule-btn'),
  groupActiveBtn: document.getElementById('group-active-btn'),
  groupDoneBtn: document.getElementById('group-done-btn'),
  groupTrashBtn: document.getElementById('group-trash-btn'),
  backBtn: document.getElementById('back-btn'),
  deleteBtn: document.getElementById('delete-btn'),
  noteTitle: document.getElementById('note-title'),
  noteContent: document.getElementById('note-content'),
  noteSchedule: document.getElementById('note-schedule'),
  clearScheduleBtn: document.getElementById('clear-schedule-btn'),
  editorTags: document.getElementById('editor-tags'),
  syncStatus: document.getElementById('sync-status'),
  editorSyncStatus: document.getElementById('editor-sync-status'),
  tagModal: document.getElementById('tag-modal'),
  tagAddForm: document.getElementById('tag-add-form'),
  newTagInput: document.getElementById('new-tag-input'),
  tagManagerList: document.getElementById('tag-manager-list'),
  closeTagModalBtn: document.getElementById('close-tag-modal-btn'),
  settingsOverlay: document.getElementById('settings-overlay'),
  settingsBackdrop: document.getElementById('settings-backdrop'),
  cardDensitySlider: document.getElementById('card-density-slider'),
  importPaste: document.getElementById('import-paste'),
  importPasteBtn: document.getElementById('import-paste-btn'),
  recoverLocalBtn: document.getElementById('recover-local-btn'),
  closeSettingsBtn: document.getElementById('close-settings-btn'),
  noteContextMenu: document.getElementById('note-context-menu'),
  refreshAppBtn: document.getElementById('refresh-app-btn'),
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

function autosave() {
  saveManager.scheduleSave(() => state.notesData);
}

let editorComposing = false;
let editorSyncTimer = null;

function flushEditorToState() {
  persistLocalChanges();
  autosave();
}

function scheduleEditorSync() {
  clearTimeout(editorSyncTimer);
  editorSyncTimer = setTimeout(flushEditorToState, CONFIG.EDITOR_SYNC_DELAY_MS);
}

function bindEditorField(el) {
  el.addEventListener('compositionstart', () => {
    editorComposing = true;
  });
  el.addEventListener('compositionend', () => {
    editorComposing = false;
    scheduleEditorSync();
  });
  el.addEventListener('input', (event) => {
    if (editorComposing || event.isComposing) return;
    scheduleEditorSync();
  });
  el.addEventListener('blur', () => {
    if (state.view !== 'editor' || !state.activeNoteId) return;
    clearTimeout(editorSyncTimer);
    flushEditorToState();
  });
}

function applyCardDensity() {
  const unit = densityToCssUnit(state.settings.cardDensity);
  els.listView.style.setProperty('--card-density', String(unit));
  if (els.cardDensitySlider) {
    els.cardDensitySlider.value = String(state.settings.cardDensity);
  }
}

function getActiveNote() {
  return state.notesData.notes.find((note) => note.id === state.activeNoteId) || null;
}

function getNoteById(noteId) {
  return state.notesData.notes.find((note) => note.id === noteId) || null;
}

function persistLocalChanges() {
  const note = getActiveNote();
  if (!note) return;

  const updated = updateNote(note, {
    title: els.noteTitle.value,
    content: els.noteContent.value,
    scheduledAt: fromDatetimeLocalValue(els.noteSchedule.value),
  });

  state.notesData = updateNoteInData(state.notesData, updated);
}

function commitData(newData) {
  state.notesData = newData;
  autosave();
  renderNotesList();
  renderEditorTags();
  renderTagManager();
}

function notesForCurrentGroup() {
  return filterNotesByStatus(state.notesData.notes, state.listGroup);
}

function sortedFilteredNotes() {
  let notes = notesForCurrentGroup();
  notes = filterNotesByTag(notes, state.tagFilterId);
  return state.sortMode === 'schedule' ? sortNotesBySchedule(notes) : sortNotes(notes);
}

function renderGroupNav() {
  els.groupActiveBtn.classList.toggle('active', state.listGroup === NOTE_STATUS.ACTIVE);
  els.groupDoneBtn.classList.toggle('active', state.listGroup === NOTE_STATUS.DONE);
  els.groupTrashBtn.classList.toggle('active', state.listGroup === NOTE_STATUS.TRASH);

  const isActiveGroup = state.listGroup === NOTE_STATUS.ACTIVE;
  els.sortBar.hidden = !isActiveGroup;
  els.addNoteBtn.hidden = !isActiveGroup;
  els.tagFilterBar.hidden = !isActiveGroup;
}

function renderSortBar() {
  els.sortUpdatedBtn.classList.toggle('active', state.sortMode === 'updated');
  els.sortScheduleBtn.classList.toggle('active', state.sortMode === 'schedule');
}

function renderTagFilterBar() {
  if (state.listGroup !== NOTE_STATUS.ACTIVE) return;

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

function scheduleBadgeHtml(note) {
  if (!note.scheduledAt || state.listGroup !== NOTE_STATUS.ACTIVE) return '';
  const status = getScheduleStatus(note.scheduledAt);
  const label =
    status === 'overdue' ? 'เลยกำหนด' : status === 'today' ? 'วันนี้' : formatScheduleDisplay(note.scheduledAt);
  return `<span class="schedule-badge ${status}">📅 ${escapeHtml(label)}</span>`;
}

function emptyMessageForGroup() {
  if (state.listGroup === NOTE_STATUS.DONE) return 'ยังไม่มีโน้ตที่ทำแล้ว';
  if (state.listGroup === NOTE_STATUS.TRASH) return 'ถังขยะว่าง';
  return 'ยังไม่มีโน้ต';
}

function closeContextMenu() {
  els.noteContextMenu.hidden = true;
  state.contextNoteId = null;
}

function contextMenuActions(note) {
  if (state.listGroup === NOTE_STATUS.ACTIVE) {
    return [
      { id: 'done', label: 'ทำแล้ว', action: () => applyNoteAction(note.id, 'done') },
      { id: 'trash', label: 'ลบ', danger: true, action: () => applyNoteAction(note.id, 'trash') },
    ];
  }
  if (state.listGroup === NOTE_STATUS.DONE) {
    return [
      { id: 'restore', label: 'คืนเป็นงาน', action: () => applyNoteAction(note.id, 'restore') },
      { id: 'trash', label: 'ลบ', danger: true, action: () => applyNoteAction(note.id, 'trash') },
    ];
  }
  return [
    { id: 'restore', label: 'กู้คืน', action: () => applyNoteAction(note.id, 'restore') },
    {
      id: 'purge',
      label: 'ลบถาวร',
      danger: true,
      action: () => applyNoteAction(note.id, 'purge'),
    },
  ];
}

function openContextMenu(noteId, clientX, clientY) {
  const note = getNoteById(noteId);
  if (!note) return;

  state.contextNoteId = noteId;
  els.noteContextMenu.innerHTML = '';
  contextMenuActions(note).forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `context-menu-item${item.danger ? ' danger' : ''}`;
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      closeContextMenu();
      item.action();
    });
    els.noteContextMenu.appendChild(btn);
  });

  positionContextMenu(els.noteContextMenu, clientX, clientY);
}

function applyNoteAction(noteId, action) {
  const note = getNoteById(noteId);
  if (!note) return;

  let updated = note;
  if (action === 'done') updated = markNoteDone(note);
  else if (action === 'trash') updated = moveNoteToTrash(note);
  else if (action === 'restore') {
    updated = state.listGroup === NOTE_STATUS.TRASH ? restoreNoteFromTrash(note) : markNoteActive(note);
  } else if (action === 'purge') {
    if (!window.confirm('ลบโน้ตนี้ถาวร?')) return;
    commitData(purgeNote(noteId, state.notesData));
    setStatus('ลบถาวรแล้ว');
    return;
  }

  state.notesData = updateNoteInData(state.notesData, updated);
  autosave();
  renderNotesList();
  setStatus(action === 'done' ? 'ย้ายไปทำแล้ว' : action === 'trash' ? 'ย้ายไปถังขยะ' : 'กู้คืนแล้ว');
}

function renderNotesList() {
  renderGroupNav();
  renderSortBar();
  renderTagFilterBar();
  applyCardDensity();

  const notes = sortedFilteredNotes();
  els.notesList.innerHTML = '';

  notes.forEach((note) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'note-card';
    if (state.listGroup === NOTE_STATUS.DONE) item.classList.add('done-card');
    if (state.listGroup === NOTE_STATUS.TRASH) item.classList.add('trash-card');

    const tags = getTagsForNote(note, state.notesData.tags || []);
    const chipsHtml = tags.length
      ? `<div class="tag-chips">${tags
          .map(
            (tag) =>
              `<span class="tag-chip" style="--tag:${safeTagColor(tag.color)}">${escapeHtml(tag.name)}</span>`,
          )
          .join('')}</div>`
      : '';

    const metaTime =
      state.listGroup === NOTE_STATUS.DONE && note.completedAt
        ? `ทำแล้ว ${escapeHtml(formatDate(note.completedAt))}`
        : state.listGroup === NOTE_STATUS.TRASH && note.deletedAt
          ? `ลบ ${escapeHtml(formatDate(note.deletedAt))}`
          : `แก้ไข ${escapeHtml(formatDate(note.updatedAt))}`;

    item.innerHTML = `
      ${scheduleBadgeHtml(note)}
      <h3>${escapeHtml(note.title || 'ไม่มีหัวข้อ')}</h3>
      <p>${escapeHtml(previewText(note))}</p>
      ${chipsHtml}
      <time>${metaTime}</time>
    `;

    attachNoteCardInteractions(item, {
      noteId: note.id,
      onTap: () => openEditor(note.id),
      onLongPress: ({ clientX, clientY }) => openContextMenu(note.id, clientX, clientY),
    });

    els.notesList.appendChild(item);
  });

  els.emptyStateText.textContent = emptyMessageForGroup();
  els.emptyState.hidden = notes.length > 0;
  els.emptyState.querySelector('.btn-primary').hidden = state.listGroup !== NOTE_STATUS.ACTIVE;
}

function renderEditorTags() {
  const note = getActiveNote();
  els.editorTags.innerHTML = '';
  if (!note) return;

  (state.notesData.tags || []).forEach((tag) => {
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
  state.notesData = updateNoteInData(state.notesData, updated);
  autosave();
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

function openSettings() {
  els.settingsOverlay.hidden = false;
  els.cardDensitySlider.value = String(state.settings.cardDensity);
}

function closeSettings() {
  els.settingsOverlay.hidden = true;
}

function renderTagManager() {
  els.tagManagerList.innerHTML = '';
  (state.notesData.tags || []).forEach((tag) => {
    const row = document.createElement('div');
    row.className = 'tag-manager-row';

    const color = document.createElement('input');
    color.type = 'color';
    color.className = 'tag-color-input';
    color.value = safeTagColor(tag.color);
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
      if (value) commitData(renameTag(state.notesData, tag.id, value));
      else name.value = tag.name;
    });

    const count = document.createElement('span');
    count.className = 'tag-manager-count';
    count.textContent = `${countNotesByTag(state.notesData.notes, tag.id)} โน้ต`;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'tag-delete-btn';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      if (window.confirm(`ลบแท็ก "${tag.name}"?`)) {
        commitData(deleteTag(state.notesData, tag.id));
      }
    });

    row.append(color, name, count, del);
    els.tagManagerList.appendChild(row);
  });
}

function openEditor(noteId) {
  const note = getNoteById(noteId);
  if (!note) return;

  state.activeNoteId = noteId;
  editorComposing = false;
  clearTimeout(editorSyncTimer);
  els.noteTitle.value = note.title;
  els.noteContent.value = note.content;
  els.noteSchedule.value = toDatetimeLocalValue(note.scheduledAt);
  setStatus('');
  showView('editor');
  renderEditorTags();
}

function openNewNote() {
  const note = createNote();
  state.notesData.notes.unshift(note);
  openEditor(note.id);
  autosave();
  renderNotesList();
}

function backToList() {
  clearTimeout(editorSyncTimer);
  persistLocalChanges();
  saveManager.saveNow(() => state.notesData);
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
    els.appVersion.textContent = `v${getAppBuild()} · 2050`;
  }
}

function applyImportedData(data, message = 'นำเข้าสำเร็จ') {
  state.notesData = data;
  state.tagFilterId = null;
  state.listGroup = NOTE_STATUS.ACTIVE;
  saveNotes(state.notesData);
  autosave();
  renderNotesList();
  setStatus(message);
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
      const incoming = parseNotesImport(reader.result);
      if (!hasAnyNotes(state.notesData)) {
        applyImportedData(incoming);
        return;
      }
      const merge = window.confirm('รวมกับโน้ตที่มีอยู่? (ยกเลิก = แทนที่ทั้งหมด)');
      const data = merge ? mergeNotesData(state.notesData, incoming) : incoming;
      applyImportedData(data);
    } catch {
      window.alert('ไฟล์ไม่ถูกต้อง');
    }
  };
  reader.readAsText(file);
}

function importFromPaste() {
  const text = els.importPaste.value.trim();
  if (!text) {
    window.alert('วาง JSON ก่อน');
    return;
  }
  try {
    const merge = hasAnyNotes(state.notesData);
    const incoming = importFromText(text, state.notesData, { merge: false });
    const data = merge
      ? mergeNotesData(state.notesData, incoming)
      : incoming;
    applyImportedData(data);
    els.importPaste.value = '';
    closeSettings();
  } catch {
    window.alert('JSON ไม่ถูกต้อง');
  }
}

function recoverLocalData() {
  const legacy = recoverLegacyLocalStorage();
  if (!legacy) {
    window.alert('ไม่พบข้อมูลเก่าในเครื่อง');
    return;
  }
  const data = hasAnyNotes(state.notesData)
    ? mergeNotesData(state.notesData, legacy.data)
    : legacy.data;
  applyImportedData(data, `กู้คืนจาก ${legacy.source}`);
  closeSettings();
}

function setListGroup(group) {
  state.listGroup = group;
  state.tagFilterId = null;
  closeContextMenu();
  renderNotesList();
}

async function bootstrapData() {
  setLoading(true, 'กำลังโหลดโน้ต...');
  let data = loadNotes().data;
  const auto = await tryAutoImport(data);
  if (auto.imported) {
    data = auto.data;
    saveNotes(data);
  }
  state.notesData = data;
  state.settings = loadSettings();
  state.tagFilterId = null;
  state.listGroup = NOTE_STATUS.ACTIVE;

  saveManager.configure({ onStatus: (message) => setStatus(message) });

  applyCardDensity();
  renderNotesList();
  showView('list');
  setLoading(false);
  updateAppVersionLabel();
  if (auto.imported) {
    setStatus(auto.source === 'bundled' ? 'นำเข้าข้อมูลเริ่มต้นแล้ว' : 'กู้คืนข้อมูลเดิมแล้ว');
  }
}

async function init() {
  registerServiceWorker();

  startUpdateWatcher({
    getLocalBuild: getAppBuild,
    intervalMs: CONFIG.UPDATE_CHECK_MS,
  });

  els.refreshAppBtn.addEventListener('click', () => {
    forceRefresh();
  });

  els.addNoteBtn.addEventListener('click', openNewNote);
  els.settingsBtn.addEventListener('click', openSettings);
  els.closeSettingsBtn.addEventListener('click', closeSettings);
  els.settingsBackdrop.addEventListener('click', closeSettings);
  els.cardDensitySlider.addEventListener('input', () => {
    state.settings.cardDensity = Number(els.cardDensitySlider.value);
    saveSettings(state.settings);
    applyCardDensity();
  });
  els.importPasteBtn.addEventListener('click', importFromPaste);
  els.recoverLocalBtn.addEventListener('click', recoverLocalData);

  els.groupActiveBtn.addEventListener('click', () => setListGroup(NOTE_STATUS.ACTIVE));
  els.groupDoneBtn.addEventListener('click', () => setListGroup(NOTE_STATUS.DONE));
  els.groupTrashBtn.addEventListener('click', () => setListGroup(NOTE_STATUS.TRASH));

  document.addEventListener('pointerdown', (event) => {
    if (!els.noteContextMenu.hidden && !els.noteContextMenu.contains(event.target)) {
      closeContextMenu();
    }
  });

  els.manageTagsBtn.addEventListener('click', openTagManager);
  els.exportBtn.addEventListener('click', exportBackup);
  els.importBtn.addEventListener('click', () => els.importInput.click());
  els.importInput.addEventListener('change', () => {
    importBackup(els.importInput.files?.[0]);
    els.importInput.value = '';
  });
  els.backBtn.addEventListener('click', backToList);

  els.sortUpdatedBtn.addEventListener('click', () => {
    state.sortMode = 'updated';
    renderNotesList();
  });
  els.sortScheduleBtn.addEventListener('click', () => {
    state.sortMode = 'schedule';
    renderNotesList();
  });

  els.tagAddForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const { data, tag } = addTag(state.notesData, els.newTagInput.value);
    if (tag) commitData(data);
    els.newTagInput.value = '';
    els.newTagInput.focus();
  });
  els.closeTagModalBtn.addEventListener('click', closeTagManager);
  els.tagModal.addEventListener('click', (event) => {
    if (event.target === els.tagModal) closeTagManager();
  });

  els.deleteBtn.addEventListener('click', async () => {
    const note = getActiveNote();
    if (!note || !window.confirm('ย้ายโน้ตไปถังขยะ?')) return;
    state.notesData = updateNoteInData(state.notesData, moveNoteToTrash(note));
    await saveManager.saveNow(state.notesData);
    backToList();
  });

  const handleScheduleChange = () => {
    clearTimeout(editorSyncTimer);
    flushEditorToState();
  };

  bindEditorField(els.noteTitle);
  bindEditorField(els.noteContent);
  els.noteSchedule.addEventListener('change', handleScheduleChange);
  els.clearScheduleBtn.addEventListener('click', () => {
    els.noteSchedule.value = '';
    handleScheduleChange();
  });

  bootstrapData();
}

init();

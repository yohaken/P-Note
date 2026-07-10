import { loadNotes, saveNotes } from './local.js?v=24';
import { registerServiceWorker } from './cache.js?v=24';
import { attachNoteCardInteractions, positionContextMenu } from './context-menu.js?v=24';
import { bindComposableInput } from './text-input.js?v=24';
import { CONFIG } from './config.js?v=24';
import { hasAnyNotes, tryAutoImport } from './import-data.js?v=24';
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
} from './notes.js?v=24';
import {
  fromDatetimeLocalValue,
  getScheduleStatus,
  relativeDayLabel,
  shortDate,
  sortNotesBySchedule,
  toDatetimeLocalValue,
} from './schedule.js?v=24';
import { densityToCssUnit, loadSettings, saveSettings } from './settings.js?v=24';
import { DEFAULT_BAR_LAYOUT, applyBarLayout, initBarDrag } from './bars.js?v=24';
import {
  fetchRemoteNotes,
  getSpaceId,
  pushRemoteNotes,
  setSpaceId,
} from './remote.js?v=24';
import { normalizeNotesData } from './notes.js?v=24';
import { SaveManager } from './sync.js?v=24';
import { forceRefresh, startUpdateWatcher } from './update.js?v=24';
import { getAppBuild } from './version.js?v=24';

const state = {
  notesData: { version: 4, updatedAt: '', tags: [], notes: [] },
  settings: loadSettings(),
  activeNoteId: null,
  tagFilterId: null,
  listGroup: NOTE_STATUS.ACTIVE,
  sortMode: 'updated',
  view: 'list',
  spaceId: null,
  online: false,
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
  appVersion: document.getElementById('app-version'),
  tagFilterBar: document.getElementById('tag-filter-bar'),
  sortBar: document.getElementById('sort-bar'),
  barsTop: document.getElementById('bars-top'),
  barsBottom: document.getElementById('bars-bottom'),
  sortWrap: document.querySelector('.movable-bar[data-bar="sort"]'),
  tagWrap: document.querySelector('.movable-bar[data-bar="tag"]'),
  resetBarsBtn: document.getElementById('reset-bars-btn'),
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
  syncCodeValue: document.getElementById('sync-code-value'),
  syncCodeInput: document.getElementById('sync-code-input'),
  copySyncCodeBtn: document.getElementById('copy-sync-code-btn'),
  applySyncCodeBtn: document.getElementById('apply-sync-code-btn'),
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
  if (message === 'บันทึกแล้ว' || message === 'บันทึกในฐานข้อมูลแล้ว') {
    statusTimer = setTimeout(() => {
      els.syncStatus.textContent = '';
      els.editorSyncStatus.textContent = '';
    }, 2000);
  }
}

function autosave() {
  saveManager.scheduleSave(() => state.notesData);
}

function flushEditorToState() {
  if (state.view !== 'editor' || !state.activeNoteId) return;
  persistLocalChanges();
  autosave();
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
  const hasTags = (state.notesData.tags || []).length > 0;
  if (els.sortWrap) els.sortWrap.hidden = !isActiveGroup;
  if (els.tagWrap) els.tagWrap.hidden = !isActiveGroup || !hasTags;
  els.addNoteBtn.hidden = !isActiveGroup;
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
  const rel = relativeDayLabel(note.scheduledAt);
  const date = shortDate(note.scheduledAt);
  return `<span class="schedule-badge ${status}">📅 ${escapeHtml(rel)} · ${escapeHtml(date)}</span>`;
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
  renderSyncCode();
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
    els.appVersion.textContent = `v${getAppBuild()}`;
  }
}

function persistBarLayout(layout) {
  state.settings.barLayout = layout;
  saveSettings(state.settings);
}

function reapplyBarLayout() {
  applyBarLayout(state.settings.barLayout || DEFAULT_BAR_LAYOUT, els.barsTop, els.barsBottom);
}

function setListGroup(group) {
  state.listGroup = group;
  state.tagFilterId = null;
  closeContextMenu();
  renderNotesList();
}

async function loadSpaceData(spaceId, localData) {
  // Returns { data, online, migrated }
  let remote = null;
  try {
    remote = normalizeNotesData(await fetchRemoteNotes(spaceId));
  } catch {
    remote = null;
  }

  if (!remote) {
    // Offline: fall back to local cache + legacy auto-import.
    const auto = await tryAutoImport(localData);
    return { data: auto.data, online: false, migrated: false, autoSource: auto.imported ? auto.source : null };
  }

  const remoteHas = hasAnyNotes(remote);
  const localHas = hasAnyNotes(localData);

  if (!remoteHas && localHas) {
    // First move of existing on-device notes into the database.
    const merged = normalizeNotesData(localData);
    try {
      await pushRemoteNotes(spaceId, merged);
      return { data: merged, online: true, migrated: true };
    } catch {
      return { data: merged, online: false, migrated: false };
    }
  }

  return { data: remote, online: true, migrated: false };
}

async function bootstrapData() {
  setLoading(true, 'กำลังเชื่อมต่อฐานข้อมูล...');
  state.spaceId = getSpaceId();
  state.settings = loadSettings();
  state.tagFilterId = null;
  state.listGroup = NOTE_STATUS.ACTIVE;

  const localData = loadNotes().data;
  const result = await loadSpaceData(state.spaceId, localData);

  state.notesData = result.data;
  state.online = result.online;
  saveNotes(state.notesData);

  saveManager.configure({
    onStatus: (message) => setStatus(message),
    remotePush: (data) => pushRemoteNotes(state.spaceId, data),
  });

  applyCardDensity();
  reapplyBarLayout();
  renderNotesList();
  showView('list');
  setLoading(false);
  updateAppVersionLabel();

  if (result.migrated) {
    setStatus('ย้ายโน้ตเข้าฐานข้อมูลแล้ว');
  } else if (!result.online) {
    setStatus(result.autoSource ? 'โหมดออฟไลน์ (กู้คืนข้อมูลเดิม)' : 'โหมดออฟไลน์ (เก็บในเครื่อง)');
  } else {
    setStatus('เชื่อมฐานข้อมูลแล้ว');
  }
}

async function applySyncCode(code) {
  let normalized;
  try {
    normalized = setSpaceId(code);
  } catch (error) {
    window.alert(error.message);
    return;
  }
  state.spaceId = normalized;
  setLoading(true, 'กำลังซิงค์...');
  try {
    const remote = normalizeNotesData(await fetchRemoteNotes(normalized));
    state.notesData = remote;
    state.online = true;
    saveNotes(state.notesData);
    setStatus('สลับพื้นที่ซิงค์แล้ว');
  } catch {
    state.online = false;
    setStatus('เชื่อมต่อไม่ได้ — เก็บในเครื่อง');
  }
  state.tagFilterId = null;
  state.listGroup = NOTE_STATUS.ACTIVE;
  renderNotesList();
  renderSyncCode();
  setLoading(false);
  closeSettings();
}

function renderSyncCode() {
  if (els.syncCodeValue) {
    els.syncCodeValue.value = state.spaceId || getSpaceId();
  }
}

// Swipe from the left edge to the right = go back (like modern mobile apps).
function handleBackGesture() {
  if (!els.settingsOverlay.hidden) {
    closeSettings();
    return;
  }
  if (!els.tagModal.hidden) {
    closeTagManager();
    return;
  }
  if (!els.noteContextMenu.hidden) {
    closeContextMenu();
    return;
  }
  if (state.view === 'editor') {
    backToList();
  }
}

function initSwipeBack() {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  document.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) {
        tracking = false;
        return;
      }
      const t = event.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      // Only start from the left edge to avoid hijacking scroll/text selection.
      tracking = startX <= 36;
    },
    { passive: true },
  );

  document.addEventListener(
    'touchend',
    (event) => {
      if (!tracking) return;
      tracking = false;
      const t = event.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dx > 70 && dy < 55) {
        handleBackGesture();
      }
    },
    { passive: true },
  );
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
  els.resetBarsBtn.addEventListener('click', () => {
    state.settings.barLayout = [...DEFAULT_BAR_LAYOUT];
    saveSettings(state.settings);
    reapplyBarLayout();
    renderNotesList();
    setStatus('รีเซ็ตตำแหน่งแถบแล้ว');
  });
  els.copySyncCodeBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(els.syncCodeValue.value);
      setStatus('คัดลอกรหัสแล้ว');
    } catch {
      els.syncCodeValue.select();
    }
  });
  els.applySyncCodeBtn.addEventListener('click', () => {
    const code = els.syncCodeInput.value.trim();
    if (code) applySyncCode(code);
  });

  els.groupActiveBtn.addEventListener('click', () => setListGroup(NOTE_STATUS.ACTIVE));
  els.groupDoneBtn.addEventListener('click', () => setListGroup(NOTE_STATUS.DONE));
  els.groupTrashBtn.addEventListener('click', () => setListGroup(NOTE_STATUS.TRASH));

  document.addEventListener('pointerdown', (event) => {
    if (!els.noteContextMenu.hidden && !els.noteContextMenu.contains(event.target)) {
      closeContextMenu();
    }
  });

  els.manageTagsBtn.addEventListener('click', openTagManager);
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

  bindComposableInput(els.noteTitle, { onCommit: flushEditorToState });
  bindComposableInput(els.noteContent, { onCommit: flushEditorToState });
  els.noteSchedule.addEventListener('change', flushEditorToState);
  els.clearScheduleBtn.addEventListener('click', () => {
    els.noteSchedule.value = '';
    flushEditorToState();
  });

  // Block iOS pinch/gesture zoom so the fixed layout never overflows its edges.
  document.addEventListener('gesturestart', (event) => event.preventDefault());
  document.addEventListener('gesturechange', (event) => event.preventDefault());

  initSwipeBack();
  initBarDrag({
    topZone: els.barsTop,
    bottomZone: els.barsBottom,
    onChange: (layout) => {
      persistBarLayout(layout);
      renderNotesList();
    },
  });
  bootstrapData();
}

init();

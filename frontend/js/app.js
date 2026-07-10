import { loadNotes, saveNotes } from './local.js?v=46';
import { attachNoteCardInteractions, positionContextMenu } from './context-menu.js?v=68';
import { initListSortable } from './sortable.js?v=46';
import { bindComposableInput } from './text-input.js?v=46';
import { CONFIG } from './config.js?v=51';
import { hasAnyNotes, tryAutoImport } from './import-data.js?v=46';
import {
  addTag,
  countNotesByTag,
  countNotesByPriority,
  createNote,
  deleteTag,
  filterNotesByPriority,
  filterNotesByStatus,
  filterNotesByTag,
  formatDate,
  getTagsForNote,
  markNoteActive,
  markNoteDone,
  moveNoteToTrash,
  NOTE_PRIORITY,
  NOTE_STATUS,
  notePriority,
  previewText,
  PRIORITY_OPTIONS,
  priorityLabel,
  purgeNote,
  renameTag,
  restoreNoteFromTrash,
  safeTagColor,
  setTagColor,
  sortNotes,
  sortNotesManual,
  applyManualOrder,
  toggleNoteTag,
  updateNote,
  updateNoteInData,
} from './notes.js?v=61';
import {
  completeOrAdvanceNote,
  countNotesByRecurrence,
  filterNotesByRecurrence,
  fromDatetimeLocalValue,
  getScheduleStatus,
  normalizeRecurrence,
  normalizeRecurrenceFilter,
  recurrenceLabel,
  RECURRENCE_FILTER_OPTIONS,
  RECURRENCE_OPTIONS,
  relativeDayLabel,
  shortDate,
  sortNotesBySchedule,
  toDatetimeLocalValue,
} from './schedule.js?v=64';
import { densityToCssUnit, loadSettings, saveSettings, thicknessStyleVars } from './settings.js?v=66';
import { DEFAULT_BAR_LAYOUT, applyBarLayout, initBarDrag } from './bars.js?v=64';
import {
  fetchRemoteNotes,
  getSpaceId,
  pushRemoteNotes,
  setSpaceId,
} from './remote.js?v=51';
import { normalizeNotesData } from './notes.js?v=61';
import { SaveManager } from './sync.js?v=46';
import { NOTE_APP_VERSION, getAppBuild, formatAppBuiltAt } from './version.js?v=46';

const state = {
  notesData: { version: 4, updatedAt: '', tags: [], notes: [] },
  settings: loadSettings(),
  activeNoteId: null,
  tagFilterId: null,
  priorityFilter: null,
  recurrenceFilter: null,
  listGroup: NOTE_STATUS.ACTIVE,
  sortMode: 'updated',
  view: 'list',
  spaceId: null,
  online: false,
  contextNoteId: null,
  draftNoteId: null,
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
  openDrawerBtn: document.getElementById('group-nav-btn'),
  drawer: document.getElementById('group-drawer'),
  drawerBackdrop: document.getElementById('drawer-backdrop'),
  appVersion: document.getElementById('app-version'),
  appTitle: document.getElementById('app-title'),
  appBuilt: document.getElementById('app-built'),
  tagFilterBar: document.getElementById('tag-filter-bar'),
  priorityFilterBar: document.getElementById('priority-filter-bar'),
  recurrenceFilterBar: document.getElementById('recurrence-filter-bar'),
  editorPriority: document.getElementById('editor-priority'),
  sortBar: document.getElementById('sort-bar'),
  barsTop: document.getElementById('bars-top'),
  barsBottom: document.getElementById('bars-bottom'),
  bottomNav: null,
  healthModeBtn: null,
  groupNavBtn: document.getElementById('group-nav-btn'),
  sortWrap: document.querySelector('.movable-bar[data-bar="sort"]'),
  tagWrap: document.querySelector('.movable-bar[data-bar="tag"]'),
  priorityWrap: document.querySelector('.movable-bar[data-bar="priority"]'),
  recurrenceWrap: document.querySelector('.movable-bar[data-bar="recurrence"]'),
  resetBarsBtn: document.getElementById('reset-bars-btn'),
  sortUpdatedBtn: document.getElementById('sort-updated-btn'),
  sortScheduleBtn: document.getElementById('sort-schedule-btn'),
  sortManualBtn: document.getElementById('sort-manual-btn'),
  groupActiveBtn: document.getElementById('group-active-btn'),
  groupDoneBtn: document.getElementById('group-done-btn'),
  groupTrashBtn: document.getElementById('group-trash-btn'),
  backBtn: document.getElementById('back-btn'),
  deleteBtn: document.getElementById('delete-btn'),
  noteTitle: document.getElementById('note-title'),
  noteContent: document.getElementById('note-content'),
  noteSchedule: document.getElementById('note-schedule'),
  editorRecurrence: document.getElementById('editor-recurrence'),
  clearScheduleBtn: document.getElementById('clear-schedule-btn'),
  editorTags: document.getElementById('editor-tags'),
  syncStatusBtn: null,
  syncStatusTip: null,
  editorSyncStatusBtn: null,
  editorSyncStatusTip: null,
  tagModal: document.getElementById('tag-modal'),
  tagAddForm: document.getElementById('tag-add-form'),
  newTagInput: document.getElementById('new-tag-input'),
  tagManagerList: document.getElementById('tag-manager-list'),
  closeTagModalBtn: document.getElementById('close-tag-modal-btn'),
  settingsOverlay: document.getElementById('settings-overlay'),
  settingsBackdrop: document.getElementById('settings-backdrop'),
  cardDensitySlider: document.getElementById('card-density-slider'),
  themeDarkBtn: document.getElementById('theme-dark-btn'),
  themeLightBtn: document.getElementById('theme-light-btn'),
  thicknessSort: document.getElementById('thickness-sort'),
  thicknessTag: document.getElementById('thickness-tag'),
  thicknessPriority: document.getElementById('thickness-priority'),
  thicknessRecurrence: document.getElementById('thickness-recurrence'),
  syncCodeValue: null,
  syncCodeInput: null,
  copySyncCodeBtn: null,
  applySyncCodeBtn: null,
  gotoCalorieSettingsBtn: document.getElementById('goto-calorie-settings-btn'),
  closeSettingsBtn: document.getElementById('close-settings-btn'),
  noteContextOverlay: document.getElementById('note-context-overlay'),
  noteContextMenu: document.getElementById('note-context-menu'),
  noteConfirmOverlay: document.getElementById('note-confirm-overlay'),
  noteConfirmBody: document.getElementById('note-confirm-body'),
  noteConfirmCancel: document.getElementById('note-confirm-cancel'),
  noteConfirmOk: document.getElementById('note-confirm-ok'),
  loadingOverlay: document.getElementById('loading-overlay'),
};

function showView(view) {
  state.view = view;
  els.listView.hidden = view !== 'list';
  els.editorView.hidden = view !== 'editor';
  const fabStack = document.getElementById('fabStack');
  if (fabStack) fabStack.hidden = view !== 'list';
}

function setLoading(visible, message = 'กำลังโหลด...') {
  els.loadingOverlay.hidden = !visible;
  els.loadingOverlay.querySelector('p').textContent = message;
}

function setStatus(_message, _target = 'both') {
  // Sync status UI removed — keep hook for SaveManager / callers.
}

function autosave() {
  saveManager.scheduleSave(() => state.notesData);
}

function noteIsEmpty(note) {
  return !(note.title || '').trim() && !(note.content || '').trim();
}

function flushEditorToState() {
  if (state.view !== 'editor' || !state.activeNoteId) return;
  persistLocalChanges();
  const note = getActiveNote();
  // A brand-new note is not persisted until it actually has a title/content.
  if (note && state.draftNoteId === note.id) {
    if (noteIsEmpty(note)) return;
    state.draftNoteId = null;
  }
  autosave();
}

function applyCardDensity() {
  const unit = densityToCssUnit(state.settings.cardDensity);
  els.listView.style.setProperty('--card-density', String(unit));
  if (els.cardDensitySlider) {
    els.cardDensitySlider.value = String(state.settings.cardDensity);
  }
}

function applyTheme() {
  const light = state.settings.theme === 'light';
  document.body.classList.toggle('light', light);
  els.themeDarkBtn?.classList.toggle('active', !light);
  els.themeLightBtn?.classList.toggle('active', light);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', light ? '#f2f2f7' : '#000000');
}

function barWrapper(bar) {
  return document.querySelector(`.movable-bar[data-bar="${bar}"]`);
}

function applyBarThickness() {
  const bt = state.settings.barThickness || { sort: 0, tag: 0, priority: 0, recurrence: 0 };
  ['sort', 'tag', 'priority', 'recurrence'].forEach((bar) => {
    const wrap = barWrapper(bar);
    if (!wrap) return;
    const vars = thicknessStyleVars(bt[bar] || 0);
    Object.entries(vars).forEach(([key, value]) => {
      wrap.style.setProperty(key, value);
    });
    const inner = wrap.querySelector(
      '.sort-bar, .tag-filter-bar, .priority-filter-bar, .recurrence-filter-bar',
    );
    if (inner) {
      Object.entries(vars).forEach(([key, value]) => {
        inner.style.setProperty(key, value);
      });
    }
  });
  if (els.thicknessSort) els.thicknessSort.value = String(bt.sort || 0);
  if (els.thicknessTag) els.thicknessTag.value = String(bt.tag || 0);
  if (els.thicknessPriority) els.thicknessPriority.value = String(bt.priority || 0);
  if (els.thicknessRecurrence) els.thicknessRecurrence.value = String(bt.recurrence || 0);
}

function openDrawer() {
  els.drawer.classList.add('open');
  els.drawerBackdrop.classList.add('open');
  els.groupNavBtn?.classList.add('active');
}

function closeDrawer() {
  els.drawer.classList.remove('open');
  els.drawerBackdrop.classList.remove('open');
  els.groupNavBtn?.classList.remove('active');
}

function isDrawerOpen() {
  return els.drawer.classList.contains('open');
}

function toggleDrawer() {
  if (isDrawerOpen()) closeDrawer();
  else openDrawer();
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
    recurrence: normalizeRecurrence(note.recurrence),
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
  notes = filterNotesByPriority(notes, state.priorityFilter);
  notes = filterNotesByRecurrence(notes, state.recurrenceFilter);
  notes = filterNotesByTag(notes, state.tagFilterId);
  if (state.sortMode === 'schedule') return sortNotesBySchedule(notes);
  if (state.sortMode === 'manual') return sortNotesManual(notes);
  return sortNotes(notes);
}

function renderGroupNav() {
  els.groupActiveBtn.classList.toggle('active', state.listGroup === NOTE_STATUS.ACTIVE);
  els.groupDoneBtn.classList.toggle('active', state.listGroup === NOTE_STATUS.DONE);
  els.groupTrashBtn.classList.toggle('active', state.listGroup === NOTE_STATUS.TRASH);

  const isActiveGroup = state.listGroup === NOTE_STATUS.ACTIVE;
  const hasTags = (state.notesData.tags || []).length > 0;
  if (els.sortWrap) els.sortWrap.hidden = !isActiveGroup;
  if (els.priorityWrap) els.priorityWrap.hidden = !isActiveGroup;
  if (els.recurrenceWrap) els.recurrenceWrap.hidden = !isActiveGroup;
  if (els.tagWrap) els.tagWrap.hidden = !isActiveGroup || !hasTags;
  els.addNoteBtn.hidden = !isActiveGroup;

  const groupTitle =
    state.listGroup === NOTE_STATUS.DONE
      ? 'ทำแล้ว'
      : state.listGroup === NOTE_STATUS.TRASH
        ? 'ถังขยะ'
        : 'งาน';
  const build = getAppBuild();
  const name = groupTitle === 'งาน' ? 'P-Note' : `P-Note · ${groupTitle}`;
  if (els.appTitle) {
    els.appTitle.innerHTML = `${escapeHtml(name)} <span class="title-version">${escapeHtml(NOTE_APP_VERSION)} · b${escapeHtml(build)}</span>`;
  }
}

function renderSortBar() {
  els.sortUpdatedBtn.classList.toggle('active', state.sortMode === 'updated');
  els.sortScheduleBtn.classList.toggle('active', state.sortMode === 'schedule');
  els.sortManualBtn.classList.toggle('active', state.sortMode === 'manual');
}

function isManualMode() {
  return state.sortMode === 'manual';
}

function persistFilters() {
  state.settings.tagFilterId = state.tagFilterId || null;
  state.settings.priorityFilter = state.priorityFilter || null;
  state.settings.recurrenceFilter = state.recurrenceFilter || null;
  saveSettings(state.settings);
}

/** Restore last filters from settings; drop stale tag ids. */
function applySavedFilters() {
  const s = state.settings || loadSettings();
  const tags = state.notesData?.tags || [];
  const tagIds = new Set(tags.map((t) => t.id));
  const tagId = s.tagFilterId && tagIds.has(s.tagFilterId) ? s.tagFilterId : null;
  state.tagFilterId = tagId;
  state.priorityFilter = s.priorityFilter || null;
  state.recurrenceFilter = normalizeRecurrenceFilter(s.recurrenceFilter);
  // Keep settings in sync if a deleted tag was dropped
  if (s.tagFilterId && !tagId) {
    state.settings.tagFilterId = null;
    saveSettings(state.settings);
  }
}

function setSortMode(mode) {
  state.sortMode = mode;
  state.settings.sortMode = mode;
  saveSettings(state.settings);
  renderNotesList();
}

function renderPriorityFilterBar() {
  if (state.listGroup !== NOTE_STATUS.ACTIVE || !els.priorityFilterBar) return;

  els.priorityFilterBar.innerHTML = '';

  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = `priority-chip${state.priorityFilter ? '' : ' active'}`;
  allChip.textContent = 'ทั้งหมด';
  allChip.addEventListener('click', () => {
    state.priorityFilter = null;
    persistFilters();
    renderNotesList();
  });
  els.priorityFilterBar.appendChild(allChip);

  PRIORITY_OPTIONS.forEach((opt) => {
    const active = state.priorityFilter === opt.id;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `priority-chip priority-${opt.id}${active ? ' active' : ''}`;
    const count = countNotesByPriority(state.notesData.notes, opt.id);
    chip.textContent = count ? `${opt.short} (${count})` : opt.short;
    chip.addEventListener('click', () => {
      state.priorityFilter = active ? null : opt.id;
      persistFilters();
      renderNotesList();
    });
    els.priorityFilterBar.appendChild(chip);
  });
}

function priorityBadgeHtml(note) {
  const priority = notePriority(note);
  if (priority === NOTE_PRIORITY.NORMAL || state.listGroup !== NOTE_STATUS.ACTIVE) return '';
  return `<span class="priority-badge priority-${priority}">${escapeHtml(priorityLabel(priority, { short: true }))}</span>`;
}

function renderEditorPriority() {
  if (!els.editorPriority) return;
  els.editorPriority.innerHTML = '';
  const note = getActiveNote();
  if (!note) return;

  const current = notePriority(note);
  PRIORITY_OPTIONS.forEach((opt) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `priority-chip priority-${opt.id}${current === opt.id ? ' active' : ''}`;
    chip.textContent = opt.label;
    chip.addEventListener('click', () => setActiveNotePriority(opt.id));
    els.editorPriority.appendChild(chip);
  });
}

function setActiveNotePriority(priority) {
  const note = getActiveNote();
  if (!note) return;
  const updated = updateNote(note, { priority });
  state.notesData = updateNoteInData(state.notesData, updated);
  autosave();
  renderEditorPriority();
}

function renderEditorRecurrence() {
  if (!els.editorRecurrence) return;
  els.editorRecurrence.innerHTML = '';
  const note = getActiveNote();
  if (!note) return;

  const current = normalizeRecurrence(note.recurrence);
  RECURRENCE_OPTIONS.forEach((opt) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `recurrence-chip${current === opt.id ? ' active' : ''}`;
    chip.textContent = opt.label;
    chip.addEventListener('click', () => setActiveNoteRecurrence(opt.id));
    els.editorRecurrence.appendChild(chip);
  });
}

function setActiveNoteRecurrence(recurrence) {
  const note = getActiveNote();
  if (!note) return;
  const nextRecurrence = normalizeRecurrence(recurrence);
  const patch = { recurrence: nextRecurrence };
  // Choosing a repeat without a date → default to now so กำหนดวันที่ is set.
  if (nextRecurrence && !fromDatetimeLocalValue(els.noteSchedule.value) && !note.scheduledAt) {
    const nowLocal = toDatetimeLocalValue(new Date().toISOString());
    els.noteSchedule.value = nowLocal;
    patch.scheduledAt = fromDatetimeLocalValue(nowLocal);
  }
  const updated = updateNote(note, patch);
  state.notesData = updateNoteInData(state.notesData, updated);
  autosave();
  renderEditorRecurrence();
}

function renderRecurrenceFilterBar() {
  if (state.listGroup !== NOTE_STATUS.ACTIVE || !els.recurrenceFilterBar) return;

  els.recurrenceFilterBar.innerHTML = '';
  const groupNotes = notesForCurrentGroup();
  const current = normalizeRecurrenceFilter(state.recurrenceFilter);

  RECURRENCE_FILTER_OPTIONS.forEach((opt) => {
    const active = current === opt.id;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `recurrence-filter-chip${active ? ' active' : ''}`;
    if (opt.id === 'any') {
      const n = countNotesByRecurrence(groupNotes, 'any');
      chip.textContent = n ? `${opt.label} (${n})` : opt.label;
    } else if (opt.id) {
      const n = countNotesByRecurrence(groupNotes, opt.id);
      chip.textContent = n ? `${opt.label} (${n})` : opt.label;
    } else {
      chip.textContent = opt.label;
    }
    chip.addEventListener('click', () => {
      state.recurrenceFilter = active ? null : opt.id;
      persistFilters();
      renderNotesList();
    });
    els.recurrenceFilterBar.appendChild(chip);
  });
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
    persistFilters();
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
      persistFilters();
      renderNotesList();
    });
    els.tagFilterBar.appendChild(chip);
  });
}

function scheduleBadgeHtml(note) {
  if (state.listGroup !== NOTE_STATUS.ACTIVE) return '';
  const recur = recurrenceLabel(note.recurrence, { short: true });
  if (!note.scheduledAt && !recur) return '';
  if (!note.scheduledAt) {
    return `<span class="schedule-badge upcoming">🔁 ${escapeHtml(recur)}</span>`;
  }
  const status = getScheduleStatus(note.scheduledAt);
  const rel = relativeDayLabel(note.scheduledAt);
  const date = shortDate(note.scheduledAt);
  const prefix = recur ? `🔁 ${escapeHtml(recur)} · ` : '📅 ';
  return `<span class="schedule-badge ${status}">${prefix}${escapeHtml(rel)} · ${escapeHtml(date)}</span>`;
}

function emptyMessageForGroup() {
  if (state.listGroup === NOTE_STATUS.DONE) return 'ยังไม่มีโน้ตที่ทำแล้ว';
  if (state.listGroup === NOTE_STATUS.TRASH) return 'ถังขยะว่าง';
  return 'ยังไม่มีโน้ต';
}

function closeContextMenu() {
  if (els.noteContextOverlay) els.noteContextOverlay.hidden = true;
  if (els.noteContextMenu) els.noteContextMenu.hidden = true;
  state.contextNoteId = null;
}

let confirmResolver = null;

function closeConfirm() {
  if (els.noteConfirmOverlay) els.noteConfirmOverlay.hidden = true;
  if (els.noteConfirmOk) {
    els.noteConfirmOk.classList.remove('danger');
    els.noteConfirmOk.textContent = 'ตกลง';
  }
}

/** Centered confirm — same place as the long-press menu. */
function showConfirm(message, { okLabel = 'ตกลง', danger = false } = {}) {
  return new Promise((resolve) => {
    if (confirmResolver) {
      confirmResolver(false);
      confirmResolver = null;
    }
    closeContextMenu();
    if (!els.noteConfirmOverlay || !els.noteConfirmBody) {
      resolve(window.confirm(message));
      return;
    }
    confirmResolver = resolve;
    els.noteConfirmBody.textContent = message;
    if (els.noteConfirmOk) {
      els.noteConfirmOk.textContent = okLabel;
      els.noteConfirmOk.classList.toggle('danger', Boolean(danger));
    }
    els.noteConfirmOverlay.hidden = false;
  });
}

function finishConfirm(ok) {
  const resolve = confirmResolver;
  confirmResolver = null;
  closeConfirm();
  if (resolve) resolve(Boolean(ok));
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

function openContextMenu(noteId) {
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

  if (els.noteContextOverlay) els.noteContextOverlay.hidden = false;
  positionContextMenu(els.noteContextMenu);
}

async function applyNoteAction(noteId, action) {
  const note = getNoteById(noteId);
  if (!note) return;

  let updated = note;
  let advanced = false;
  if (action === 'done') {
    const result = completeOrAdvanceNote(note, markNoteDone);
    updated = result.note;
    advanced = result.advanced;
  } else if (action === 'trash') updated = moveNoteToTrash(note);
  else if (action === 'restore') {
    updated = state.listGroup === NOTE_STATUS.TRASH ? restoreNoteFromTrash(note) : markNoteActive(note);
  } else if (action === 'purge') {
    const ok = await showConfirm('ลบโน้ตนี้ถาวร?', { okLabel: 'ลบถาวร', danger: true });
    if (!ok) return;
    commitData(purgeNote(noteId, state.notesData));
    setStatus('ลบถาวรแล้ว');
    return;
  }

  state.notesData = updateNoteInData(state.notesData, updated);
  autosave();
  renderNotesList();
  const doneMsg = advanced ? 'เลื่อนไปรอบถัดไป' : 'ย้ายไปทำแล้ว';
  setStatus(action === 'done' ? doneMsg : action === 'trash' ? 'ย้ายไปถังขยะ' : 'กู้คืนแล้ว');
}

function cardActionsFor(note) {
  if (state.listGroup === NOTE_STATUS.ACTIVE) {
    return [
      { label: '✓', title: 'ทำแล้ว', action: 'done' },
      { label: '🗑', title: 'ลบ', danger: true, action: 'trash' },
    ];
  }
  if (state.listGroup === NOTE_STATUS.DONE) {
    return [
      { label: '↩', title: 'คืนเป็นงาน', action: 'restore' },
      { label: '🗑', title: 'ลบ', danger: true, action: 'trash' },
    ];
  }
  return [
    { label: '↩', title: 'กู้คืน', action: 'restore' },
    { label: '✕', title: 'ลบถาวร', danger: true, action: 'purge' },
  ];
}

function appendCardActions(item, note) {
  const wrap = document.createElement('div');
  wrap.className = 'card-actions';
  cardActionsFor(note).forEach((a) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `card-action${a.danger ? ' danger' : ''}`;
    btn.textContent = a.label;
    btn.title = a.title;
    btn.setAttribute('aria-label', a.title);
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      applyNoteAction(note.id, a.action);
    });
    wrap.appendChild(btn);
  });
  item.appendChild(wrap);
}

function reorderNotes(orderedIds) {
  state.notesData = applyManualOrder(state.notesData, orderedIds);
  autosave();
}

function applyDockOffset() {
  // Bottom nav is in normal document flow now — no absolute FAB offset needed.
}

function renderNotesList() {
  renderGroupNav();
  renderSortBar();
  renderPriorityFilterBar();
  renderRecurrenceFilterBar();
  renderTagFilterBar();
  applyCardDensity();
  applyDockOffset();

  const notes = sortedFilteredNotes();
  els.notesList.innerHTML = '';

  const manual = isManualMode();
  els.notesList.classList.toggle('manual-sort', manual);

  notes.forEach((note) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'note-card';
    item.dataset.noteId = note.id;
    if (state.listGroup === NOTE_STATUS.DONE) item.classList.add('done-card');
    if (state.listGroup === NOTE_STATUS.TRASH) item.classList.add('trash-card');

    const tags = getTagsForNote(note, state.notesData.tags || []);
    const tagSpans = tags
      .map(
        (tag) =>
          `<span class="tag-chip" style="--tag:${safeTagColor(tag.color)}">${escapeHtml(tag.name)}</span>`,
      )
      .join('');
    const priorityHtml = priorityBadgeHtml(note);
    const scheduleHtml = scheduleBadgeHtml(note);
    const metaHtml = `${priorityHtml}${scheduleHtml}${tagSpans}`;
    const preview = previewText(note);
    const previewHtml = preview
      ? `<p class="card-preview">${escapeHtml(preview)}</p>`
      : '';

    item.innerHTML = `
      ${manual ? '<span class="drag-hint" aria-hidden="true">⠿</span>' : ''}
      <div class="card-top-row">
        <h3 class="card-title">${escapeHtml(note.title || 'ไม่มีหัวข้อ')}</h3>
        ${metaHtml ? `<div class="card-meta-row">${metaHtml}</div>` : ''}
      </div>
      ${previewHtml}
    `;

    if (manual) {
      appendCardActions(item, note);
      // Tap + long-press drag handled by the list-level sortable.
    } else {
      attachNoteCardInteractions(item, {
        noteId: note.id,
        onTap: () => openEditor(note.id),
        onLongPress: () => openContextMenu(note.id),
      });
    }

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
  applyTheme();
  applyBarThickness();
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
    del.addEventListener('click', async () => {
      const ok = await showConfirm(`ลบแท็ก "${tag.name}"?`, { okLabel: 'ลบ', danger: true });
      if (ok) commitData(deleteTag(state.notesData, tag.id));
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
  renderEditorPriority();
  renderEditorRecurrence();
}

function openNewNote() {
  const note = createNote();
  state.notesData.notes.unshift(note);
  state.draftNoteId = note.id;
  openEditor(note.id);
}

function discardDraftIfEmpty() {
  const note = getActiveNote();
  if (note && state.draftNoteId === note.id && noteIsEmpty(note)) {
    state.notesData.notes = state.notesData.notes.filter((n) => n.id !== note.id);
    state.draftNoteId = null;
    return true;
  }
  return false;
}

function backToList() {
  persistLocalChanges();
  if (discardDraftIfEmpty()) {
    setStatus('');
  } else {
    state.draftNoteId = null;
    saveManager.saveNow(() => state.notesData);
  }
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
  const build = getAppBuild();
  const builtLabel = formatAppBuiltAt();
  const verLabel = `${NOTE_APP_VERSION} · b${build}`;
  if (els.appBuilt) {
    els.appBuilt.textContent = builtLabel ? `อัปเดต ${builtLabel}` : '';
  }
  if (els.appTitle && !els.appTitle.querySelector('.title-version')) {
    els.appTitle.innerHTML = `P-Note <span class="title-version">${escapeHtml(verLabel)}</span>`;
  } else if (els.appTitle) {
    const ver = els.appTitle.querySelector('.title-version');
    if (ver) ver.textContent = verLabel;
  }
  const shellVer = document.getElementById('shellNoteVersion');
  if (shellVer) shellVer.textContent = verLabel;
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
  if (group === NOTE_STATUS.ACTIVE) {
    applySavedFilters();
  } else {
    // Other groups ignore list filters; keep saved filters for when we return.
    state.tagFilterId = null;
    state.priorityFilter = null;
    state.recurrenceFilter = null;
  }
  closeContextMenu();
  closeDrawer();
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
  state.listGroup = NOTE_STATUS.ACTIVE;

  const localData = loadNotes().data;
  const result = await loadSpaceData(state.spaceId, localData);

  state.notesData = result.data;
  state.online = result.online;
  state.sortMode = state.settings.sortMode || 'updated';
  applySavedFilters();
  saveNotes(state.notesData);

  saveManager.configure({
    onStatus: (message) => setStatus(message),
    remotePush: (data) => pushRemoteNotes(state.spaceId, data),
  });

  applyTheme();
  applyCardDensity();
  reapplyBarLayout();
  applyBarThickness();
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
  state.listGroup = NOTE_STATUS.ACTIVE;
  applySavedFilters();
  renderNotesList();
  setLoading(false);
  closeSettings();
}

// Editor: swipe left OR right → save & leave editor.
// Overlays/drawer: keep close gestures. Page switching is FAB-only (no list swipe).
function initSwipeBack() {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let mode = null; // 'editor' | 'edge' | 'drawer'

  document.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) {
        tracking = false;
        mode = null;
        return;
      }
      const t = event.touches[0];
      startX = t.clientX;
      startY = t.clientY;

      if (isDrawerOpen()) {
        tracking = true;
        mode = 'drawer';
        return;
      }
      if (
        !els.settingsOverlay.hidden ||
        !els.tagModal.hidden ||
        (els.noteContextOverlay && !els.noteContextOverlay.hidden) ||
        (els.noteConfirmOverlay && !els.noteConfirmOverlay.hidden)
      ) {
        tracking = startX <= 36;
        mode = 'edge';
        return;
      }
      if (state.view === 'editor') {
        const target = event.target;
        if (target && target.closest && target.closest('input[type="datetime-local"], input[type="color"], .topbar, .topbar-actions, #manage-tags-btn, #settings-btn, .btn-mini')) {
          tracking = false;
          mode = null;
          return;
        }
        tracking = true;
        mode = 'editor';
        return;
      }
      tracking = false;
      mode = null;
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
      const absDx = Math.abs(dx);
      const currentMode = mode;
      mode = null;

      if (currentMode === 'drawer') {
        if (dx < -60 && dy < 55) closeDrawer();
        return;
      }
      if (currentMode === 'edge') {
        if (dx > 70 && dy < 55) {
          if (!els.settingsOverlay.hidden) closeSettings();
          else if (!els.tagModal.hidden) closeTagManager();
          else if (els.noteConfirmOverlay && !els.noteConfirmOverlay.hidden) finishConfirm(false);
          else if (els.noteContextOverlay && !els.noteContextOverlay.hidden) closeContextMenu();
          else if (!els.noteContextMenu.hidden) closeContextMenu();
        }
        return;
      }
      if (currentMode === 'editor') {
        // Swipe either direction to leave editor (saves via backToList)
        if (absDx > 64 && absDx > dy * 1.15) {
          backToList();
        }
      }
    },
    { passive: true },
  );
}

async function init() {
  applyTheme();
  // Update polling: js/update-watch.js (shared with Calorie). No SW in this shell.

  els.addNoteBtn.addEventListener('click', openNewNote);
  els.settingsBtn.addEventListener('click', openSettings);
  els.closeSettingsBtn.addEventListener('click', closeSettings);
  els.settingsBackdrop.addEventListener('click', closeSettings);

  els.openDrawerBtn?.addEventListener('click', toggleDrawer);
  els.drawerBackdrop.addEventListener('click', closeDrawer);

  const setTheme = (theme) => {
    state.settings.theme = theme;
    saveSettings(state.settings);
    applyTheme();
  };
  els.themeDarkBtn.addEventListener('click', () => setTheme('dark'));
  els.themeLightBtn.addEventListener('click', () => setTheme('light'));

  els.cardDensitySlider.addEventListener('input', () => {
    state.settings.cardDensity = Number(els.cardDensitySlider.value);
    saveSettings(state.settings);
    applyCardDensity();
  });
  els.thicknessSort.addEventListener('input', () => {
    state.settings.barThickness.sort = Number(els.thicknessSort.value);
    saveSettings(state.settings);
    applyBarThickness();
  });
  els.thicknessTag.addEventListener('input', () => {
    state.settings.barThickness.tag = Number(els.thicknessTag.value);
    saveSettings(state.settings);
    applyBarThickness();
  });
  els.thicknessPriority.addEventListener('input', () => {
    state.settings.barThickness.priority = Number(els.thicknessPriority.value);
    saveSettings(state.settings);
    applyBarThickness();
  });
  if (els.thicknessRecurrence) {
    els.thicknessRecurrence.addEventListener('input', () => {
      if (!state.settings.barThickness) state.settings.barThickness = {};
      state.settings.barThickness.recurrence = Number(els.thicknessRecurrence.value);
      saveSettings(state.settings);
      applyBarThickness();
    });
  }
  els.resetBarsBtn.addEventListener('click', () => {
    state.settings.barLayout = [...DEFAULT_BAR_LAYOUT];
    saveSettings(state.settings);
    reapplyBarLayout();
    renderNotesList();
    setStatus('รีเซ็ตตำแหน่งแถบแล้ว');
  });
  els.gotoCalorieSettingsBtn?.addEventListener('click', () => {
    window.location.href = './index.html#settings';
  });

  els.groupActiveBtn.addEventListener('click', () => setListGroup(NOTE_STATUS.ACTIVE));
  els.groupDoneBtn.addEventListener('click', () => setListGroup(NOTE_STATUS.DONE));
  els.groupTrashBtn.addEventListener('click', () => setListGroup(NOTE_STATUS.TRASH));

  document.addEventListener('pointerdown', (event) => {
    if (
      els.noteContextOverlay &&
      !els.noteContextOverlay.hidden &&
      event.target === els.noteContextOverlay
    ) {
      closeContextMenu();
    }
  });

  if (els.noteConfirmCancel) {
    els.noteConfirmCancel.addEventListener('click', () => finishConfirm(false));
  }
  if (els.noteConfirmOk) {
    els.noteConfirmOk.addEventListener('click', () => finishConfirm(true));
  }
  if (els.noteConfirmOverlay) {
    els.noteConfirmOverlay.addEventListener('click', (event) => {
      if (event.target === els.noteConfirmOverlay) finishConfirm(false);
    });
  }

  els.manageTagsBtn.addEventListener('click', openTagManager);
  els.backBtn.addEventListener('click', backToList);

  els.sortUpdatedBtn.addEventListener('click', () => setSortMode('updated'));
  els.sortScheduleBtn.addEventListener('click', () => setSortMode('schedule'));
  els.sortManualBtn.addEventListener('click', () => setSortMode('manual'));

  initListSortable(els.notesList, {
    isEnabled: isManualMode,
    onTap: (noteId) => openEditor(noteId),
    onReorder: (ids) => reorderNotes(ids),
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
    if (!note) return;
    // Discard an empty new note silently (nothing to trash).
    if (state.draftNoteId === note.id && noteIsEmpty(note)) {
      backToList();
      return;
    }
    const ok = await showConfirm('ย้ายโน้ตไปถังขยะ?', { okLabel: 'ย้ายไปถังขยะ', danger: true });
    if (!ok) return;
    state.notesData = updateNoteInData(state.notesData, moveNoteToTrash(note));
    state.draftNoteId = null;
    await saveManager.saveNow(() => state.notesData);
    backToList();
  });

  bindComposableInput(els.noteTitle, { onCommit: flushEditorToState });
  bindComposableInput(els.noteContent, { onCommit: flushEditorToState });
  els.noteSchedule.addEventListener('change', flushEditorToState);
  els.clearScheduleBtn.addEventListener('click', () => {
    els.noteSchedule.value = '';
    const note = getActiveNote();
    if (note) {
      const updated = updateNote(note, { scheduledAt: null });
      state.notesData = updateNoteInData(state.notesData, updated);
    }
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

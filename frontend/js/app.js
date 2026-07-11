import { loadNotes, saveNotes } from './local.js?v=46';
import { attachNoteCardInteractions, positionContextMenu } from './context-menu.js?v=81';
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
  normalizeAttachments,
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
} from './notes.js?v=88';
import {
  completeOrAdvanceNote,
  countNotesByRecurrence,
  filterNotesByRecurrence,
  fromDatetimeLocalValue,
  getScheduleStatus,
  normalizeRecurrence,
  normalizeRecurrenceFilter,
  normalizeRemindBefore,
  normalizeNotifyRepeat,
  remindBeforeLabel,
  notifyRepeatLabel,
  recurrenceLabel,
  RECURRENCE_FILTER_OPTIONS,
  RECURRENCE_OPTIONS,
  relativeDayLabel,
  shortDate,
  sortNotesBySchedule,
  toDatetimeLocalValue,
} from './schedule.js?v=88';
import { densityToCssUnit, loadSettings, normalizeNotifyPrefs, normalizeGeminiModel, saveSettings, thicknessStyleVars } from './settings.js?v=88';
import {
  notificationPermission,
  notificationSupported,
  registerNotifyServiceWorker,
  requestNotificationPermission,
  sendTestNotification,
  syncNoteNotifications,
} from './note-notify.js?v=88';
import { summarizeToNoteDraft, listGeminiModels, FALLBACK_GEMINI_MODELS, ensureLeadingEmoji, prepareAiMedia } from './gemini.js?v=88';
import {
  refreshUserContext,
  loadUserContextMd,
  refineDraftWithContext,
} from './user-context.js?v=88';
import { DEFAULT_BAR_LAYOUT } from './bars.js?v=64';
import {
  fetchRemoteNotes,
  getSpaceId,
  pushRemoteNotes,
  setSpaceId,
} from './remote.js?v=51';
import { normalizeNotesData } from './notes.js?v=88';
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
  tagReorderMode: false,
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
  aiNoteModal: document.getElementById('ai-note-modal'),
  aiNoteSource: document.getElementById('ai-note-source'),
  aiNoteDraftTitle: document.getElementById('ai-note-draft-title'),
  aiNoteDraftSummary: document.getElementById('ai-note-draft-summary'),
  aiNoteDraftSchedule: document.getElementById('ai-note-draft-schedule'),
  aiNoteDraftPriority: document.getElementById('ai-note-draft-priority'),
  aiNoteDraftRecurrence: document.getElementById('ai-note-draft-recurrence'),
  aiNoteTagChips: document.getElementById('ai-note-tag-chips'),
  aiNoteCameraBtn: document.getElementById('ai-note-camera-btn'),
  aiNoteCamera: document.getElementById('ai-note-camera'),
  aiNoteFileBtn: document.getElementById('ai-note-file-btn'),
  aiNoteFile: document.getElementById('ai-note-file'),
  aiNoteAttachList: document.getElementById('ai-note-attach-list'),
  noteAttachments: document.getElementById('note-attachments'),
  aiNoteStatus: document.getElementById('ai-note-status'),
  aiNoteCancelBtn: document.getElementById('ai-note-cancel-btn'),
  aiNoteSummarizeBtn: document.getElementById('ai-note-summarize-btn'),
  aiNoteConfirmBtn: document.getElementById('ai-note-confirm-btn'),
  geminiApiKey: document.getElementById('gemini-api-key'),
  geminiModel: document.getElementById('gemini-model'),
  geminiLoadModelsBtn: document.getElementById('gemini-load-models-btn'),
  geminiModelHint: document.getElementById('gemini-model-hint'),
  aiContextRefreshBtn: document.getElementById('ai-context-refresh-btn'),
  aiContextPreview: document.getElementById('ai-context-preview'),
  settingsBtn: document.getElementById('settings-btn'),
  manageTagsBtn: document.getElementById('manage-tags-btn'),
  openDrawerBtn: document.getElementById('group-nav-btn'),
  drawer: document.getElementById('group-drawer'),
  drawerBackdrop: document.getElementById('drawer-backdrop'),
  appVersion: document.getElementById('app-version'),
  appTitle: document.getElementById('app-title'),
  appBuilt: document.getElementById('app-built'),
  tagFilterBar: null,
  priorityFilterBar: null,
  recurrenceFilterBar: null,
  editorPriority: document.getElementById('editor-priority'),
  sortBar: null,
  barsTop: null,
  barsBottom: null,
  filterDock: document.getElementById('filter-dock'),
  filterDockFilters: document.querySelector('.filter-dock-filters'),
  filterSortBtn: document.getElementById('filter-sort-btn'),
  filterSortMenu: document.getElementById('filter-sort-menu'),
  filterPriorityBtn: document.getElementById('filter-priority-btn'),
  filterPriorityMenu: document.getElementById('filter-priority-menu'),
  filterRecurrenceBtn: document.getElementById('filter-recurrence-btn'),
  filterRecurrenceMenu: document.getElementById('filter-recurrence-menu'),
  filterTagBtn: document.getElementById('filter-tag-btn'),
  filterTagMenu: document.getElementById('filter-tag-menu'),
  filterDdBackdrop: document.getElementById('filter-dd-backdrop'),
  dockAiBtn: document.getElementById('dock-ai-btn'),
  bottomNav: null,
  healthModeBtn: null,
  groupNavBtn: document.getElementById('group-nav-btn'),
  sortWrap: null,
  tagWrap: null,
  priorityWrap: null,
  recurrenceWrap: null,
  resetBarsBtn: document.getElementById('reset-bars-btn'),
  sortUpdatedBtn: null,
  sortScheduleBtn: null,
  sortManualBtn: null,
  groupActiveBtn: document.getElementById('group-active-btn'),
  groupDoneBtn: document.getElementById('group-done-btn'),
  groupTrashBtn: document.getElementById('group-trash-btn'),
  backBtn: document.getElementById('back-btn'),
  deleteBtn: document.getElementById('delete-btn'),
  noteTitle: document.getElementById('note-title'),
  noteContent: document.getElementById('note-content'),
  noteSchedule: document.getElementById('note-schedule'),
  noteRemindBefore: document.getElementById('note-remind-before'),
  noteNotifyRepeat: document.getElementById('note-notify-repeat'),
  noteNotifyPreview: document.getElementById('note-notify-preview'),
  noteNotifyDetails: document.getElementById('note-notify-details'),
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
  fabDirVerticalBtn: document.getElementById('fab-dir-vertical-btn'),
  fabDirHorizontalBtn: document.getElementById('fab-dir-horizontal-btn'),
  notifyOffBtn: document.getElementById('notify-off-btn'),
  notifyOnBtn: document.getElementById('notify-on-btn'),
  notifyHint: document.getElementById('notify-hint'),
  notifyOptions: document.getElementById('notify-options'),
  notifyLabel: document.getElementById('notify-label'),
  notifyEarly: document.getElementById('notify-early'),
  notifyMinPriority: document.getElementById('notify-min-priority'),
  notifyTagChips: document.getElementById('notify-tag-chips'),
  notifyTestBtn: document.getElementById('notify-test-btn'),
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
  updateFilterDockVisibility();
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
  refreshNoteNotifications();
  scheduleUserContextRefresh();
}

let userContextTimer = null;
function scheduleUserContextRefresh() {
  if (userContextTimer) clearTimeout(userContextTimer);
  userContextTimer = setTimeout(() => {
    try {
      refreshUserContext(state.notesData);
    } catch (err) {
      console.warn('user context refresh failed', err);
    }
  }, 900);
}

function fillAiContextPreview() {
  if (!els.aiContextPreview) return;
  const md = loadUserContextMd() || refreshUserContext(state.notesData).md;
  els.aiContextPreview.textContent = md || '(ยังไม่มีความจำ)';
}

function noteIsEmpty(note) {
  return (
    !(note.title || '').trim() &&
    !(note.content || '').trim() &&
    !(Array.isArray(note.attachments) && note.attachments.length)
  );
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

function applyFabDirection() {
  const dir =
    typeof window.FabDrag?.getDirection === 'function'
      ? window.FabDrag.getDirection()
      : 'vertical';
  const horizontal = dir === 'horizontal';
  els.fabDirVerticalBtn?.classList.toggle('active', !horizontal);
  els.fabDirHorizontalBtn?.classList.toggle('active', horizontal);
}

function getNotifyPrefs() {
  return normalizeNotifyPrefs(
    state.settings.notifyPrefs,
    state.settings.notificationsEnabled,
  );
}

function persistNotifyPrefs(patch = {}) {
  const next = normalizeNotifyPrefs(
    { ...getNotifyPrefs(), ...patch },
    state.settings.notificationsEnabled,
  );
  state.settings.notifyPrefs = next;
  state.settings.notificationsEnabled = next.enabled;
  saveSettings(state.settings);
  applyNotifySettingsUi();
  refreshNoteNotifications();
}

function refreshNoteNotifications() {
  const active = filterNotesByStatus(state.notesData.notes || [], NOTE_STATUS.ACTIVE);
  syncNoteNotifications(active, getNotifyPrefs());
}

function renderNotifyTagChips() {
  if (!els.notifyTagChips) return;
  const prefs = getNotifyPrefs();
  const selected = new Set(prefs.tagIds || []);
  const tags = orderedFilterTags();
  els.notifyTagChips.innerHTML = '';
  if (!tags.length) {
    const empty = document.createElement('span');
    empty.className = 'settings-hint';
    empty.style.margin = '0';
    empty.textContent = 'ยังไม่มีแท็ก';
    els.notifyTagChips.appendChild(empty);
    return;
  }
  tags.forEach((tag) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `notify-tag-chip${selected.has(tag.id) ? ' active' : ''}`;
    btn.style.setProperty('--tag', safeTagColor(tag.color));
    btn.textContent = tag.name;
    btn.addEventListener('click', () => {
      const cur = new Set(getNotifyPrefs().tagIds || []);
      if (cur.has(tag.id)) cur.delete(tag.id);
      else cur.add(tag.id);
      persistNotifyPrefs({ tagIds: [...cur] });
    });
    els.notifyTagChips.appendChild(btn);
  });
}

function applyNotifySettingsUi() {
  const prefs = getNotifyPrefs();
  const on = Boolean(prefs.enabled);
  els.notifyOffBtn?.classList.toggle('active', !on);
  els.notifyOnBtn?.classList.toggle('active', on);
  if (els.notifyOptions) els.notifyOptions.hidden = !on;

  if (els.notifyLabel && document.activeElement !== els.notifyLabel) {
    els.notifyLabel.value = prefs.label || 'P-Note';
  }
  if (els.notifyEarly) els.notifyEarly.value = String(prefs.earlyMinutes || 0);
  if (els.notifyMinPriority) els.notifyMinPriority.value = prefs.minPriority || 'normal';

  document.querySelectorAll('[data-notify-sound]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.notifySound === (prefs.sound ? '1' : '0'));
  });
  document.querySelectorAll('[data-notify-vibrate]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.notifyVibrate === (prefs.vibrate ? '1' : '0'));
  });
  document.querySelectorAll('[data-notify-preview]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.notifyPreview === prefs.preview);
  });
  document.querySelectorAll('[data-notify-persistent]').forEach((btn) => {
    btn.classList.toggle(
      'active',
      btn.dataset.notifyPersistent === (prefs.persistent ? '1' : '0'),
    );
  });

  renderNotifyTagChips();

  if (!els.notifyHint) return;
  if (!notificationSupported()) {
    els.notifyHint.textContent = 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนระบบ';
    return;
  }
  const perm = notificationPermission();
  if (on && perm === 'granted') {
    els.notifyHint.textContent = 'เปิดแล้ว · ปรับรายละเอียดด้านล่างได้ตามมาตรฐานการแจ้งเตือน';
  } else if (on && perm === 'denied') {
    els.notifyHint.textContent = 'ระบบบล็อกการแจ้งเตือน — เปิดสิทธิ์ในตั้งค่าเครื่อง/เบราว์เซอร์';
  } else if (on) {
    els.notifyHint.textContent = 'รออนุญาตการแจ้งเตือนจากเครื่อง…';
  } else {
    els.notifyHint.textContent =
      'โน้ตที่มีกำหนดเวลาจะเด้งแจ้งเตือนระบบ · แนะนำติดตั้ง P-Note บนหน้าจอโฮม';
  }
}

async function setNotificationsEnabled(enabled) {
  if (enabled) {
    if (!notificationSupported()) {
      setStatus('เครื่องนี้ไม่รองรับการแจ้งเตือน');
      applyNotifySettingsUi();
      return;
    }
    await registerNotifyServiceWorker();
    const perm = await requestNotificationPermission();
    if (perm !== 'granted') {
      persistNotifyPrefs({ enabled: false });
      setStatus(perm === 'denied' ? 'ไม่ได้รับอนุญาตแจ้งเตือน' : 'ยังไม่ได้เปิดแจ้งเตือน');
      return;
    }
  }
  persistNotifyPrefs({ enabled: Boolean(enabled) });
  setStatus(enabled ? 'เปิดแจ้งเตือนเครื่องแล้ว' : 'ปิดแจ้งเตือนเครื่องแล้ว');
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
    remindBefore: normalizeRemindBefore(els.noteRemindBefore?.value),
    notifyRepeat: normalizeNotifyRepeat(els.noteNotifyRepeat?.value),
  });

  state.notesData = updateNoteInData(state.notesData, updated);
  updateNotifyDetailsPreview();
}

function updateNotifyDetailsPreview() {
  if (!els.noteNotifyPreview) return;
  const hasSchedule = Boolean(els.noteSchedule?.value);
  const remind = normalizeRemindBefore(els.noteRemindBefore?.value);
  const repeat = normalizeNotifyRepeat(els.noteNotifyRepeat?.value);
  if (!hasSchedule) {
    els.noteNotifyPreview.textContent = 'ตั้งวันที่ก่อน';
    return;
  }
  const parts = [];
  parts.push(remindBeforeLabel(remind));
  if (repeat !== 'none') parts.push(notifyRepeatLabel(repeat));
  else parts.push('ครั้งเดียว');
  els.noteNotifyPreview.textContent = parts.join(' · ');
}

function commitData(newData) {
  state.notesData = newData;
  autosave();
  renderNotesList();
  renderEditorTags();
  renderTagManager();
  refreshNoteNotifications();
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
  if (els.addNoteBtn) els.addNoteBtn.hidden = !isActiveGroup;
  if (els.dockAiBtn) els.dockAiBtn.hidden = !isActiveGroup;
  updateFilterDockVisibility();

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

const SORT_FILTER_OPTIONS = [
  { id: 'updated', label: 'ล่าสุด', button: '📅 ล่าสุด' },
  { id: 'schedule', label: 'ตามกำหนด', button: '📅 ตามกำหนด' },
  { id: 'manual', label: 'อิสระ', button: '📅 อิสระ' },
];

function updateFilterDockVisibility() {
  if (!els.filterDock) return;
  const show = state.view === 'list' && state.listGroup === NOTE_STATUS.ACTIVE;
  els.filterDock.hidden = !show;
  if (!show) closeFilterMenus();
  applyDockOffset();
}

function closeFilterMenus() {
  ['filterSortMenu', 'filterPriorityMenu', 'filterRecurrenceMenu', 'filterTagMenu'].forEach((key) => {
    const menu = els[key];
    if (menu) menu.hidden = true;
  });
  ['filterSortBtn', 'filterPriorityBtn', 'filterRecurrenceBtn', 'filterTagBtn'].forEach((key) => {
    const btn = els[key];
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
  if (els.filterDdBackdrop) els.filterDdBackdrop.hidden = true;
}

function positionFilterMenu(menuEl, btnEl) {
  if (!menuEl || !btnEl) return;
  const rect = btnEl.getBoundingClientRect();
  const gap = 8;
  const vw = window.innerWidth || document.documentElement.clientWidth || 320;
  const alignEnd = menuEl.classList.contains('filter-dd-menu-end');

  menuEl.style.left = '0px';
  menuEl.style.right = 'auto';
  menuEl.style.top = '0px';
  menuEl.style.bottom = 'auto';
  menuEl.hidden = false;

  const menuRect = menuEl.getBoundingClientRect();
  let left = alignEnd ? rect.right - menuRect.width : rect.left;
  left = Math.max(8, Math.min(left, vw - menuRect.width - 8));
  const bottom = Math.max(8, window.innerHeight - rect.top + gap);

  menuEl.style.left = `${Math.round(left)}px`;
  menuEl.style.bottom = `${Math.round(bottom)}px`;
  menuEl.style.top = 'auto';
}

function openFilterMenu(menuEl, btnEl) {
  const wasOpen = menuEl && !menuEl.hidden;
  closeFilterMenus();
  if (!menuEl || !btnEl || wasOpen) return;
  btnEl.setAttribute('aria-expanded', 'true');
  if (els.filterDdBackdrop) els.filterDdBackdrop.hidden = false;
  positionFilterMenu(menuEl, btnEl);
}

function fillFilterMenu(menuEl, items) {
  if (!menuEl) return;
  menuEl.innerHTML = '';
  items.forEach((item) => {
    if (item.sep) {
      const sep = document.createElement('div');
      sep.className = 'filter-dd-sep';
      sep.setAttribute('role', 'separator');
      menuEl.appendChild(sep);
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `filter-dd-item${item.selected ? ' is-selected' : ''}`;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', item.selected ? 'true' : 'false');
    const label = document.createElement('span');
    label.textContent = item.label;
    btn.appendChild(label);
    if (item.selected) {
      const check = document.createElement('span');
      check.className = 'filter-dd-item-check';
      check.textContent = '✓';
      btn.appendChild(check);
    }
    btn.addEventListener('click', () => {
      closeFilterMenus();
      item.onSelect?.();
    });
    menuEl.appendChild(btn);
  });
}

function renderSortBar() {
  const opt = SORT_FILTER_OPTIONS.find((o) => o.id === state.sortMode) || SORT_FILTER_OPTIONS[0];
  if (els.filterSortBtn) {
    els.filterSortBtn.textContent = opt.button;
    els.filterSortBtn.classList.toggle('is-active', state.sortMode !== 'updated');
    els.filterSortBtn.title = `กำหนดเวลา · ${opt.label}`;
  }
  fillFilterMenu(
    els.filterSortMenu,
    SORT_FILTER_OPTIONS.map((o) => ({
      label: o.label,
      selected: state.sortMode === o.id,
      onSelect: () => setSortMode(o.id),
    })),
  );
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
  const current = state.priorityFilter || null;
  const opt = PRIORITY_OPTIONS.find((o) => o.id === current);
  if (els.filterPriorityBtn) {
    els.filterPriorityBtn.textContent = opt ? `⚠️ ${opt.short}` : '⚠️ ความสำคัญ';
    els.filterPriorityBtn.classList.toggle('is-active', Boolean(current));
    els.filterPriorityBtn.title = opt ? `ความสำคัญ · ${opt.label}` : 'ความสำคัญ';
  }
  const items = [
    {
      label: 'ทั้งหมด',
      selected: !current,
      onSelect: () => {
        state.priorityFilter = null;
        persistFilters();
        renderNotesList();
      },
    },
    ...PRIORITY_OPTIONS.map((o) => ({
      label: o.label,
      selected: current === o.id,
      onSelect: () => {
        state.priorityFilter = o.id;
        persistFilters();
        renderNotesList();
      },
    })),
  ];
  fillFilterMenu(els.filterPriorityMenu, items);
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
  const current = normalizeRecurrenceFilter(state.recurrenceFilter);
  const opt = RECURRENCE_FILTER_OPTIONS.find((o) => o.id === current);
  const isFiltered = Boolean(current);
  if (els.filterRecurrenceBtn) {
    els.filterRecurrenceBtn.textContent = isFiltered && opt ? `🔁 ${opt.label}` : '🔁 การซ้ำ';
    els.filterRecurrenceBtn.classList.toggle('is-active', isFiltered);
    els.filterRecurrenceBtn.title = isFiltered && opt ? `การซ้ำ · ${opt.label}` : 'การซ้ำ';
  }
  const groupNotes = notesForCurrentGroup();
  fillFilterMenu(
    els.filterRecurrenceMenu,
    RECURRENCE_FILTER_OPTIONS.map((o) => {
      let label = o.label;
      if (o.id) {
        const n = countNotesByRecurrence(groupNotes, o.id);
        if (n) label = `${o.label} (${n})`;
      }
      return {
        label,
        selected: current === o.id,
        onSelect: () => {
          state.recurrenceFilter = o.id;
          persistFilters();
          renderNotesList();
        },
      };
    }),
  );
}

/** Tags in saved filter-bar order (unknown ids appended). */
function orderedFilterTags() {
  const tags = state.notesData.tags || [];
  const order = Array.isArray(state.settings.tagOrder) ? state.settings.tagOrder : [];
  if (!order.length) return tags.slice();
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  const out = [];
  order.forEach((id) => {
    if (byId.has(id)) {
      out.push(byId.get(id));
      byId.delete(id);
    }
  });
  byId.forEach((tag) => out.push(tag));
  return out;
}

function persistTagOrder(ids) {
  state.settings.tagOrder = ids.slice();
  saveSettings(state.settings);
}

function closeTagBarMenu() {
  closeContextMenu();
}

function enableTagReorderMode() {
  state.tagReorderMode = true;
  setStatus('จัดลำดับแท็กได้ในหน้าจัดการแท็ก');
  openTagManager();
  state.tagReorderMode = false;
}

function disableTagReorderMode() {
  if (!state.tagReorderMode) return;
  state.tagReorderMode = false;
}

function openTagBarMenu(tagId) {
  const tag = tagId ? (state.notesData.tags || []).find((t) => t.id === tagId) : null;
  const items = [];

  items.push({
    id: 'add',
    label: 'เพิ่มแท็ก',
    action: () => openTagManager(),
  });

  if (tag) {
    items.push({
      id: 'delete',
      label: `ลบแท็ก “${tag.name}”`,
      danger: true,
      action: async () => {
        const ok = await showConfirm(`ลบแท็ก "${tag.name}"?`, { okLabel: 'ลบ', danger: true });
        if (!ok) return;
        if (state.tagFilterId === tag.id) {
          state.tagFilterId = null;
          persistFilters();
        }
        commitData(deleteTag(state.notesData, tag.id));
        setStatus('ลบแท็กแล้ว');
      },
    });
  }

  items.push({
    id: 'manage',
    label: 'จัดการแท็กทั้งหมด',
    action: () => openTagManager(),
  });

  state.contextNoteId = null;
  els.noteContextMenu.innerHTML = '';
  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `context-menu-item${item.danger ? ' danger' : ''}`;
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      closeTagBarMenu();
      item.action();
    });
    els.noteContextMenu.appendChild(btn);
  });

  if (els.noteContextOverlay) els.noteContextOverlay.hidden = false;
  positionContextMenu(els.noteContextMenu);
}

function renderTagFilterBar() {
  const tags = orderedFilterTags();
  const currentId = state.tagFilterId || null;
  const currentTag = currentId ? tags.find((t) => t.id === currentId) : null;
  if (els.filterTagBtn) {
    els.filterTagBtn.textContent = currentTag ? `🏷️ ${currentTag.name}` : '🏷️ แท็ก';
    els.filterTagBtn.classList.toggle('is-active', Boolean(currentTag));
    els.filterTagBtn.title = currentTag ? `แท็ก · ${currentTag.name}` : 'แท็ก';
  }

  const items = [
    {
      label: 'ทั้งหมด',
      selected: !currentId,
      onSelect: () => {
        state.tagFilterId = null;
        persistFilters();
        renderNotesList();
      },
    },
    ...tags.map((tag) => {
      const n = countNotesByTag(state.notesData.notes, tag.id);
      return {
        label: n ? `${tag.name} (${n})` : tag.name,
        selected: currentId === tag.id,
        onSelect: () => {
          state.tagFilterId = tag.id;
          persistFilters();
          renderNotesList();
        },
      };
    }),
    { sep: true },
    {
      label: 'จัดการแท็ก…',
      selected: false,
      onSelect: () => openTagManager(),
    },
  ];
  fillFilterMenu(els.filterTagMenu, items);
}

function initFilterDock() {
  const bindings = [
    [els.filterSortBtn, els.filterSortMenu],
    [els.filterPriorityBtn, els.filterPriorityMenu],
    [els.filterRecurrenceBtn, els.filterRecurrenceMenu],
    [els.filterTagBtn, els.filterTagMenu],
  ];
  bindings.forEach(([btn, menu]) => {
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      openFilterMenu(menu, btn);
    });
  });
  els.filterDdBackdrop?.addEventListener('click', closeFilterMenus);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFilterMenus();
  });
  els.dockAiBtn?.addEventListener('click', () => {
    openAddNoteModal();
    queueMicrotask(() => els.aiNoteSource?.focus());
  });
}

/**
 * Long-press: menu (no move) or drag-reorder (move, tag chips only).
 * @param {HTMLElement} chip
 * @param {string|null} tagId null = "ทั้งหมด"
 */
function bindTagChipGestures(chip, tagId) {
  const LONG_MS = 420;
  const MOVE_PX = 10;
  let timer = null;
  let armed = false;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let pointerId = null;
  let suppressClick = false;

  const clearTimer = () => {
    clearTimeout(timer);
    timer = null;
  };

  chip.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    armed = false;
    dragging = false;
    suppressClick = false;
    startX = e.clientX;
    startY = e.clientY;
    pointerId = e.pointerId;
    clearTimer();
    // In reorder mode, tag chips arm immediately for drag
    const armDelay = state.tagReorderMode && tagId ? 0 : LONG_MS;
    timer = setTimeout(() => {
      armed = true;
      chip.classList.add('is-tag-drag-armed');
      if (armDelay > 0) {
        try {
          if (navigator.vibrate) navigator.vibrate(10);
        } catch (_) {}
      }
    }, armDelay);
  });

  chip.addEventListener('pointermove', (e) => {
    if (pointerId == null || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!armed && !dragging) {
      if (Math.hypot(dx, dy) > MOVE_PX) clearTimer();
      return;
    }
    // Only tag chips (not ทั้งหมด) can drag-reorder
    if (armed && !dragging && tagId && Math.abs(dx) > MOVE_PX) {
      dragging = true;
      suppressClick = true;
      chip.classList.add('is-tag-dragging');
      chip.classList.remove('is-tag-drag-armed');
      try {
        chip.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    if (!dragging || !els.tagFilterBar) return;
    e.preventDefault();
    const x = e.clientX;
    const chips = [...els.tagFilterBar.querySelectorAll('.tag-filter-chip[data-tag-id]')];
    let beforeId = null;
    for (const other of chips) {
      if (other === chip) continue;
      const r = other.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      if (x < mid) {
        beforeId = other.dataset.tagId;
        break;
      }
    }
    const currentBefore = chip.nextElementSibling?.dataset?.tagId || null;
    if (beforeId !== currentBefore) {
      if (beforeId) {
        const target = els.tagFilterBar.querySelector(`[data-tag-id="${beforeId}"]`);
        if (target) els.tagFilterBar.insertBefore(chip, target);
      } else {
        els.tagFilterBar.appendChild(chip);
      }
    }
  });

  const end = (e) => {
    if (pointerId == null || (e && e.pointerId != null && e.pointerId !== pointerId)) return;
    const wasArmed = armed;
    const wasDragging = dragging;
    clearTimer();
    chip.classList.remove('is-tag-drag-armed', 'is-tag-dragging');
    if (wasDragging) {
      const ids = [...els.tagFilterBar.querySelectorAll('.tag-filter-chip[data-tag-id]')].map(
        (el) => el.dataset.tagId,
      );
      persistTagOrder(ids);
      renderTagManager();
      suppressClick = true;
    } else if (wasArmed) {
      // Long-press without drag → config menu (skip while actively reordering a tag chip)
      if (!(state.tagReorderMode && tagId)) {
        suppressClick = true;
        openTagBarMenu(tagId);
      }
    }
    pointerId = null;
    armed = false;
    dragging = false;
    if (suppressClick) {
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
  };

  chip.addEventListener('pointerup', end);
  chip.addEventListener('pointercancel', end);
  chip.addEventListener(
    'click',
    (e) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );
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
  const dock = els.filterDock;
  if (!dock || dock.hidden) {
    document.documentElement.style.setProperty('--filters-dock-h', '0px');
    return;
  }
  const h = Math.ceil(dock.getBoundingClientRect().height || dock.offsetHeight || 0);
  document.documentElement.style.setProperty('--filters-dock-h', `${h}px`);
}

let filtersDockObserver = null;
function ensureFiltersDockObserver() {
  if (filtersDockObserver || !els.filterDock || typeof ResizeObserver === 'undefined') return;
  filtersDockObserver = new ResizeObserver(() => applyDockOffset());
  filtersDockObserver.observe(els.filterDock);
}

function renderNotesList() {
  renderGroupNav();
  renderSortBar();
  renderPriorityFilterBar();
  renderRecurrenceFilterBar();
  renderTagFilterBar();
  applyCardDensity();
  ensureFiltersDockObserver();
  applyDockOffset();
  requestAnimationFrame(applyDockOffset);

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

  orderedFilterTags().forEach((tag) => {
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
  if (els.geminiApiKey) els.geminiApiKey.value = state.settings.geminiApiKey || '';
  fillGeminiModelSelect(state.settings.geminiModel);
  fillAiContextPreview();
  applyTheme();
  applyFabDirection();
  applyNotifySettingsUi();
  applyBarThickness();
}

function closeSettings() {
  persistGeminiSettingsFromUi();
  els.settingsOverlay.hidden = true;
}

function persistGeminiSettingsFromUi() {
  if (!els.geminiApiKey && !els.geminiModel) return;
  const key = String(els.geminiApiKey?.value || '').trim().slice(0, 200);
  const model = normalizeGeminiModel(els.geminiModel?.value);
  if (key === (state.settings.geminiApiKey || '') && model === state.settings.geminiModel) return;
  state.settings.geminiApiKey = key;
  state.settings.geminiModel = model;
  saveSettings(state.settings);
}

/** @type {Array<{ id: string, label: string }>|null} */
let geminiModelsCache = null;

function fillGeminiModelSelect(selectedId) {
  const sel = els.geminiModel;
  if (!sel) return;
  const wanted = normalizeGeminiModel(selectedId || state.settings.geminiModel);
  const list =
    geminiModelsCache && geminiModelsCache.length
      ? geminiModelsCache
      : FALLBACK_GEMINI_MODELS;
  sel.innerHTML = '';
  let hasWanted = false;
  list.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label || m.id;
    if (m.id === wanted) {
      opt.selected = true;
      hasWanted = true;
    }
    sel.appendChild(opt);
  });
  if (!hasWanted && wanted) {
    const opt = document.createElement('option');
    opt.value = wanted;
    opt.textContent = wanted;
    opt.selected = true;
    sel.appendChild(opt);
  }
}

async function loadGeminiModelsFromApi() {
  persistGeminiSettingsFromUi();
  const key = String(state.settings.geminiApiKey || els.geminiApiKey?.value || '').trim();
  if (!key) {
    if (els.geminiModelHint) els.geminiModelHint.textContent = 'ใส่ API key ก่อน แล้วกดโหลดโมเดล';
    setStatus('ใส่ Gemini API key ก่อน');
    els.geminiApiKey?.focus();
    return;
  }
  if (els.geminiLoadModelsBtn) els.geminiLoadModelsBtn.disabled = true;
  if (els.geminiModelHint) els.geminiModelHint.textContent = 'กำลังโหลดโมเดลจาก API…';
  try {
    const models = await listGeminiModels(key);
    if (!models.length) {
      geminiModelsCache = null;
      fillGeminiModelSelect(state.settings.geminiModel);
      if (els.geminiModelHint) els.geminiModelHint.textContent = 'ไม่พบโมเดล generateContent — ใช้รายการสำรอง';
      return;
    }
    geminiModelsCache = models;
    const keep = state.settings.geminiModel;
    fillGeminiModelSelect(keep);
    persistGeminiSettingsFromUi();
    if (els.geminiModelHint) {
      els.geminiModelHint.textContent = `โหลดแล้ว ${models.length} โมเดล · เลือกตัวที่ฉลาดกว่าได้ (เช่น pro)`;
    }
    setStatus(`โหลดโมเดล Gemini ${models.length} รายการ`);
  } catch (err) {
    const code = err?.code || '';
    const msg =
      code === 'bad_key'
        ? 'API key ไม่ถูกต้องหรือถูกจำกัด'
        : code === 'network'
          ? 'เชื่อมต่อโหลดโมเดลไม่ได้'
          : err?.message
            ? String(err.message).slice(0, 100)
            : 'โหลดโมเดลไม่สำเร็จ';
    if (els.geminiModelHint) els.geminiModelHint.textContent = msg;
    setStatus(msg);
  } finally {
    if (els.geminiLoadModelsBtn) els.geminiLoadModelsBtn.disabled = false;
  }
}

let aiNoteBusy = false;
/** @type {Array<{ attachment: object, aiPart: object|null }>} */
let aiPendingMedia = [];
/** @type {Array<{ name: string, isNew: boolean, on: boolean }>} */
let aiTagDraft = [];

function setAiNoteStatus(message) {
  if (els.aiNoteStatus) els.aiNoteStatus.textContent = message || '';
}

function seedExistingTagChips() {
  const existing = state.notesData.tags || [];
  aiTagDraft = existing.slice(0, 12).map((t) => ({
    name: t.name,
    isNew: false,
    on: false,
  }));
  renderAiTagChips();
}

function formatBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function clearAiPendingMedia() {
  aiPendingMedia = [];
  if (els.aiNoteCamera) els.aiNoteCamera.value = '';
  if (els.aiNoteFile) els.aiNoteFile.value = '';
  renderAiAttachList();
}

function renderAiAttachList() {
  const wrap = els.aiNoteAttachList;
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!aiPendingMedia.length) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  aiPendingMedia.forEach((item, index) => {
    const a = item.attachment;
    const row = document.createElement('div');
    row.className = 'ai-note-attach-item';
    if (a.kind === 'image' && (a.previewUrl || a.data)) {
      const img = document.createElement('img');
      img.alt = a.name || 'รูป';
      img.src = a.previewUrl || `data:${a.mimeType};base64,${a.data}`;
      row.appendChild(img);
    } else {
      const icon = document.createElement('span');
      icon.className = 'ai-note-attach-file-icon';
      icon.textContent = '📄';
      row.appendChild(icon);
    }
    const meta = document.createElement('div');
    meta.className = 'ai-note-attach-meta';
    const name = document.createElement('span');
    name.className = 'ai-note-attach-name';
    name.textContent = a.name || 'ไฟล์';
    const sub = document.createElement('span');
    sub.className = 'ai-note-attach-sub';
    const bits = [formatBytes(a.size)];
    if (a.kind === 'image' && a.fullRes) bits.push('เต็มความละเอียด');
    else if (a.kind === 'image' && a.fullRes === false) bits.push('ย่อเล็กน้อย');
    sub.textContent = bits.join(' · ');
    meta.append(name, sub);
    row.appendChild(meta);
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'ai-note-attach-remove';
    rm.setAttribute('aria-label', 'ลบ');
    rm.textContent = '×';
    rm.addEventListener('click', () => {
      aiPendingMedia.splice(index, 1);
      renderAiAttachList();
      setAiNoteStatus(aiPendingMedia.length ? `แนบแล้ว ${aiPendingMedia.length} รายการ` : '');
    });
    row.appendChild(rm);
    wrap.appendChild(row);
  });
}

function renderAiTagChips() {
  const wrap = els.aiNoteTagChips;
  if (!wrap) return;
  wrap.innerHTML = '';
  aiTagDraft.forEach((item, index) => {
    const existing = (state.notesData.tags || []).find(
      (t) => t.name.toLowerCase() === item.name.toLowerCase(),
    );
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ai-note-tag-chip${item.on ? ' is-on' : ''}${item.isNew ? ' is-new' : ''}`;
    btn.textContent = item.name;
    btn.style.setProperty('--tag', safeTagColor(existing?.color));
    btn.addEventListener('click', () => {
      aiTagDraft[index].on = !aiTagDraft[index].on;
      renderAiTagChips();
    });
    wrap.appendChild(btn);
  });
}

function applyAiDraftToForm(draft) {
  if (els.aiNoteDraftTitle) els.aiNoteDraftTitle.value = draft.title || '';
  if (els.aiNoteDraftSummary) els.aiNoteDraftSummary.value = draft.summary || '';
  if (els.aiNoteDraftSchedule) {
    els.aiNoteDraftSchedule.value = toDatetimeLocalValue(draft.scheduledAt);
  }
  if (els.aiNoteDraftPriority) {
    const p = draft.priority;
    els.aiNoteDraftPriority.value = Object.values(NOTE_PRIORITY).includes(p)
      ? p
      : NOTE_PRIORITY.NORMAL;
  }
  if (els.aiNoteDraftRecurrence) {
    els.aiNoteDraftRecurrence.value = normalizeRecurrence(draft.recurrence) || '';
  }
  const existingNames = new Set(
    (state.notesData.tags || []).map((t) => t.name.toLowerCase()),
  );
  const suggested = (draft.tags || []).map((name) => ({
    name,
    isNew: !existingNames.has(name.toLowerCase()),
    on: true,
  }));
  // Keep other existing tags (off) so user can tap to add
  const suggestedKeys = new Set(suggested.map((s) => s.name.toLowerCase()));
  const extras = (state.notesData.tags || [])
    .filter((t) => !suggestedKeys.has(t.name.toLowerCase()))
    .slice(0, 10)
    .map((t) => ({ name: t.name, isNew: false, on: false }));
  aiTagDraft = [...suggested, ...extras];
  renderAiTagChips();
}

function attachmentDataUrl(a) {
  return `data:${a.mimeType};base64,${a.data}`;
}

function renderEditorAttachments(note) {
  const wrap = els.noteAttachments;
  if (!wrap) return;
  const list = normalizeAttachments(note?.attachments);
  wrap.innerHTML = '';
  if (!list.length) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  list.forEach((a) => {
    const row = document.createElement('div');
    row.className = 'note-attach-item';
    if (a.kind === 'image') {
      const img = document.createElement('img');
      img.src = attachmentDataUrl(a);
      img.alt = a.name || 'รูปแนบ';
      img.loading = 'lazy';
      img.addEventListener('click', () => {
        window.open(attachmentDataUrl(a), '_blank');
      });
      row.appendChild(img);
    }
    const link = document.createElement('a');
    link.className = 'note-attach-link';
    link.href = attachmentDataUrl(a);
    link.download = a.name || 'file';
    link.textContent = a.kind === 'image' ? `📷 ${a.name || 'รูป'}` : `📎 ${a.name || 'ไฟล์'}`;
    row.appendChild(link);
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn btn-text';
    rm.textContent = 'ลบ';
    rm.addEventListener('click', () => {
      const active = getActiveNote();
      if (!active) return;
      const next = {
        ...active,
        attachments: (active.attachments || []).filter((x) => x.id !== a.id),
        updatedAt: new Date().toISOString(),
      };
      state.notesData = updateNoteInData(state.notesData, next);
      renderEditorAttachments(next);
      autosave();
    });
    row.appendChild(rm);
    wrap.appendChild(row);
  });
}

function openAddNoteModal() {
  if (!els.aiNoteModal) return;
  if (els.aiNoteSource) els.aiNoteSource.value = '';
  if (els.aiNoteDraftTitle) els.aiNoteDraftTitle.value = '';
  if (els.aiNoteDraftSummary) els.aiNoteDraftSummary.value = '';
  if (els.aiNoteDraftSchedule) els.aiNoteDraftSchedule.value = '';
  if (els.aiNoteDraftPriority) els.aiNoteDraftPriority.value = NOTE_PRIORITY.NORMAL;
  if (els.aiNoteDraftRecurrence) els.aiNoteDraftRecurrence.value = '';
  clearAiPendingMedia();
  seedExistingTagChips();
  setAiNoteStatus('');
  els.aiNoteModal.hidden = false;
  queueMicrotask(() => els.aiNoteDraftTitle?.focus() || els.aiNoteSource?.focus());
}

function closeAiNoteModal() {
  if (!els.aiNoteModal) return;
  els.aiNoteModal.hidden = true;
  aiNoteBusy = false;
  clearAiPendingMedia();
  if (els.aiNoteSummarizeBtn) els.aiNoteSummarizeBtn.disabled = false;
  if (els.aiNoteConfirmBtn) els.aiNoteConfirmBtn.disabled = false;
  setAiNoteStatus('');
}

async function addAiMediaFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return;
  setAiNoteStatus('กำลังเตรียมไฟล์…');
  for (const file of files) {
    if (aiPendingMedia.length >= 6) {
      setAiNoteStatus('แนบได้สูงสุด 6 ไฟล์');
      break;
    }
    try {
      const prepared = await prepareAiMedia(file);
      aiPendingMedia.push(prepared);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'too_large') setAiNoteStatus(`ไฟล์ใหญ่เกิน · ${file.name || ''}`);
      else setAiNoteStatus(`ใช้ไฟล์นี้ไม่ได้ · ${file.name || ''}`);
      console.warn('ai media failed', err);
    }
  }
  renderAiAttachList();
  if (aiPendingMedia.length) {
    const full = aiPendingMedia.filter((m) => m.attachment.fullRes !== false).length;
    setAiNoteStatus(
      `แนบแล้ว ${aiPendingMedia.length} · กดสรุปได้${full ? ' · เก็บความละเอียดเต็ม' : ''}`,
    );
  }
}

async function runAiSummarize() {
  if (aiNoteBusy) return;
  const source = String(els.aiNoteSource?.value || '').trim();
  const titleHint = String(els.aiNoteDraftTitle?.value || '').trim();
  const summaryHint = String(els.aiNoteDraftSummary?.value || '').trim();
  const combined = [source, titleHint, summaryHint].filter(Boolean).join('\n');
  if (!combined && !aiPendingMedia.length) {
    setAiNoteStatus('ใส่ข้อความ ถ่ายรูป หรือแนบไฟล์ก่อนสรุป');
    return;
  }
  const apiKey = String(state.settings.geminiApiKey || '').trim();
  if (!apiKey) {
    setAiNoteStatus('ตั้งค่า Gemini API key ก่อน');
    openSettings();
    els.geminiApiKey?.focus();
    return;
  }
  aiNoteBusy = true;
  if (els.aiNoteSummarizeBtn) els.aiNoteSummarizeBtn.disabled = true;
  const aiImages = aiPendingMedia.map((m) => m.aiPart).filter(Boolean);
  setAiNoteStatus(aiImages.length ? 'กำลังอ่านไฟล์และสรุป…' : 'กำลังสรุป…');
  try {
    const ctx = refreshUserContext(state.notesData);
    let draft = await summarizeToNoteDraft(apiKey, combined || source, {
      model: state.settings.geminiModel,
      existingTags: state.notesData.tags || [],
      images: aiImages,
      userContextMd: ctx.md || loadUserContextMd(),
      now: new Date(),
    });
    draft = refineDraftWithContext(
      draft,
      state.notesData,
      `${combined}\n${draft.title || ''}\n${draft.summary || ''}`,
    );
    applyAiDraftToForm(draft);
    const bits = [];
    if (aiPendingMedia.length) bits.push(`แนบ ${aiPendingMedia.length}`);
    if (draft.tags?.length) bits.push(`แท็ก ${draft.tags.join(', ')}`);
    if (draft.scheduledAt) bits.push('มีกำหนด');
    if (draft.priority && draft.priority !== 'normal') bits.push(priorityLabel(draft.priority));
    setAiNoteStatus(bits.length ? `สรุปแล้ว · ${bits.join(' · ')} · แก้ได้แล้วกดสร้าง` : 'สรุปแล้ว · แก้ได้แล้วกดสร้าง');
    els.aiNoteDraftTitle?.focus();
  } catch (err) {
    const code = err?.code || '';
    if (code === 'missing_api_key') setAiNoteStatus('ยังไม่มี API key');
    else if (code === 'empty_input') setAiNoteStatus('ใส่ข้อความหรือแนบไฟล์ก่อน');
    else if (code === 'too_long') setAiNoteStatus('ข้อความยาวเกินไป');
    else if (code === 'bad_key') setAiNoteStatus('API key ไม่ถูกต้องหรือถูกจำกัด');
    else if (code === 'network') setAiNoteStatus('เชื่อมต่อ Gemini ไม่ได้');
    else setAiNoteStatus(err?.message ? String(err.message).slice(0, 120) : 'สรุปไม่สำเร็จ');
  } finally {
    aiNoteBusy = false;
    if (els.aiNoteSummarizeBtn) els.aiNoteSummarizeBtn.disabled = false;
  }
}

async function confirmAiNoteDraft() {
  const title = ensureLeadingEmoji(String(els.aiNoteDraftTitle?.value || '').trim() || 'โน้ต');
  const content = String(els.aiNoteDraftSummary?.value || '').trim();
  const attachments = normalizeAttachments(
    aiPendingMedia.map((m) => {
      const a = m.attachment;
      return {
        id: a.id,
        name: a.name,
        mimeType: a.mimeType,
        data: a.data,
        size: a.size,
        kind: a.kind,
      };
    }),
  );
  if (!title && !content && !attachments.length) {
    setAiNoteStatus('ใส่หัวข้อ รายละเอียด หรือไฟล์แนบอย่างน้อยอย่างหนึ่ง');
    return;
  }

  let data = state.notesData;
  const tagIds = [];
  for (const item of aiTagDraft) {
    if (!item.on) continue;
    const result = addTag(data, item.name);
    data = result.data;
    if (result.tag) tagIds.push(result.tag.id);
  }

  let note = createNote(title, content);
  note = updateNote(note, {
    scheduledAt: fromDatetimeLocalValue(els.aiNoteDraftSchedule?.value),
    priority: els.aiNoteDraftPriority?.value,
    recurrence: els.aiNoteDraftRecurrence?.value || null,
  });
  note = { ...note, tagIds, attachments };

  state.notesData = {
    ...data,
    notes: [note, ...data.notes],
    updatedAt: new Date().toISOString(),
  };
  state.draftNoteId = null;
  closeAiNoteModal();
  openEditor(note.id);
  try {
    await saveManager.saveNow(() => state.notesData);
  } catch (err) {
    console.warn('note save failed', err);
    autosave();
  }
  renderNotesList();
  renderTagFilterBar();
  renderTagManager();
  scheduleUserContextRefresh();
  setStatus(attachments.length ? 'สร้างโน้ตพร้อมไฟล์แนบ' : 'สร้างโน้ตแล้ว');
}

function openNewNote() {
  openAddNoteModal();
}

function moveTagOrder(index, delta) {
  const tags = orderedFilterTags();
  const next = index + delta;
  if (next < 0 || next >= tags.length) return;
  const ids = tags.map((t) => t.id);
  const tmp = ids[index];
  ids[index] = ids[next];
  ids[next] = tmp;
  persistTagOrder(ids);
  renderTagManager();
  renderTagFilterBar();
}

function bindTagManagerListReorder() {
  const list = els.tagManagerList;
  if (!list || list.dataset.tagReorderBound === '1') return;
  list.dataset.tagReorderBound = '1';

  let row = null;
  let dragging = false;
  let pointerId = null;
  let startY = 0;

  list.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.tag-manager-grip');
    if (!grip) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    row = grip.closest('.tag-manager-row');
    if (!row) return;
    dragging = true;
    pointerId = e.pointerId;
    startY = e.clientY;
    row.classList.add('is-tag-row-dragging');
    try {
      list.setPointerCapture(e.pointerId);
    } catch (_) {}
    e.preventDefault();
  });

  list.addEventListener(
    'pointermove',
    (e) => {
      if (!dragging || !row || e.pointerId !== pointerId) return;
      e.preventDefault();
      const y = e.clientY;
      const others = [...list.querySelectorAll('.tag-manager-row')].filter((r) => r !== row);
      let before = null;
      for (const other of others) {
        const r = other.getBoundingClientRect();
        if (y < r.top + r.height / 2) {
          before = other;
          break;
        }
      }
      if (before) list.insertBefore(row, before);
      else list.appendChild(row);
    },
    { passive: false },
  );

  const end = (e) => {
    if (!dragging || (e && e.pointerId != null && e.pointerId !== pointerId)) return;
    dragging = false;
    if (row) row.classList.remove('is-tag-row-dragging');
    const ids = [...list.querySelectorAll('.tag-manager-row')]
      .map((el) => el.dataset.tagId)
      .filter(Boolean);
    row = null;
    pointerId = null;
    if (ids.length) {
      persistTagOrder(ids);
      renderTagFilterBar();
    }
  };

  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
}

function renderTagManager() {
  els.tagManagerList.innerHTML = '';
  const tags = orderedFilterTags();
  tags.forEach((tag, index) => {
    const row = document.createElement('div');
    row.className = 'tag-manager-row';
    row.dataset.tagId = tag.id;

    const grip = document.createElement('button');
    grip.type = 'button';
    grip.className = 'tag-manager-grip';
    grip.title = 'ลากเพื่อจัดลำดับ';
    grip.setAttribute('aria-label', 'ลากจัดลำดับ');
    grip.textContent = '⋮⋮';

    const ord = document.createElement('div');
    ord.className = 'tag-manager-ord';
    const up = document.createElement('button');
    up.type = 'button';
    up.textContent = '↑';
    up.title = 'เลื่อนขึ้น';
    up.disabled = index === 0;
    up.addEventListener('click', () => moveTagOrder(index, -1));
    const down = document.createElement('button');
    down.type = 'button';
    down.textContent = '↓';
    down.title = 'เลื่อนลง';
    down.disabled = index === tags.length - 1;
    down.addEventListener('click', () => moveTagOrder(index, 1));
    ord.append(up, down);

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

    row.append(grip, ord, color, name, count, del);
    els.tagManagerList.appendChild(row);
  });
  bindTagManagerListReorder();
}

function openEditor(noteId) {
  const note = getNoteById(noteId);
  if (!note) return;

  state.activeNoteId = noteId;
  els.noteTitle.value = note.title;
  els.noteContent.value = note.content;
  els.noteSchedule.value = toDatetimeLocalValue(note.scheduledAt);
  if (els.noteRemindBefore) {
    els.noteRemindBefore.value = normalizeRemindBefore(note.remindBefore);
  }
  if (els.noteNotifyRepeat) {
    els.noteNotifyRepeat.value = normalizeNotifyRepeat(note.notifyRepeat);
  }
  if (els.noteNotifyDetails) els.noteNotifyDetails.open = false;
  updateNotifyDetailsPreview();
  renderEditorAttachments(note);
  setStatus('');
  showView('editor');
  renderEditorTags();
  renderEditorPriority();
  renderEditorRecurrence();
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
  /* Filter dock is fixed; movable bar layout is retired. */
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
  try { refreshUserContext(state.notesData); } catch {}

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
        (els.aiNoteModal && !els.aiNoteModal.hidden) ||
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
          else if (els.aiNoteModal && !els.aiNoteModal.hidden) closeAiNoteModal();
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

  els.addNoteBtn.addEventListener('click', openAddNoteModal);
  els.aiNoteCancelBtn?.addEventListener('click', closeAiNoteModal);
  els.aiNoteSummarizeBtn?.addEventListener('click', () => {
    runAiSummarize();
  });
  els.aiNoteConfirmBtn?.addEventListener('click', confirmAiNoteDraft);
  els.aiNoteModal?.addEventListener('click', (e) => {
    if (e.target === els.aiNoteModal) closeAiNoteModal();
  });
  els.aiNoteCameraBtn?.addEventListener('click', () => {
    els.aiNoteCamera?.click();
  });
  els.aiNoteFileBtn?.addEventListener('click', () => {
    els.aiNoteFile?.click();
  });
  els.aiNoteCamera?.addEventListener('change', () => {
    const file = els.aiNoteCamera.files?.[0];
    if (file) addAiMediaFiles([file]);
    if (els.aiNoteCamera) els.aiNoteCamera.value = '';
  });
  els.aiNoteFile?.addEventListener('change', () => {
    const files = els.aiNoteFile.files;
    if (files?.length) addAiMediaFiles(files);
    if (els.aiNoteFile) els.aiNoteFile.value = '';
  });
  els.geminiApiKey?.addEventListener('change', persistGeminiSettingsFromUi);
  els.geminiModel?.addEventListener('change', persistGeminiSettingsFromUi);
  els.geminiLoadModelsBtn?.addEventListener('click', () => {
    loadGeminiModelsFromApi();
  });
  els.aiContextRefreshBtn?.addEventListener('click', () => {
    const ctx = refreshUserContext(state.notesData);
    fillAiContextPreview();
    setStatus(`รีเฟรชความจำแล้ว · แท็ก ${ctx.tagCount} · โน้ต ${ctx.noteCount}`);
  });
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

  const setFabDir = (dir) => {
    if (typeof window.FabDrag?.setDirection === 'function') {
      window.FabDrag.setDirection(dir);
    }
    applyFabDirection();
  };
  els.fabDirVerticalBtn?.addEventListener('click', () => setFabDir('vertical'));
  els.fabDirHorizontalBtn?.addEventListener('click', () => setFabDir('horizontal'));
  applyFabDirection();

  els.notifyOffBtn?.addEventListener('click', () => setNotificationsEnabled(false));
  els.notifyOnBtn?.addEventListener('click', () => setNotificationsEnabled(true));
  els.notifyLabel?.addEventListener('change', () => {
    persistNotifyPrefs({ label: els.notifyLabel.value.trim() || 'P-Note' });
  });
  els.notifyEarly?.addEventListener('change', () => {
    persistNotifyPrefs({ earlyMinutes: Number(els.notifyEarly.value) || 0 });
  });
  els.notifyMinPriority?.addEventListener('change', () => {
    persistNotifyPrefs({ minPriority: els.notifyMinPriority.value || 'normal' });
  });
  document.getElementById('notify-sound-seg')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-notify-sound]');
    if (!btn) return;
    persistNotifyPrefs({ sound: btn.dataset.notifySound === '1' });
  });
  document.getElementById('notify-vibrate-seg')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-notify-vibrate]');
    if (!btn) return;
    persistNotifyPrefs({ vibrate: btn.dataset.notifyVibrate === '1' });
  });
  document.getElementById('notify-preview-seg')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-notify-preview]');
    if (!btn) return;
    persistNotifyPrefs({ preview: btn.dataset.notifyPreview || 'full' });
  });
  document.getElementById('notify-style-seg')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-notify-persistent]');
    if (!btn) return;
    persistNotifyPrefs({ persistent: btn.dataset.notifyPersistent === '1' });
  });
  els.notifyTestBtn?.addEventListener('click', async () => {
    const result = await sendTestNotification(getNotifyPrefs());
    if (result.ok) setStatus('ส่งแจ้งเตือนทดสอบแล้ว');
    else if (result.reason === 'denied') setStatus('ระบบบล็อกการแจ้งเตือน');
    else if (result.reason === 'unsupported') setStatus('ไม่รองรับการแจ้งเตือน');
    else setStatus('ทดสอบแจ้งเตือนไม่สำเร็จ');
    applyNotifySettingsUi();
  });
  applyNotifySettingsUi();

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
  els.resetBarsBtn?.addEventListener('click', () => {
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
    if (
      state.tagReorderMode &&
      els.tagFilterBar &&
      !els.tagFilterBar.contains(event.target) &&
      !(els.noteContextOverlay && !els.noteContextOverlay.hidden)
    ) {
      disableTagReorderMode();
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
  els.noteRemindBefore?.addEventListener('change', () => {
    updateNotifyDetailsPreview();
    flushEditorToState();
  });
  els.noteNotifyRepeat?.addEventListener('change', () => {
    updateNotifyDetailsPreview();
    flushEditorToState();
  });
  els.clearScheduleBtn.addEventListener('click', () => {
    els.noteSchedule.value = '';
    if (els.noteRemindBefore) els.noteRemindBefore.value = 'default';
    if (els.noteNotifyRepeat) els.noteNotifyRepeat.value = 'none';
    const note = getActiveNote();
    if (note) {
      const updated = updateNote(note, {
        scheduledAt: null,
        remindBefore: 'default',
        notifyRepeat: 'none',
      });
      state.notesData = updateNoteInData(state.notesData, updated);
    }
    updateNotifyDetailsPreview();
    flushEditorToState();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshNoteNotifications();
  });

  // Block iOS pinch/gesture zoom so the fixed layout never overflows its edges.
  document.addEventListener('gesturestart', (event) => event.preventDefault());
  document.addEventListener('gesturechange', (event) => event.preventDefault());

  initSwipeBack();
  initFilterDock();
  bootstrapData().then(async () => {
    if (getNotifyPrefs().enabled) {
      await registerNotifyServiceWorker();
      if (notificationPermission() === 'granted') refreshNoteNotifications();
    }
  });
}

init();

import { loadNotes, saveNotes } from './local.js?v=46';
import { attachNoteCardInteractions, positionContextMenu, clearUiTextSelection } from './context-menu.js?v=106';
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
  TAG_FILTER_UNTAGGED,
  formatDate,
  getTagsForNote,
  markNoteActive,
  markNoteDone,
  moveNoteToTrash,
  NOTE_PRIORITY,
  NOTE_STATUS,
  notePriority,
  normalizeAttachments,
  attachmentsForPersist,
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
} from './notes.js?v=106';
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
import { densityToCssUnit, loadSettings, normalizeNotifyPrefs, normalizeGeminiModel, normalizeFabOrder, normalizeAiProfile, normalizeAiTagRules, saveSettings, thicknessStyleVars, dockScaleToCss, dockOffsetYToLiftPx } from './settings.js?v=106';
import {
  notificationPermission,
  notificationSupported,
  registerNotifyServiceWorker,
  requestNotificationPermission,
  sendTestNotification,
  syncNoteNotifications,
} from './note-notify.js?v=88';
import { summarizeToNoteDraft, listGeminiModels, FALLBACK_GEMINI_MODELS, ensureLeadingEmoji, prepareAiMedia } from './gemini.js?v=106';
import {
  uploadFileToCloud,
  getDownloadUrl,
  deleteCloudFile,
} from './files.js?v=106';
import {
  refreshUserContext,
  loadUserContextMd,
  refineDraftWithContext,
  composeAiMemoryMd,
} from './user-context.js?v=106';
import { DEFAULT_BAR_LAYOUT } from './bars.js?v=64';
import {
  fetchRemoteNotes,
  getSpaceId,
  pushRemoteNotes,
  setSpaceId,
} from './remote.js?v=51';
import { normalizeNotesData } from './notes.js?v=106';
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
  aiNotePasteDraftBtn: document.getElementById('ai-note-paste-draft-btn'),
  aiNoteDraftTitle: document.getElementById('ai-note-draft-title'),
  aiNoteDraftSummary: document.getElementById('ai-note-draft-summary'),
  aiNoteDraftSchedule: document.getElementById('ai-note-draft-schedule'),
  aiNoteDraftPriority: document.getElementById('ai-note-draft-priority'),
  aiNoteDraftRecurrence: document.getElementById('ai-note-draft-recurrence'),
  aiNoteDraftRemind: document.getElementById('ai-note-draft-remind'),
  aiNoteDraftNotifyRepeat: document.getElementById('ai-note-draft-notify-repeat'),
  aiNoteNotifyRow: document.getElementById('ai-note-notify-row'),
  aiNoteTagChips: document.getElementById('ai-note-tag-chips'),
  aiNoteCameraBtn: document.getElementById('ai-note-camera-btn'),
  aiNoteCamera: document.getElementById('ai-note-camera'),
  aiNoteFileBtn: document.getElementById('ai-note-file-btn'),
  aiNoteFile: document.getElementById('ai-note-file'),
  aiNoteAttachList: document.getElementById('ai-note-attach-list'),
  aiNoteDocs: document.getElementById('ai-note-docs'),
  noteAttachments: document.getElementById('note-attachments'),
  attachViewer: document.getElementById('attach-viewer'),
  attachViewerBackdrop: document.getElementById('attach-viewer-backdrop'),
  attachViewerBody: document.getElementById('attach-viewer-body'),
  attachViewerTitle: document.getElementById('attach-viewer-title'),
  attachViewerSub: document.getElementById('attach-viewer-sub'),
  attachViewerClose: document.getElementById('attach-viewer-close'),
  attachViewerPrev: document.getElementById('attach-viewer-prev'),
  attachViewerNext: document.getElementById('attach-viewer-next'),
  attachViewerDownload: document.getElementById('attach-viewer-download'),
  aiNoteStatus: null,
  aiNoteCancelBtn: document.getElementById('ai-note-cancel-btn'),
  aiNoteSummarizeBtn: document.getElementById('ai-note-summarize-btn'),
  aiNoteConfirmBtn: document.getElementById('ai-note-confirm-btn'),
  geminiApiKey: document.getElementById('gemini-api-key'),
  geminiModel: document.getElementById('gemini-model'),
  geminiLoadModelsBtn: document.getElementById('gemini-load-models-btn'),
  geminiModelHint: document.getElementById('gemini-model-hint'),
  aiProfile: document.getElementById('ai-profile'),
  aiTagRulesList: document.getElementById('ai-tag-rules-list'),
  aiTagRuleForm: document.getElementById('ai-tag-rule-form'),
  aiTagRuleKeywords: document.getElementById('ai-tag-rule-keywords'),
  aiTagRuleTag: document.getElementById('ai-tag-rule-tag'),
  aiTagRuleTagList: document.getElementById('ai-tag-rule-tag-list'),
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
  filterDockFilters: document.querySelector('.filter-dock-cluster'),
  filterSortBtn: document.getElementById('filter-sort-btn'),
  filterSortMenu: document.getElementById('filter-sort-menu'),
  filterPriorityBtn: document.getElementById('filter-priority-btn'),
  filterPriorityMenu: document.getElementById('filter-priority-menu'),
  filterRecurrenceBtn: document.getElementById('filter-recurrence-btn'),
  filterRecurrenceMenu: document.getElementById('filter-recurrence-menu'),
  filterTagBtn: document.getElementById('filter-tag-btn'),
  filterTagMenu: document.getElementById('filter-tag-menu'),
  filterDdBackdrop: document.getElementById('filter-dd-backdrop'),
  dockAiBtn: null,
  dockScaleSlider: document.getElementById('dock-scale-slider'),
  dockScalePreview: document.getElementById('dock-scale-preview'),
  dockOffsetYSlider: document.getElementById('dock-offset-y-slider'),
  aiNoteScheduleBtn: document.getElementById('ai-note-schedule-btn'),
  aiNoteScheduleValue: document.getElementById('ai-note-schedule-value'),
  aiNoteScheduleClear: document.getElementById('ai-note-schedule-clear'),
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
  tagModal: null,
  tagAddForm: document.getElementById('tag-add-form'),
  newTagInput: document.getElementById('new-tag-input'),
  tagManagerList: document.getElementById('tag-manager-list'),
  closeTagModalBtn: null,
  tagsSettingsRow: document.getElementById('tags-settings-row'),
  settingsOverlay: document.getElementById('settings-overlay'),
  settingsBackdrop: document.getElementById('settings-backdrop'),
  cardDensitySlider: document.getElementById('card-density-slider'),
  themeDarkBtn: document.getElementById('theme-dark-btn'),
  themeLightBtn: document.getElementById('theme-light-btn'),
  fabDirVerticalBtn: document.getElementById('fab-dir-vertical-btn'),
  fabDirHorizontalBtn: document.getElementById('fab-dir-horizontal-btn'),
  fabOrderList: document.getElementById('fab-order-list'),
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
  const learned = loadUserContextMd() || refreshUserContext(state.notesData).md;
  els.aiContextPreview.textContent =
    composeAiMemoryMd(learned, state.settings) || '(ยังไม่มีความจำ)';
}

function currentAiMemoryMd() {
  const learned = loadUserContextMd() || refreshUserContext(state.notesData).md;
  return composeAiMemoryMd(learned, state.settings);
}

function renderAiTagRulesList() {
  const list = els.aiTagRulesList;
  if (!list) return;
  const rules = normalizeAiTagRules(state.settings.aiTagRules);
  state.settings.aiTagRules = rules;
  list.innerHTML = '';
  if (!rules.length) {
    const empty = document.createElement('p');
    empty.className = 'settings-hint';
    empty.style.margin = '0';
    empty.textContent = 'ยังไม่มีกฎ — เพิ่มด้านล่างได้';
    list.appendChild(empty);
    return;
  }
  rules.forEach((rule) => {
    const row = document.createElement('div');
    row.className = 'ai-tag-rule-row';
    const body = document.createElement('div');
    body.className = 'ai-tag-rule-body';
    const kw = document.createElement('p');
    kw.className = 'ai-tag-rule-keywords';
    kw.textContent = rule.keywords.join(', ');
    const tag = document.createElement('p');
    tag.className = 'ai-tag-rule-tag';
    tag.textContent = `→ ${rule.tagName}`;
    body.append(kw, tag);
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'ai-tag-rule-remove';
    rm.setAttribute('aria-label', 'ลบกฎ');
    rm.textContent = '×';
    rm.addEventListener('click', () => {
      state.settings.aiTagRules = normalizeAiTagRules(
        (state.settings.aiTagRules || []).filter((r) => r.id !== rule.id),
      );
      saveSettings(state.settings);
      renderAiTagRulesList();
      fillAiContextPreview();
    });
    row.append(body, rm);
    list.appendChild(row);
  });
}

function fillAiTagRuleDatalist() {
  const dl = els.aiTagRuleTagList;
  if (!dl) return;
  dl.innerHTML = '';
  (state.notesData.tags || []).forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.name;
    dl.appendChild(opt);
  });
}

function persistAiProfileFromUi() {
  if (!els.aiProfile) return;
  const next = normalizeAiProfile(els.aiProfile.value);
  if (next === (state.settings.aiProfile || '')) return;
  state.settings.aiProfile = next;
  saveSettings(state.settings);
  fillAiContextPreview();
}

function addAiTagRuleFromForm(event) {
  event?.preventDefault?.();
  const keywordsText = String(els.aiTagRuleKeywords?.value || '');
  const tagName = String(els.aiTagRuleTag?.value || '').trim();
  const keywords = keywordsText
    .split(/[,،、|/]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  if (!tagName || !keywords.length) {
    setStatus('ใส่คำสำคัญและชื่อแท็กก่อน');
    return;
  }
  const next = normalizeAiTagRules([
    ...(state.settings.aiTagRules || []),
    { id: `r-${Date.now()}`, tagName, keywords },
  ]);
  state.settings.aiTagRules = next;
  saveSettings(state.settings);
  if (els.aiTagRuleKeywords) els.aiTagRuleKeywords.value = '';
  if (els.aiTagRuleTag) els.aiTagRuleTag.value = '';
  renderAiTagRulesList();
  fillAiContextPreview();
  setStatus(`เพิ่มกฎ → ${tagName}`);
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

function applyDockScale() {
  const scale = dockScaleToCss(state.settings.dockScale ?? 50);
  const lift = dockOffsetYToLiftPx(state.settings.dockOffsetY ?? 70);
  const value = String(scale);
  if (els.filterDock) {
    els.filterDock.style.setProperty('--dock-scale', value);
    els.filterDock.style.setProperty('--dock-lift', `${lift}px`);
  }
  if (els.dockScalePreview) els.dockScalePreview.style.setProperty('--dock-scale', value);
  if (els.dockScaleSlider) {
    els.dockScaleSlider.value = String(
      Number.isFinite(state.settings.dockScale) ? state.settings.dockScale : 50,
    );
  }
  if (els.dockOffsetYSlider) {
    els.dockOffsetYSlider.value = String(
      Number.isFinite(state.settings.dockOffsetY) ? state.settings.dockOffsetY : 70,
    );
  }
  applyDockOffset();
  requestAnimationFrame(applyDockOffset);
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

const FAB_ORDER_LABELS = {
  ai: '✨ AI',
  pages: '▦ แผ่นงาน',
  group: '☰ กลุ่มงาน',
};

/** Settings list = visual top → bottom. Stack uses column/row-reverse → DOM = reverse. */
function applyFabOrder() {
  const stack = document.getElementById('fabStack');
  if (!stack) return;
  const visual = normalizeFabOrder(state.settings.fabOrder);
  state.settings.fabOrder = visual;
  [...visual].reverse().forEach((id) => {
    const btn = stack.querySelector(`[data-fab-id="${CSS.escape(id)}"]`);
    if (btn) stack.appendChild(btn);
  });
}

function renderFabOrderList() {
  const list = els.fabOrderList;
  if (!list) return;
  const order = normalizeFabOrder(state.settings.fabOrder);
  list.innerHTML = order
    .map((id, i) => {
      const label = FAB_ORDER_LABELS[id] || id;
      const upDisabled = i === 0 ? ' disabled' : '';
      const downDisabled = i === order.length - 1 ? ' disabled' : '';
      return `<div class="fab-order-row" data-fab-order-id="${id}">
        <span class="fab-order-label">${label}</span>
        <div class="fab-order-actions">
          <button type="button" class="fab-order-btn" data-fab-move="up" aria-label="เลื่อนขึ้น"${upDisabled}>↑</button>
          <button type="button" class="fab-order-btn" data-fab-move="down" aria-label="เลื่อนลง"${downDisabled}>↓</button>
        </div>
      </div>`;
    })
    .join('');
}

function moveFabInOrder(id, direction) {
  const order = normalizeFabOrder(state.settings.fabOrder);
  const i = order.indexOf(id);
  if (i < 0) return;
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= order.length) return;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  state.settings.fabOrder = next;
  saveSettings(state.settings);
  applyFabOrder();
  renderFabOrderList();
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

function syncFilterMenuChrome(open) {
  document.body.classList.toggle('filter-menu-open', Boolean(open));
  const stack = document.getElementById('fabStack');
  if (stack) stack.classList.toggle('is-hidden-for-filter', Boolean(open));
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
  syncFilterMenuChrome(false);
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
  syncFilterMenuChrome(true);
  positionFilterMenu(menuEl, btnEl);
  clearUiTextSelection();
  requestAnimationFrame(clearUiTextSelection);
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
  let tagId = null;
  if (s.tagFilterId === TAG_FILTER_UNTAGGED) tagId = TAG_FILTER_UNTAGGED;
  else if (s.tagFilterId && tagIds.has(s.tagFilterId)) tagId = s.tagFilterId;
  state.tagFilterId = tagId;
  state.priorityFilter = s.priorityFilter || null;
  state.recurrenceFilter = normalizeRecurrenceFilter(s.recurrenceFilter);
  // Keep settings in sync if a deleted tag was dropped
  if (s.tagFilterId && s.tagFilterId !== TAG_FILTER_UNTAGGED && !tagId) {
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
  setStatus('จัดลำดับแท็กได้ในตั้งค่า');
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
  clearUiTextSelection();
}

function renderTagFilterBar() {
  const tags = orderedFilterTags();
  const currentId = state.tagFilterId || null;
  const untagged = currentId === TAG_FILTER_UNTAGGED;
  const currentTag = !untagged && currentId ? tags.find((t) => t.id === currentId) : null;
  if (els.filterTagBtn) {
    if (untagged) els.filterTagBtn.textContent = '🏷️ ไม่มีแท็ก';
    else els.filterTagBtn.textContent = currentTag ? `🏷️ ${currentTag.name}` : '🏷️ แท็ก';
    els.filterTagBtn.classList.toggle('is-active', Boolean(currentId));
    els.filterTagBtn.title = untagged
      ? 'แท็ก · ไม่มีแท็ก'
      : currentTag
        ? `แท็ก · ${currentTag.name}`
        : 'แท็ก';
  }

  const noneCount = countNotesByTag(state.notesData.notes, TAG_FILTER_UNTAGGED);
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
    {
      label: noneCount ? `ไม่มีแท็ก (${noneCount})` : 'ไม่มีแท็ก',
      selected: untagged,
      onSelect: () => {
        state.tagFilterId = TAG_FILTER_UNTAGGED;
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
  clearUiTextSelection();
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
  applyDockScale();
  applyDockOffset();
  requestAnimationFrame(applyDockOffset);

  const notes = sortedFilteredNotes();
  els.notesList.innerHTML = '';

  const manual = isManualMode();
  els.notesList.classList.toggle('manual-sort', manual);

  notes.forEach((note) => {
    const item = document.createElement('div');
    item.className = 'note-card';
    item.dataset.noteId = note.id;
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
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

    appendCardAttachments(item, note);

    if (manual) {
      appendCardActions(item, note);
      // Tap + long-press drag handled by the list-level sortable.
    } else {
      attachNoteCardInteractions(item, {
        noteId: note.id,
        onTap: () => openEditor(note.id),
        onLongPress: () => openContextMenu(note.id),
      });
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEditor(note.id);
        }
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
  openSettings();
  const group = els.tagsSettingsRow;
  if (group) {
    group.open = true;
    requestAnimationFrame(() => {
      group.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      els.newTagInput?.focus();
    });
  } else {
    els.newTagInput?.focus();
  }
}

function closeTagManager() {
  /* Tag manager lives in Settings — closing settings is enough. */
}

function openSettings() {
  els.settingsOverlay.hidden = false;
  els.cardDensitySlider.value = String(state.settings.cardDensity);
  applyDockScale();
  if (els.geminiApiKey) els.geminiApiKey.value = state.settings.geminiApiKey || '';
  fillGeminiModelSelect(state.settings.geminiModel);
  if (els.aiProfile) els.aiProfile.value = state.settings.aiProfile || '';
  fillAiTagRuleDatalist();
  renderAiTagRulesList();
  fillAiContextPreview();
  applyTheme();
  applyFabDirection();
  renderFabOrderList();
  renderTagManager();
  applyNotifySettingsUi();
  applyBarThickness();
}

function closeSettings() {
  persistGeminiSettingsFromUi();
  persistAiProfileFromUi();
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
/** @type {'create'|'edit'} */
let aiFormMode = 'create';
let aiEditNoteId = null;
/** @type {ReturnType<typeof captureAiFormSnapshot>|null} */
let aiEditBaseline = null;
/** @type {Array<{ attachment: object, aiPart: object|null, sourceFile?: File|Blob|null, uploadState?: string, uploadProgress?: number }>} */
let aiPendingMedia = [];

const attachUrlCache = new Map(); // storagePath -> object/https url

function attachmentDataUrl(a) {
  if (!a?.data) return '';
  return `data:${a.mimeType};base64,${a.data}`;
}

function attachmentToBlob(a) {
  const bin = atob(String(a.data || ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: a.mimeType || 'application/octet-stream' });
}

/** Resolve a display/download URL: preview → base64 → GCS signed URL. */
async function resolveAttachmentUrl(a) {
  if (!a) return '';
  if (a.previewUrl) return a.previewUrl;
  if (a.data) return attachmentDataUrl(a);
  const path = a.storagePath;
  if (!path) return '';
  const cached = attachUrlCache.get(path);
  if (cached) return cached;
  try {
    const url = await getDownloadUrl(path);
    attachUrlCache.set(path, url);
    return url;
  } catch (err) {
    console.warn('attachment url failed', err);
    return '';
  }
}

function setAiMediaUpload(index, patch) {
  const item = aiPendingMedia[index];
  if (!item) return;
  aiPendingMedia[index] = { ...item, ...patch };
  if (patch.attachment) {
    aiPendingMedia[index].attachment = { ...item.attachment, ...patch.attachment };
  }
  renderAiAttachList();
}

async function startCloudUpload(index) {
  const item = aiPendingMedia[index];
  if (!item?.sourceFile || !item.attachment) return;
  if (item.uploadState === 'uploading' || item.uploadState === 'done') return;
  setAiMediaUpload(index, { uploadState: 'uploading', uploadProgress: 0 });
  try {
    const result = await uploadFileToCloud(item.sourceFile, {
      fileId: item.attachment.id,
      name: item.attachment.name,
      onProgress: (pct) => {
        const cur = aiPendingMedia[index];
        if (!cur || cur.uploadState !== 'uploading') return;
        aiPendingMedia[index] = { ...cur, uploadProgress: pct };
        const id = item.attachment.id;
        document.querySelectorAll('.ai-note-attach-shell').forEach((shell) => {
          if (shell.dataset.attachId !== id) return;
          const sub = shell.querySelector('.ai-note-attach-sub');
          const bar = shell.querySelector('.ai-note-upload-bar-fill');
          if (sub) sub.textContent = `กำลังอัปโหลด… ${pct}%`;
          if (bar) bar.style.width = `${pct}%`;
        });
      },
    });
    const cur = aiPendingMedia[index];
    if (!cur) return;
    aiPendingMedia[index] = {
      ...cur,
      uploadState: 'done',
      uploadProgress: 100,
      sourceFile: null,
      attachment: {
        ...cur.attachment,
        storagePath: result.storagePath,
        name: result.name || cur.attachment.name,
        mimeType: result.mimeType || cur.attachment.mimeType,
        size: result.size || cur.attachment.size,
        fullRes: true,
      },
    };
    renderAiAttachList();
  } catch (err) {
    console.warn('cloud upload failed — keeping local fallback', err);
    const cur = aiPendingMedia[index];
    if (!cur) return;
    if (cur.attachment?.needsCloud && !cur.attachment?.data) {
      aiPendingMedia[index] = { ...cur, uploadState: 'error', uploadProgress: 0 };
      setAiNoteStatus('อัปโหลดไม่สำเร็จ', { kind: 'error', restoreMs: 2400 });
    } else {
      aiPendingMedia[index] = { ...cur, uploadState: 'fallback', uploadProgress: 0 };
    }
    renderAiAttachList();
  }
}

async function waitForPendingUploads() {
  const pending = aiPendingMedia.filter((m) => m.uploadState === 'uploading');
  if (!pending.length) return;
  setAiNoteStatus('รออัปโหลดไฟล์…', { kind: 'working' });
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (!aiPendingMedia.some((m) => m.uploadState === 'uploading')) return;
    await new Promise((r) => setTimeout(r, 200));
  }
}
/** @type {Array<{ name: string, isNew: boolean, on: boolean }>} */
let aiTagDraft = [];

const AI_SUMMARIZE_LABEL = 'สรุป';
let aiStatusResetTimer = null;

function setAiSummarizeLabel(text) {
  const btn = els.aiNoteSummarizeBtn;
  if (!btn) return;
  const label = btn.querySelector('.ai-sum-label');
  if (label) label.textContent = text;
  else btn.textContent = text;
}

/** Short status on the summarize button (no external status line). */
function setAiNoteStatus(message, { kind = 'idle', restoreMs = 0 } = {}) {
  const btn = els.aiNoteSummarizeBtn;
  if (!btn) return;
  if (aiStatusResetTimer) {
    clearTimeout(aiStatusResetTimer);
    aiStatusResetTimer = null;
  }
  btn.classList.remove('is-working', 'is-done', 'is-error');
  if (!message || kind === 'idle') {
    setAiSummarizeLabel(AI_SUMMARIZE_LABEL);
    return;
  }
  const short = String(message).length > 10 ? `${String(message).slice(0, 9)}…` : String(message);
  setAiSummarizeLabel(short);
  if (kind === 'working') btn.classList.add('is-working');
  else if (kind === 'done') btn.classList.add('is-done');
  else if (kind === 'error') btn.classList.add('is-error');
  if (restoreMs > 0) {
    aiStatusResetTimer = setTimeout(() => {
      if (aiNoteBusy) return;
      setAiSummarizeLabel(AI_SUMMARIZE_LABEL);
      btn.classList.remove('is-working', 'is-done', 'is-error');
      aiStatusResetTimer = null;
    }, restoreMs);
  }
}

function formatAiScheduleLabel(localValue) {
  if (!localValue) return '';
  const iso = fromDatetimeLocalValue(localValue);
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const day = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} · ${time}`;
  } catch {
    return shortDate(iso) || '';
  }
}

function syncAiScheduleDisplay() {
  const raw = els.aiNoteDraftSchedule?.value || '';
  const label = formatAiScheduleLabel(raw);
  if (els.aiNoteScheduleValue) {
    els.aiNoteScheduleValue.textContent = label || 'ยังไม่ตั้ง';
    els.aiNoteScheduleValue.classList.toggle('is-empty', !label);
  }
  if (els.aiNoteScheduleClear) els.aiNoteScheduleClear.hidden = !raw;
  if (els.aiNoteScheduleBtn) {
    els.aiNoteScheduleBtn.classList.toggle('has-value', Boolean(raw));
  }
  if (els.aiNoteNotifyRow) {
    els.aiNoteNotifyRow.classList.toggle('is-disabled', !raw);
  }
  updateAiCancelBtn();
}

function initAiScheduleControls() {
  // Tap lands on the datetime-local itself (label + overlay input).
  els.aiNoteDraftSchedule?.addEventListener('change', syncAiScheduleDisplay);
  els.aiNoteDraftSchedule?.addEventListener('input', syncAiScheduleDisplay);
  els.aiNoteScheduleClear?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (els.aiNoteDraftSchedule) els.aiNoteDraftSchedule.value = '';
    syncAiScheduleDisplay();
  });
  syncAiScheduleDisplay();
}

function captureAiFormSnapshot() {
  return {
    source: String(els.aiNoteSource?.value || ''),
    title: String(els.aiNoteDraftTitle?.value || ''),
    summary: String(els.aiNoteDraftSummary?.value || ''),
    schedule: els.aiNoteDraftSchedule?.value || '',
    priority: els.aiNoteDraftPriority?.value || NOTE_PRIORITY.NORMAL,
    recurrence: els.aiNoteDraftRecurrence?.value || '',
    remindBefore: normalizeRemindBefore(els.aiNoteDraftRemind?.value),
    notifyRepeat: normalizeNotifyRepeat(els.aiNoteDraftNotifyRepeat?.value),
    tagOns: aiTagDraft
      .filter((t) => t.on)
      .map((t) => t.name.toLowerCase())
      .sort()
      .join('|'),
    mediaIds: aiPendingMedia
      .map((m) => m.attachment?.id)
      .filter(Boolean)
      .join('|'),
  };
}

function isAiFormDirty() {
  if (aiFormMode === 'edit' && aiEditBaseline) {
    return JSON.stringify(captureAiFormSnapshot()) !== JSON.stringify(aiEditBaseline);
  }
  const source = String(els.aiNoteSource?.value || '').trim();
  const title = String(els.aiNoteDraftTitle?.value || '').trim();
  const summary = String(els.aiNoteDraftSummary?.value || '').trim();
  const schedule = els.aiNoteDraftSchedule?.value || '';
  const priority = els.aiNoteDraftPriority?.value || NOTE_PRIORITY.NORMAL;
  const recurrence = els.aiNoteDraftRecurrence?.value || '';
  const remindBefore = normalizeRemindBefore(els.aiNoteDraftRemind?.value);
  const notifyRepeat = normalizeNotifyRepeat(els.aiNoteDraftNotifyRepeat?.value);
  const tagsOn = aiTagDraft.some((t) => t.on);
  return Boolean(
    source ||
      title ||
      summary ||
      schedule ||
      aiPendingMedia.length ||
      tagsOn ||
      (priority && priority !== NOTE_PRIORITY.NORMAL) ||
      recurrence ||
      remindBefore !== 'default' ||
      notifyRepeat !== 'none',
  );
}

function updateAiFormChrome() {
  const titleEl = document.getElementById('ai-note-title');
  if (titleEl) {
    titleEl.textContent = aiFormMode === 'edit' ? 'แก้ไขงาน · AI' : 'เพิ่มงานด้วย AI';
  }
  if (els.aiNoteConfirmBtn) {
    els.aiNoteConfirmBtn.textContent = aiFormMode === 'edit' ? 'บันทึก' : 'สร้าง';
  }
  updateAiCancelBtn();
}

function updateAiCancelBtn() {
  const btn = els.aiNoteCancelBtn;
  if (!btn) return;
  const dirty = isAiFormDirty();
  const resetLabel = aiFormMode === 'edit' ? 'คืนค่าเดิม' : 'เริ่มใหม่';
  btn.textContent = dirty ? resetLabel : 'ยกเลิก';
  btn.dataset.mode = dirty ? 'reset' : 'cancel';
  btn.setAttribute('aria-label', dirty ? resetLabel : 'ยกเลิก');
}

function clearAiFormFields() {
  if (els.aiNoteSource) els.aiNoteSource.value = '';
  if (els.aiNoteDraftTitle) els.aiNoteDraftTitle.value = '';
  if (els.aiNoteDraftSummary) els.aiNoteDraftSummary.value = '';
  if (els.aiNoteDraftSchedule) els.aiNoteDraftSchedule.value = '';
  if (els.aiNoteDraftPriority) els.aiNoteDraftPriority.value = NOTE_PRIORITY.NORMAL;
  if (els.aiNoteDraftRecurrence) els.aiNoteDraftRecurrence.value = '';
  if (els.aiNoteDraftRemind) els.aiNoteDraftRemind.value = 'default';
  if (els.aiNoteDraftNotifyRepeat) els.aiNoteDraftNotifyRepeat.value = 'none';
  clearAiPendingMedia();
  seedExistingTagChips();
  syncAiScheduleDisplay();
  setAiNoteStatus('');
}

function fillAiFormFromNote(note) {
  if (!note) return;
  if (els.aiNoteSource) els.aiNoteSource.value = '';
  if (els.aiNoteDraftTitle) els.aiNoteDraftTitle.value = note.title || '';
  if (els.aiNoteDraftSummary) els.aiNoteDraftSummary.value = note.content || '';
  if (els.aiNoteDraftSchedule) {
    els.aiNoteDraftSchedule.value = toDatetimeLocalValue(note.scheduledAt);
  }
  if (els.aiNoteDraftPriority) els.aiNoteDraftPriority.value = notePriority(note);
  if (els.aiNoteDraftRecurrence) {
    els.aiNoteDraftRecurrence.value = normalizeRecurrence(note.recurrence) || '';
  }
  if (els.aiNoteDraftRemind) {
    els.aiNoteDraftRemind.value = normalizeRemindBefore(note.remindBefore);
  }
  if (els.aiNoteDraftNotifyRepeat) {
    els.aiNoteDraftNotifyRepeat.value = normalizeNotifyRepeat(note.notifyRepeat);
  }

  const noteTagIds = new Set(note.tagIds || []);
  const tags = state.notesData.tags || [];
  aiTagDraft = tags.map((t) => ({
    name: t.name,
    isNew: false,
    on: noteTagIds.has(t.id),
  }));
  // Keep selected tags first for visibility
  aiTagDraft.sort((a, b) => Number(b.on) - Number(a.on));
  renderAiTagChips();

  aiPendingMedia = normalizeAttachments(note.attachments).map((a) => ({
    attachment: { ...a },
    aiPart: null,
  }));
  renderAiAttachList();
  syncAiScheduleDisplay();
  setAiNoteStatus('');
}

function resetAiAddForm() {
  if (aiFormMode === 'edit' && aiEditNoteId) {
    const note = getNoteById(aiEditNoteId);
    if (note) {
      fillAiFormFromNote(note);
      aiEditBaseline = captureAiFormSnapshot();
      updateAiFormChrome();
      focusAiSourceField();
      return;
    }
  }
  clearAiFormFields();
  updateAiFormChrome();
  focusAiSourceField();
}

function pasteDraftDetailsIntoSource() {
  const title = String(els.aiNoteDraftTitle?.value || '').trim();
  const summary = String(els.aiNoteDraftSummary?.value || '').trim();
  if (!title && !summary) {
    setAiNoteStatus('ยังไม่มีรายละเอียดสรุป', { kind: 'error', restoreMs: 2200 });
    return;
  }
  const parts = [];
  if (title) parts.push(title);
  if (summary) parts.push(summary);
  const block = `${parts.join('\n\n')}\n\n`;
  if (!els.aiNoteSource) return;
  els.aiNoteSource.value = block;
  try {
    els.aiNoteSource.focus({ preventScroll: false });
    const end = els.aiNoteSource.value.length;
    els.aiNoteSource.setSelectionRange(end, end);
  } catch {
    els.aiNoteSource.focus();
  }
  updateAiCancelBtn();
  setAiNoteStatus('วางแล้ว · ใส่คำสั่งเพิ่มแล้วกดสรุป', { kind: 'done', restoreMs: 2600 });
}

function focusAiSourceField() {
  const el = els.aiNoteSource;
  if (!el) return;
  const run = () => {
    try {
      el.focus({ preventScroll: false });
    } catch {
      el.focus();
    }
  };
  run();
  queueMicrotask(run);
  requestAnimationFrame(() => setTimeout(run, 40));
}

function onAiCancelOrReset() {
  if (els.aiNoteCancelBtn?.dataset.mode === 'reset') {
    resetAiAddForm();
    setStatus(
      aiFormMode === 'edit' ? 'คืนค่าเดิมของโน้ตแล้ว' : 'เคลียร์ฟอร์มแล้ว · พร้อมกรอกใหม่',
    );
    return;
  }
  closeAiNoteModal();
}

function bindAiFormDirtyWatchers() {
  const bump = () => updateAiCancelBtn();
  [
    els.aiNoteSource,
    els.aiNoteDraftTitle,
    els.aiNoteDraftSummary,
    els.aiNoteDraftPriority,
    els.aiNoteDraftRecurrence,
    els.aiNoteDraftRemind,
    els.aiNoteDraftNotifyRepeat,
  ]
    .filter(Boolean)
    .forEach((el) => {
      el.addEventListener('input', bump);
      el.addEventListener('change', bump);
    });
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
  aiPendingMedia.forEach((m) => {
    const url = m?.attachment?.previewUrl;
    if (url && String(url).startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
  });
  aiPendingMedia = [];
  if (els.aiNoteCamera) els.aiNoteCamera.value = '';
  if (els.aiNoteFile) els.aiNoteFile.value = '';
  renderAiAttachList();
}

/** @type {{ list: object[], index: number, blobUrl: string|null, gen: number }} */
let attachViewerState = { list: [], index: 0, blobUrl: null, gen: 0 };

function revokeAttachViewerBlob() {
  if (attachViewerState.blobUrl) {
    try {
      URL.revokeObjectURL(attachViewerState.blobUrl);
    } catch {
      /* ignore */
    }
    attachViewerState.blobUrl = null;
  }
}

function fileKindLabel(a) {
  const mime = String(a?.mimeType || '');
  if (mime.startsWith('image/')) return 'รูปภาพ';
  if (mime === 'application/pdf' || /\.pdf$/i.test(a?.name || '')) return 'PDF';
  if (mime.startsWith('text/')) return 'ข้อความ';
  return 'ไฟล์';
}

function canInlinePreview(a) {
  const mime = String(a?.mimeType || '');
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(a?.name || '')) return 'pdf';
  if (mime.startsWith('text/')) return 'text';
  return null;
}

async function renderAttachViewerContent() {
  const wrap = els.attachViewerBody;
  if (!wrap) return;
  revokeAttachViewerBlob();
  wrap.innerHTML = '';
  const list = attachViewerState.list;
  const a = list[attachViewerState.index];
  if (!a) return;
  const gen = ++attachViewerState.gen;

  if (els.attachViewerTitle) els.attachViewerTitle.textContent = a.name || 'เอกสาร';
  if (els.attachViewerSub) {
    els.attachViewerSub.textContent = [
      fileKindLabel(a),
      formatBytes(a.size),
      list.length > 1 ? `${attachViewerState.index + 1}/${list.length}` : '',
      'กำลังโหลด…',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  let url = '';
  try {
    if (a.data) {
      const blob = attachmentToBlob(a);
      url = URL.createObjectURL(blob);
      attachViewerState.blobUrl = url;
    } else {
      url = await resolveAttachmentUrl(a);
    }
  } catch (err) {
    console.warn('viewer resolve failed', err);
  }
  if (gen !== attachViewerState.gen) return;

  if (!url) {
    wrap.innerHTML = '<p class="attach-viewer-fallback">โหลดไฟล์ไม่สำเร็จ</p>';
    return;
  }

  if (els.attachViewerSub) {
    els.attachViewerSub.textContent = [
      fileKindLabel(a),
      formatBytes(a.size),
      a.storagePath ? 'เต็ม' : '',
      list.length > 1 ? `${attachViewerState.index + 1}/${list.length}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (els.attachViewerDownload) {
    els.attachViewerDownload.href = url;
    els.attachViewerDownload.download = a.name || 'file';
  }
  const multi = list.length > 1;
  if (els.attachViewerPrev) els.attachViewerPrev.hidden = !multi;
  if (els.attachViewerNext) els.attachViewerNext.hidden = !multi;

  const mode = canInlinePreview(a);
  if (mode === 'image') {
    const img = document.createElement('img');
    img.className = 'attach-viewer-image';
    img.src = url;
    img.alt = a.name || 'รูปแนบ';
    wrap.appendChild(img);
    return;
  }
  if (mode === 'pdf') {
    const frame = document.createElement('iframe');
    frame.className = 'attach-viewer-frame';
    frame.title = a.name || 'PDF';
    frame.src = url;
    wrap.appendChild(frame);
    const fallback = document.createElement('p');
    fallback.className = 'attach-viewer-fallback';
    fallback.innerHTML =
      'ถ้าดู PDF ไม่ได้ในเครื่องนี้ ใช้ปุ่ม <strong>↓</strong> เพื่อดาวน์โหลด/เปิดภายนอก';
    wrap.appendChild(fallback);
    return;
  }
  if (mode === 'text') {
    const pre = document.createElement('pre');
    pre.className = 'attach-viewer-text';
    if (a.data) {
      try {
        const bin = atob(String(a.data || ''));
        let text = '';
        for (let i = 0; i < bin.length; i += 1) text += bin[i];
        pre.textContent = text.slice(0, 200000) || '(ว่าง)';
      } catch {
        pre.textContent = '(อ่านข้อความไม่สำเร็จ — ลองดาวน์โหลด)';
      }
    } else {
      pre.textContent = 'กำลังโหลดข้อความ…';
      fetch(url)
        .then((r) => r.text())
        .then((t) => {
          if (gen !== attachViewerState.gen) return;
          pre.textContent = String(t).slice(0, 200000) || '(ว่าง)';
        })
        .catch(() => {
          if (gen !== attachViewerState.gen) return;
          pre.textContent = '(อ่านข้อความไม่สำเร็จ — ลองดาวน์โหลด)';
        });
    }
    wrap.appendChild(pre);
    return;
  }

  const box = document.createElement('div');
  box.className = 'attach-viewer-file';
  box.innerHTML = `
    <div class="attach-viewer-file-icon" aria-hidden="true">📄</div>
    <p class="attach-viewer-file-name">${escapeHtml(a.name || 'ไฟล์')}</p>
    <p class="attach-viewer-file-meta">${escapeHtml(fileKindLabel(a))} · ${escapeHtml(formatBytes(a.size))}</p>
  `;
  const openBtn = document.createElement('a');
  openBtn.className = 'btn btn-primary';
  openBtn.href = url;
  openBtn.download = a.name || 'file';
  openBtn.target = '_blank';
  openBtn.rel = 'noopener';
  openBtn.textContent = 'ดาวน์โหลด / เปิดไฟล์';
  box.appendChild(openBtn);
  wrap.appendChild(box);
}

function openAttachViewer(list, index = 0) {
  const items = normalizeAttachments(list);
  if (!items.length || !els.attachViewer) return;
  attachViewerState.list = items;
  attachViewerState.index = Math.max(0, Math.min(index, items.length - 1));
  els.attachViewer.hidden = false;
  renderAttachViewerContent();
}

function closeAttachViewer() {
  if (!els.attachViewer) return;
  els.attachViewer.hidden = true;
  if (els.attachViewerBody) els.attachViewerBody.innerHTML = '';
  revokeAttachViewerBlob();
  attachViewerState = { list: [], index: 0, blobUrl: null, gen: attachViewerState.gen + 1 };
}

function stepAttachViewer(delta) {
  const n = attachViewerState.list.length;
  if (n < 2) return;
  attachViewerState.index = (attachViewerState.index + delta + n) % n;
  renderAttachViewerContent();
}

function initAttachViewer() {
  els.attachViewerClose?.addEventListener('click', closeAttachViewer);
  els.attachViewerBackdrop?.addEventListener('click', closeAttachViewer);
  els.attachViewerPrev?.addEventListener('click', () => stepAttachViewer(-1));
  els.attachViewerNext?.addEventListener('click', () => stepAttachViewer(1));
  document.addEventListener('keydown', (e) => {
    if (!els.attachViewer || els.attachViewer.hidden) return;
    if (e.key === 'Escape') closeAttachViewer();
    if (e.key === 'ArrowLeft') stepAttachViewer(-1);
    if (e.key === 'ArrowRight') stepAttachViewer(1);
  });
}

function renderAiAttachList() {
  const wrap = els.aiNoteAttachList;
  const docs = els.aiNoteDocs;
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!aiPendingMedia.length) {
    if (docs) docs.hidden = true;
    return;
  }
  if (docs) docs.hidden = false;
  const list = aiPendingMedia.map((m) => m.attachment).filter(Boolean);
  aiPendingMedia.forEach((item, index) => {
    const a = item.attachment;
    const uploading = item.uploadState === 'uploading';
    const shell = document.createElement('div');
    shell.className = 'ai-note-attach-shell';
    shell.dataset.attachId = a.id || '';
    if (uploading) shell.classList.add('is-uploading');

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'ai-note-attach-item';
    row.setAttribute('aria-label', `ดู ${a.name || 'เอกสาร'}`);
    if (a.kind === 'image' && (a.previewUrl || a.data)) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = a.previewUrl || attachmentDataUrl(a);
      row.appendChild(img);
    } else if (a.kind === 'image' && a.storagePath) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = '';
      row.appendChild(img);
      resolveAttachmentUrl(a).then((url) => {
        if (url) img.src = url;
      });
    } else {
      const icon = document.createElement('span');
      icon.className = 'ai-note-attach-file-icon';
      icon.textContent = canInlinePreview(a) === 'pdf' ? '📕' : '📄';
      row.appendChild(icon);
    }
    const meta = document.createElement('div');
    meta.className = 'ai-note-attach-meta';
    const name = document.createElement('span');
    name.className = 'ai-note-attach-name';
    name.textContent = a.name || 'ไฟล์';
    const sub = document.createElement('span');
    sub.className = 'ai-note-attach-sub';
    let statusBit = 'แตะเพื่อดู';
    if (uploading) statusBit = `กำลังอัปโหลด… ${item.uploadProgress || 0}%`;
    else if (item.uploadState === 'done' || a.storagePath) statusBit = 'อัปโหลดแล้ว · เต็ม';
    else if (item.uploadState === 'fallback') statusBit = 'เก็บในเครื่อง';
    else if (item.uploadState === 'error') statusBit = 'อัปโหลดไม่สำเร็จ';
    else if (a.kind === 'image' && a.fullRes) statusBit = 'เต็ม · แตะเพื่อดู';
    const bits = [fileKindLabel(a), formatBytes(a.size), statusBit];
    sub.textContent = bits.join(' · ');
    meta.append(name, sub);
    if (uploading) {
      const bar = document.createElement('div');
      bar.className = 'ai-note-upload-bar';
      bar.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('div');
      fill.className = 'ai-note-upload-bar-fill';
      fill.style.width = `${item.uploadProgress || 0}%`;
      bar.appendChild(fill);
      meta.appendChild(bar);
    }
    row.appendChild(meta);
    const chev = document.createElement('span');
    chev.className = 'ai-note-attach-open';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = '›';
    row.appendChild(chev);
    row.addEventListener('click', () => openAttachViewer(list, index));
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'ai-note-attach-remove';
    rm.setAttribute('aria-label', 'ลบเอกสาร');
    rm.textContent = '×';
    rm.addEventListener('click', (e) => {
      e.stopPropagation();
      const removed = aiPendingMedia[index];
      if (removed?.attachment?.storagePath) {
        deleteCloudFile(removed.attachment.storagePath).catch(() => {});
      }
      if (removed?.attachment?.previewUrl?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(removed.attachment.previewUrl);
        } catch {
          /* ignore */
        }
      }
      aiPendingMedia.splice(index, 1);
      renderAiAttachList();
      setAiNoteStatus(
        aiPendingMedia.length ? `แนบ ${aiPendingMedia.length}` : '',
        { kind: aiPendingMedia.length ? 'done' : 'idle', restoreMs: 1600 },
      );
    });
    shell.append(row, rm);
    wrap.appendChild(shell);
  });
  updateAiCancelBtn();
}

function appendCardAttachments(item, note) {
  const atts = normalizeAttachments(note.attachments);
  if (!atts.length) return;
  const strip = document.createElement('div');
  strip.className = 'card-attach-strip';
  strip.setAttribute('aria-label', `เอกสารแนบ ${atts.length} รายการ`);
  atts.slice(0, 4).forEach((a, i) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'card-attach-thumb';
    thumb.title = a.name || 'เอกสาร';
    thumb.setAttribute('aria-label', `ดู ${a.name || 'เอกสาร'}`);
    if (a.kind === 'image') {
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      if (a.previewUrl || a.data) {
        img.src = a.previewUrl || attachmentDataUrl(a);
      } else if (a.storagePath) {
        img.src = '';
        resolveAttachmentUrl(a).then((url) => {
          if (url) img.src = url;
        });
      }
      thumb.appendChild(img);
    } else {
      thumb.classList.add('is-file');
      thumb.textContent = canInlinePreview(a) === 'pdf' ? 'PDF' : 'ไฟล์';
    }
    thumb.addEventListener('pointerdown', (e) => e.stopPropagation());
    thumb.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAttachViewer(atts, i);
    });
    strip.appendChild(thumb);
  });
  if (atts.length > 4) {
    const more = document.createElement('span');
    more.className = 'card-attach-more';
    more.textContent = `+${atts.length - 4}`;
    strip.appendChild(more);
  }
  item.appendChild(strip);
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
    if (item.on) btn.style.setProperty('--tag', safeTagColor(existing?.color));
    else btn.style.removeProperty('--tag');
    btn.addEventListener('click', () => {
      aiTagDraft[index].on = !aiTagDraft[index].on;
      renderAiTagChips();
    });
    wrap.appendChild(btn);
  });
  updateAiCancelBtn();
}

function applyAiDraftToForm(draft) {
  if (els.aiNoteDraftTitle) els.aiNoteDraftTitle.value = draft.title || '';
  if (els.aiNoteDraftSummary) els.aiNoteDraftSummary.value = draft.summary || '';
  if (els.aiNoteDraftSchedule) {
    els.aiNoteDraftSchedule.value = toDatetimeLocalValue(draft.scheduledAt);
  }
  syncAiScheduleDisplay();
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
  updateAiCancelBtn();
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
  list.forEach((a, index) => {
    const row = document.createElement('div');
    row.className = 'note-attach-item';
    if (a.kind === 'image') {
      const img = document.createElement('img');
      if (a.previewUrl || a.data) {
        img.src = a.previewUrl || attachmentDataUrl(a);
      } else if (a.storagePath) {
        img.src = '';
        resolveAttachmentUrl(a).then((url) => {
          if (url) img.src = url;
        });
      }
      img.alt = a.name || 'รูปแนบ';
      img.loading = 'lazy';
      img.addEventListener('click', () => openAttachViewer(list, index));
      row.appendChild(img);
    }
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'note-attach-link';
    openBtn.textContent = a.kind === 'image' ? `📷 ${a.name || 'รูป'}` : `📎 ${a.name || 'ไฟล์'}`;
    openBtn.addEventListener('click', () => openAttachViewer(list, index));
    row.appendChild(openBtn);
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn btn-text';
    rm.textContent = 'ลบ';
    rm.addEventListener('click', () => {
      const active = getActiveNote();
      if (!active) return;
      if (a.storagePath) deleteCloudFile(a.storagePath).catch(() => {});
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
  aiFormMode = 'create';
  aiEditNoteId = null;
  aiEditBaseline = null;
  clearAiFormFields();
  updateAiFormChrome();
  els.aiNoteModal.hidden = false;
  focusAiSourceField();
}

function openEditNoteModal(noteId) {
  if (!els.aiNoteModal) return;
  const note = getNoteById(noteId);
  if (!note) return;
  aiFormMode = 'edit';
  aiEditNoteId = noteId;
  fillAiFormFromNote(note);
  aiEditBaseline = captureAiFormSnapshot();
  updateAiFormChrome();
  els.aiNoteModal.hidden = false;
  // Prefer title for edit; fall back to source for voice dictation.
  queueMicrotask(() => {
    if (els.aiNoteDraftTitle) {
      try {
        els.aiNoteDraftTitle.focus({ preventScroll: false });
      } catch {
        els.aiNoteDraftTitle.focus();
      }
    } else {
      focusAiSourceField();
    }
  });
}

function closeAiNoteModal() {
  if (!els.aiNoteModal) return;
  els.aiNoteModal.hidden = true;
  aiNoteBusy = false;
  aiFormMode = 'create';
  aiEditNoteId = null;
  aiEditBaseline = null;
  clearAiPendingMedia();
  if (els.aiNoteSummarizeBtn) els.aiNoteSummarizeBtn.disabled = false;
  if (els.aiNoteConfirmBtn) els.aiNoteConfirmBtn.disabled = false;
  setAiNoteStatus('');
  updateAiFormChrome();
}

async function addAiMediaFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return;
  setAiNoteStatus('เตรียมไฟล์…', { kind: 'working' });
  for (const file of files) {
    if (aiPendingMedia.length >= 6) {
      setAiNoteStatus('แนบได้สูงสุด 6', { kind: 'error', restoreMs: 2200 });
      break;
    }
    try {
      const prepared = await prepareAiMedia(file);
      const index = aiPendingMedia.length;
      aiPendingMedia.push({
        ...prepared,
        uploadState: 'pending',
        uploadProgress: 0,
      });
      renderAiAttachList();
      // Upload original bytes in background — UI already shows preview
      startCloudUpload(index);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'too_large') setAiNoteStatus('ไฟล์ใหญ่เกิน 40MB', { kind: 'error', restoreMs: 2200 });
      else setAiNoteStatus('ใช้ไฟล์ไม่ได้', { kind: 'error', restoreMs: 2200 });
      console.warn('ai media failed', err);
    }
  }
  renderAiAttachList();
  if (aiPendingMedia.length) {
    const uploading = aiPendingMedia.some((m) => m.uploadState === 'uploading');
    setAiNoteStatus(
      uploading ? `แนบ ${aiPendingMedia.length} · กำลังอัปโหลด…` : `แนบ ${aiPendingMedia.length}`,
      { kind: uploading ? 'working' : 'done', restoreMs: uploading ? 0 : 2000 },
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
    setAiNoteStatus('ใส่ข้อความก่อน', { kind: 'error', restoreMs: 2200 });
    return;
  }
  const apiKey = String(state.settings.geminiApiKey || '').trim();
  if (!apiKey) {
    setAiNoteStatus('ตั้งค่า API key', { kind: 'error', restoreMs: 2400 });
    openSettings();
    els.geminiApiKey?.focus();
    return;
  }
  aiNoteBusy = true;
  if (els.aiNoteSummarizeBtn) els.aiNoteSummarizeBtn.disabled = true;
  const aiImages = aiPendingMedia.map((m) => m.aiPart).filter(Boolean);
  setAiNoteStatus(aiImages.length ? 'กำลังอ่าน…' : 'กำลังสรุป…', { kind: 'working' });
  try {
    const ctx = refreshUserContext(state.notesData);
    let draft = await summarizeToNoteDraft(apiKey, combined || source, {
      model: state.settings.geminiModel,
      existingTags: state.notesData.tags || [],
      images: aiImages,
      userContextMd: currentAiMemoryMd() || ctx.md || loadUserContextMd(),
      now: new Date(),
    });
    draft = refineDraftWithContext(
      draft,
      state.notesData,
      `${combined}\n${draft.title || ''}\n${draft.summary || ''}`,
      { aiTagRules: state.settings.aiTagRules },
    );
    applyAiDraftToForm(draft);
    setAiNoteStatus('สรุปแล้ว', { kind: 'done', restoreMs: 2600 });
    els.aiNoteDraftTitle?.focus();
  } catch (err) {
    const code = err?.code || '';
    if (code === 'missing_api_key') setAiNoteStatus('ยังไม่มี API key', { kind: 'error', restoreMs: 2600 });
    else if (code === 'empty_input') setAiNoteStatus('ใส่ข้อความก่อน', { kind: 'error', restoreMs: 2200 });
    else if (code === 'too_long') setAiNoteStatus('ข้อความยาวเกิน', { kind: 'error', restoreMs: 2200 });
    else if (code === 'bad_key') setAiNoteStatus('API key ไม่ถูก', { kind: 'error', restoreMs: 2600 });
    else if (code === 'network') setAiNoteStatus('เชื่อมต่อไม่ได้', { kind: 'error', restoreMs: 2600 });
    else setAiNoteStatus('สรุปไม่สำเร็จ', { kind: 'error', restoreMs: 2600 });
  } finally {
    aiNoteBusy = false;
    if (els.aiNoteSummarizeBtn) els.aiNoteSummarizeBtn.disabled = false;
  }
}

async function confirmAiNoteDraft() {
  const title = ensureLeadingEmoji(String(els.aiNoteDraftTitle?.value || '').trim() || 'โน้ต');
  const content = String(els.aiNoteDraftSummary?.value || '').trim();

  if (aiPendingMedia.some((m) => m.uploadState === 'error' && m.attachment?.needsCloud && !m.attachment?.data)) {
    setAiNoteStatus('มีไฟล์อัปโหลดไม่สำเร็จ', { kind: 'error', restoreMs: 2400 });
    return;
  }
  await waitForPendingUploads();

  const attachments = attachmentsForPersist(
    aiPendingMedia.map((m) => m.attachment).filter(Boolean),
  );
  if (!title && !content && !attachments.length) {
    setAiNoteStatus('ใส่หัวข้อก่อน', { kind: 'error', restoreMs: 2200 });
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

  const scheduleAt = fromDatetimeLocalValue(els.aiNoteDraftSchedule?.value);
  const priority = els.aiNoteDraftPriority?.value;
  const recurrence = els.aiNoteDraftRecurrence?.value || null;
  const remindBefore = normalizeRemindBefore(els.aiNoteDraftRemind?.value);
  const notifyRepeat = normalizeNotifyRepeat(els.aiNoteDraftNotifyRepeat?.value);

  if (aiFormMode === 'edit' && aiEditNoteId) {
    const existing = getNoteById(aiEditNoteId);
    if (!existing) {
      setAiNoteStatus('ไม่พบโน้ต', { kind: 'error', restoreMs: 2200 });
      return;
    }
    let note = updateNote(existing, {
      title,
      content,
      scheduledAt: scheduleAt,
      priority,
      recurrence,
      remindBefore,
      notifyRepeat,
    });
    note = { ...note, tagIds, attachments };
    state.notesData = updateNoteInData(data, note);
    state.draftNoteId = null;
    closeAiNoteModal();
    try {
      await saveManager.saveNow(() => state.notesData);
    } catch (err) {
      console.warn('note save failed', err);
      autosave();
    }
    renderNotesList();
    renderTagFilterBar();
    renderTagManager();
    refreshNoteNotifications();
    scheduleUserContextRefresh();
    setStatus('บันทึกแล้ว');
    return;
  }

  let note = createNote(title, content);
  note = updateNote(note, {
    scheduledAt: scheduleAt,
    priority,
    recurrence,
    remindBefore,
    notifyRepeat,
  });
  note = { ...note, tagIds, attachments };

  state.notesData = {
    ...data,
    notes: [note, ...data.notes],
    updatedAt: new Date().toISOString(),
  };
  state.draftNoteId = null;
  closeAiNoteModal();
  try {
    await saveManager.saveNow(() => state.notesData);
  } catch (err) {
    console.warn('note save failed', err);
    autosave();
  }
  renderNotesList();
  renderTagFilterBar();
  renderTagManager();
  refreshNoteNotifications();
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
  const list = els.tagManagerList;
  if (!list) return;
  list.innerHTML = '';
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
    const n = countNotesByTag(state.notesData.notes, tag.id);
    count.textContent = String(n);
    count.title = `${n} โน้ต`;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'tag-delete-btn';
    del.textContent = '✕';
    del.setAttribute('aria-label', `ลบแท็ก ${tag.name}`);
    del.addEventListener('click', async () => {
      const ok = await showConfirm(`ลบแท็ก "${tag.name}"?`, { okLabel: 'ลบ', danger: true });
      if (ok) commitData(deleteTag(state.notesData, tag.id));
    });

    row.append(grip, color, name, count, ord, del);
    list.appendChild(row);
  });
  bindTagManagerListReorder();
}

function openEditor(noteId) {
  // Unified AI form is the editor for all notes.
  openEditNoteModal(noteId);
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
  applyDockScale();
  applyFabOrder();
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
        if (target && target.closest && target.closest('input[type="datetime-local"], input[type="color"], .topbar, .topbar-actions, #settings-btn, .btn-mini')) {
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
          else if (els.attachViewer && !els.attachViewer.hidden) closeAttachViewer();
          else if (els.aiNoteModal && !els.aiNoteModal.hidden) closeAiNoteModal();
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
  initAttachViewer();

  els.addNoteBtn.addEventListener('click', openAddNoteModal);
  els.aiNoteCancelBtn?.addEventListener('click', onAiCancelOrReset);
  els.aiNotePasteDraftBtn?.addEventListener('click', pasteDraftDetailsIntoSource);
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
  els.aiProfile?.addEventListener('change', persistAiProfileFromUi);
  els.aiProfile?.addEventListener('blur', persistAiProfileFromUi);
  els.aiTagRuleForm?.addEventListener('submit', addAiTagRuleFromForm);
  els.aiContextRefreshBtn?.addEventListener('click', () => {
    persistAiProfileFromUi();
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
  applyFabOrder();
  renderFabOrderList();
  els.fabOrderList?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fab-move]');
    if (!btn || btn.disabled) return;
    const row = btn.closest('[data-fab-order-id]');
    if (!row) return;
    moveFabInOrder(row.dataset.fabOrderId, btn.dataset.fabMove);
  });

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
  els.dockScaleSlider?.addEventListener('input', () => {
    state.settings.dockScale = Number(els.dockScaleSlider.value);
    saveSettings(state.settings);
    applyDockScale();
  });
  els.dockOffsetYSlider?.addEventListener('input', () => {
    state.settings.dockOffsetY = Number(els.dockOffsetYSlider.value);
    saveSettings(state.settings);
    applyDockScale();
  });
  initAiScheduleControls();
  bindAiFormDirtyWatchers();
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

  // Block iOS/system text callout on our custom menus & filter dock.
  const blockNativeContext = (event) => {
    const t = event.target;
    if (
      t?.closest?.(
        '.context-menu, .note-center-overlay, .filter-dock, .filter-dd-menu, .note-card, .pages-menu',
      )
    ) {
      event.preventDefault();
    }
  };
  document.addEventListener('contextmenu', blockNativeContext, { capture: true });

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

  els.manageTagsBtn?.addEventListener('click', openTagManager);
  els.backBtn.addEventListener('click', backToList);

  initListSortable(els.notesList, {
    isEnabled: isManualMode,
    onTap: (noteId) => openEditor(noteId),
    onReorder: (ids) => reorderNotes(ids),
  });

  els.tagAddForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const { data, tag } = addTag(state.notesData, els.newTagInput.value);
    if (tag) commitData(data);
    els.newTagInput.value = '';
    els.newTagInput.focus();
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

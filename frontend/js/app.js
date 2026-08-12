import { loadNotes, saveNotes, peekLocalNotesVersion, exportNotesBlob } from './local.js?v=148';
import { attachNoteCardInteractions, positionContextMenu, clearUiTextSelection } from './context-menu.js?v=136';
import { initListSortable } from './sortable.js?v=136';
import { CONFIG } from './config.js?v=154';
import { hasAnyNotes, hasCloudContent, tryAutoImport, importFromText, mergeNotesByUpdatedAt, localNeedsRemotePush } from './import-data.js?v=192';
import {
  getAllowedUser,
  handleAuthRedirect,
  startLogin,
  signOut,
  watchAuth,
} from './auth.js?v=155';
import {
  addTag,
  addNotepad,
  countNotesByTag,
  countNotesByPriority,
  createNote,
  deleteTag,
  deleteNotepad,
  filterNotesByPriority,
  filterNotesByStatus,
  filterNotesByTag,
  filterNotesBySearch,
  getNotepad,
  normalizeNotepads,
  renameNotepad,
  updateNotepadContent,
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
  normalizeChecklist,
  checklistProgress,
  attachmentsForPersist,
  previewText,
  PRIORITY_OPTIONS,
  priorityLabel,
  purgeNote,
  renameTag,
  restoreNoteFromTrash,
  safeTagColor,
  setTagColor,
  setTagIcon,
  sortNotes,
  sortNotesManual,
  applyManualOrder,
  toggleNoteTag,
  updateNote,
  updateNoteInData,
} from './notes.js?v=148';
import {
  cellKey,
  colIndexToLetter,
  createSheetBlock,
  evaluateSheet,
  formatSheetDisplay,
  normalizeSheetBlocks,
  parseCellRef,
  sheetFingerprint,
} from './sheet.js?v=148';
import {
  addDayFromLast,
  ageFromBirthDate,
  appendQuickExercise,
  appendQuickMeal,
  clearDayValues,
  formatMealCell,
  parseQuickExercise,
  parseQuickMeal,
  computeTotals,
  computeHealthSnapshot,
  computeWeekSummary,
  expandMealsForEdit,
  formatDateDisplay,
  formatSigned,
  mealColumnCount,
  MIN_MEAL_SLOTS,
  monthKeyFromDate,
  normalizeCalorie,
  normalizeMeals,
  normalizeTrendDays,
  patchDay,
  pruneFrequentMus,
  renderCalorieMealHeaderHtml,
  renderCalorieRowsHtml,
  renderCalorieTotalsHtml,
  renderHealthSheetHtml,
  renderWeekDashHtml,
  thaiDayName,
  toDateKey,
  topFrequent,
  totalsForMonth,
} from './calorie.js?v=192';
import {
  applyTextPrefsToTextarea,
  clampFontSize,
  DEFAULT_TEXT_PREFS,
  handleTextareaEnterIndent,
  handleTextareaTab,
  normalizeTextPrefs,
} from './note-text.js?v=148';
import { bindComposableInput } from './text-input.js?v=148';
import {
  completeOrAdvanceNote,
  countNotesByRecurrence,
  filterNotesByRecurrence,
  fromDatetimeLocalValue,
  getScheduleStatus,
  scheduleProximity,
  normalizeRecurrence,
  normalizeRecurrenceFilter,
  normalizeRemindBefore,
  normalizeNotifyRepeat,
  remindBeforeLabel,
  notifyRepeatLabel,
  recurrenceLabel,
  monthIntervalFromId,
  buildRecurrenceSelectOptions,
  buildNotifyRepeatSelectOptions,
  buildRecurrenceChipOptions,
  buildRecurrenceFilterOptions,
  normalizeMonthPresets,
  relativeDayLabel,
  shortDate,
  sortNotesBySchedule,
  toDatetimeLocalValue,
  defaultDatetimeLocalValue,
  defaultScheduleIso,
  snoozeNote,
  snoozeNoteTo,
  snoozeScheduledAt,
  SNOOZE_OPTIONS,
  normalizeSnoozeId,
  filterNotesByDueScope,
  normalizeDueScope,
  DUE_SCOPE_OPTIONS,
  buildMonthGrid,
  monthLabel,
  monthNameOnly,
  yearLabel,
  notesOnDate,
  dateKeyFromDate,
} from './schedule.js?v=148';
import { densityToCssUnit, loadSettings, normalizeNotifyPrefs, normalizeGeminiModel, normalizeFilterOrder, normalizeAiProfile, normalizeAiTagRules, normalizeCameraQuality, normalizeCameraFacing, normalizeCameraSaveToDevice, normalizePriorityColors, normalizeDueColors, normalizeCalorieTones, calorieToneCssVars, normalizeCardDisplay, DEFAULT_CARD_DISPLAY, DEFAULT_PRIORITY_COLORS, DEFAULT_DUE_COLORS, DEFAULT_CALORIE_TONES, FIXED_UI, saveSettings, thicknessStyleVars, dockScaleToCss, dockOffsetYToLiftPx, touchRecentNotepadId } from './settings.js?v=192';
import {
  allIcons,
  bestIconForLabel,
  DEFAULT_PRIORITY_ICONS,
  iconSvg,
  normalizeIconId,
  normalizePriorityIcons,
  suggestIconsForLabel,
} from './icons.js?v=148';
import {
  notificationPermission,
  notificationSupported,
  registerNotifyServiceWorker,
  requestNotificationPermission,
  sendTestNotification,
  syncNoteNotifications,
  startNotifyKeepalive,
} from './note-notify.js?v=122';
import {
  uploadFileToCloud,
  getDownloadUrl,
  deleteCloudFile,
} from './files.js?v=148';

/** Lazy modules — loaded on first use to speed first paint. */
let geminiModPromise = null;
let cameraModPromise = null;
let userContextModPromise = null;
function loadGeminiMod() {
  if (!geminiModPromise) geminiModPromise = import('./gemini.js?v=148');
  return geminiModPromise;
}
function loadCameraMod() {
  if (!cameraModPromise) cameraModPromise = import('./camera.js?v=148');
  return cameraModPromise;
}
function loadUserContextMod() {
  if (!userContextModPromise) userContextModPromise = import('./user-context.js?v=148');
  return userContextModPromise;
}


/** Lightweight title cleanup for list paint (avoids loading gemini.js). */
function stripLeadingEmoji(title) {
  let t = String(title || '').trim();
  if (!t) return '';
  try {
    t = t
      .replace(/^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\s*)+/u, '')
      .trim();
  } catch {
    /* ignore */
  }
  return t.slice(0, 120);
}

function refreshUserContextLazy(data) {
  return loadUserContextMod()
    .then((m) => m.refreshUserContext(data))
    .catch(() => ({ md: '', tagCount: 0, noteCount: 0 }));
}
import { DEFAULT_BAR_LAYOUT } from './bars.js?v=122';
import {
  fetchRemoteNotes,
  getSpaceId,
  getPreviousSpaceId,
  clearPreviousSpaceId,
  pushRemoteNotes,
  SHARED_SPACE_ID,
} from './remote.js?v=154';
import { normalizeNotesData } from './notes.js?v=148';
import { SaveManager } from './sync.js?v=154';
import { NOTE_APP_VERSION, getAppBuild, formatAppBuildLabel, formatAppBuiltAt } from './version.js?v=153';

const state = {
  notesData: { version: 8, updatedAt: '', tags: [], notes: [], workspaces: [], notepads: [], calorie: null },
  settings: loadSettings(),
  appMode: function() {
    const m = loadSettings().appMode;
    return (m === 'note' || m === 'calendar' || m === 'calorie') ? m : 'work';
  }(),
  /** True after first successful Firestore pull this session — gates cloud writes. */
  cloudHydrated: false,
  /** Calendar view state (Apple-style: vertical months + year zoom) */
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  calendarSelectedDate: null,
  /** 'month' | 'year' */
  calendarZoom: 'month',
  calendarScrollRange: null,
  /** Calorie sub-pane: 'log' (home) | 'health' (summary sheet) */
  caloriePane: 'log',
  /** Health trend chart window (days), e.g. 1 / 3 / 7 / 90 / 365 */
  calorieTrendDays: 7,
  /** Active month key (YYYY-MM) for calorie summary strip */
  calorieActiveMonth: null,
  activeNotepadId: null,
  /** Draft sheet blocks while editing a notepad (insertable Excel-like modules). */
  editorSheets: [],
  /** Per-notepad text prefs (font size / code mode / tab) — remembered with that title. */
  editorTextPrefs: { ...DEFAULT_TEXT_PREFS },
  sheetFocus: null, // { sheetId, key }
  activeNoteId: null,
  tagFilterId: null,
  priorityFilter: null,
  recurrenceFilter: null,
  dueScope: null,
  searchQuery: '',
  listGroup: NOTE_STATUS.ACTIVE,
  sortMode: 'updated',
  view: 'list',
  spaceId: null,
  online: false,
  authUser: null,
  syncBaseUpdatedAt: null,
  contextNoteId: null,
  draftNoteId: null,
  tagReorderMode: false,
  selectionMode: false,
  selectedIds: new Set(),
};

const saveManager = new SaveManager();
let statusTimer = null;

const els = {
  boardTopbar: document.getElementById('board-topbar'),
  listView: document.getElementById('list-view'),
  editorView: document.getElementById('editor-view'),
  notesList: document.getElementById('notes-list'),
  emptyState: document.getElementById('empty-state'),
  emptyStateText: document.getElementById('empty-state-text'),
  emptyAddBlankBtn: document.getElementById('empty-add-blank-btn'),
  emptyAddAiBtn: document.getElementById('empty-add-ai-btn'),
  searchToggleBtn: document.getElementById('search-toggle-btn'),
  noteSearchRow: document.getElementById('note-search-row'),
  noteSearchInput: document.getElementById('note-search-input'),
  noteSearchClear: document.getElementById('note-search-clear'),
  addBlankBtn: null,
  undoFabBtn: document.getElementById('undo-fab-btn'),
  actionToast: document.getElementById('action-toast'),
  actionToastMsg: document.getElementById('action-toast-msg'),
  actionToastUndo: document.getElementById('action-toast-undo'),
  snoozePickOverlay: document.getElementById('snooze-pick-overlay'),
  snoozePickInput: document.getElementById('snooze-pick-input'),
  snoozePickCancel: document.getElementById('snooze-pick-cancel'),
  snoozePickOk: document.getElementById('snooze-pick-ok'),
  filterDueBtn: document.getElementById('filter-due-btn'),
  filterDueMenu: document.getElementById('filter-due-menu'),
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
  inAppCamera: document.getElementById('in-app-camera'),
  inAppCameraVideo: document.getElementById('in-app-camera-video'),
  inAppCameraStatus: document.getElementById('in-app-camera-status'),
  inAppCameraClose: document.getElementById('in-app-camera-close'),
  inAppCameraSettings: document.getElementById('in-app-camera-settings'),
  inAppCameraFlip: document.getElementById('in-app-camera-flip'),
  inAppCameraShutter: document.getElementById('in-app-camera-shutter'),
  cameraQuality: document.getElementById('camera-quality'),
  cameraFacing: document.getElementById('camera-facing'),
  cameraSaveSeg: document.getElementById('camera-save-seg'),
  cameraSettingsRow: document.getElementById('camera-settings-row'),
  boxColorsSettingsRow: document.getElementById('box-colors-settings-row'),
  priorityColorGrid: document.getElementById('priority-color-grid'),
  dueColorGrid: document.getElementById('due-color-grid'),
  resetBoxColorsBtn: document.getElementById('reset-box-colors-btn'),
  gotoTagColorsBtn: document.getElementById('goto-tag-colors-btn'),
  tagsSettingsRow: document.getElementById('tags-settings-row'),
  aiNoteStatus: null,
  aiNoteCancelBtn: document.getElementById('ai-note-cancel-btn'),
  aiNoteDeleteBtn: document.getElementById('ai-note-delete-btn'),
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
  filterDockFiltersWrap: document.getElementById('filter-dock-filters'),
  dockModeWork: document.getElementById('dock-mode-work'),
  dockModeNote: document.getElementById('dock-mode-note'),
  dockModeCalendar: document.getElementById('dock-mode-calendar'),
  notepadQuickBar: document.getElementById('notepad-quick-bar'),
  notepadQuickScroll: document.getElementById('notepad-quick-scroll'),
  floatTagRail: document.getElementById('float-tag-rail'),
  floatTagIcons: document.getElementById('float-tag-icons'),
  aiNoteFocusTitleBtn: document.getElementById('ai-note-focus-title-btn'),
  filterSortBtn: document.getElementById('filter-sort-btn'),
  filterSortMenu: document.getElementById('filter-sort-menu'),
  filterPriorityBtn: document.getElementById('filter-priority-btn'),
  filterPriorityMenu: document.getElementById('filter-priority-menu'),
  filterRecurrenceBtn: document.getElementById('filter-recurrence-btn'),
  filterRecurrenceMenu: document.getElementById('filter-recurrence-menu'),
  filterTagBtn: document.getElementById('filter-tag-btn'),
  filterTagMenu: document.getElementById('filter-tag-menu'),
  filterDdBackdrop: document.getElementById('filter-dd-backdrop'),
  selectionDock: document.getElementById('selection-dock'),
  selectionCancelBtn: document.getElementById('selection-cancel-btn'),
  selectionCountLabel: document.getElementById('selection-count-label'),
  selectionDockActions: document.getElementById('selection-dock-actions'),
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
  noteTextBar: document.getElementById('note-text-bar'),
  noteTextSmaller: document.getElementById('note-text-smaller'),
  noteTextLarger: document.getElementById('note-text-larger'),
  noteTextCode: document.getElementById('note-text-code'),
  noteTextTab2: document.getElementById('note-text-tab-2'),
  noteTextTab4: document.getElementById('note-text-tab-4'),
  notepadSheetBlocks: document.getElementById('notepad-sheet-blocks'),
  notepadAddSheetBtn: document.getElementById('notepad-add-sheet-btn'),
  notepadSheetHint: document.getElementById('notepad-sheet-hint'),
  noteSchedule: document.getElementById('note-schedule'),
  noteRemindBefore: document.getElementById('note-remind-before'),
  noteNotifyRepeat: document.getElementById('note-notify-repeat'),
  noteNotifyPreview: document.getElementById('note-notify-preview'),
  noteNotifyDetails: document.getElementById('note-notify-details'),
  editorRecurrence: document.getElementById('editor-recurrence'),
  clearScheduleBtn: document.getElementById('clear-schedule-btn'),
  editorTags: document.getElementById('editor-tags'),
  editorSaveDot: document.getElementById('editor-save-dot'),
  syncStatusBtn: document.getElementById('sync-status-btn'),
  syncStatusTip: document.getElementById('sync-status-tip'),
  editorSyncStatusBtn: null,
  editorSyncStatusTip: null,
  modeSwitchBtn: document.getElementById('mode-switch-btn'),
  modeSwitchName: document.getElementById('mode-switch-name'),
  modeMenuOverlay: document.getElementById('modeMenuOverlay'),
  modeMenuWork: document.getElementById('mode-menu-work'),
  modeMenuNote: document.getElementById('mode-menu-note'),
  modeMenuCalendar: document.getElementById('mode-menu-calendar'),
  notepadMenuSection: document.getElementById('notepad-menu-section'),
  notepadMenuList: document.getElementById('notepad-menu-list'),
  notepadAddBtn: document.getElementById('notepad-add-btn'),
  listPreviewTitleBtn: document.getElementById('list-preview-title-btn'),
  listPreviewContentBtn: document.getElementById('list-preview-content-btn'),
  tagModal: null,
  tagAddForm: document.getElementById('tag-add-form'),
  newTagInput: document.getElementById('new-tag-input'),
  tagManagerList: document.getElementById('tag-manager-list'),
  cardDisplaySettingsRow: document.getElementById('card-display-settings-row'),
  cardLeadIconSeg: document.getElementById('card-lead-icon-seg'),
  cardIconColorSeg: document.getElementById('card-icon-color-seg'),
  cardIconColorCustom: document.getElementById('card-icon-color-custom'),
  priorityIconColorGrid: document.getElementById('priority-icon-color-grid'),
  priorityIconGrid: document.getElementById('priority-icon-grid'),
  iconPickerOverlay: document.getElementById('icon-picker-overlay'),
  iconPickerBackdrop: document.getElementById('icon-picker-backdrop'),
  iconPickerTitle: document.getElementById('icon-picker-title'),
  iconPickerHint: document.getElementById('icon-picker-hint'),
  iconPickerSuggest: document.getElementById('icon-picker-suggest'),
  iconPickerAll: document.getElementById('icon-picker-all'),
  iconPickerCloseBtn: document.getElementById('icon-picker-close-btn'),
  closeTagModalBtn: null,
  tagsSettingsRow: document.getElementById('tags-settings-row'),
  settingsOverlay: document.getElementById('settings-overlay'),
  settingsBackdrop: document.getElementById('settings-backdrop'),
  cardDensitySlider: document.getElementById('card-density-slider'),
  themeDarkBtn: document.getElementById('theme-dark-btn'),
  themeLightBtn: document.getElementById('theme-light-btn'),
  filterOrderList: document.getElementById('filter-order-list'),
  notifyOffBtn: document.getElementById('notify-off-btn'),
  notifyOnBtn: document.getElementById('notify-on-btn'),
  notifyHint: document.getElementById('notify-hint'),
  notifyOptions: document.getElementById('notify-options'),
  notifyLabel: document.getElementById('notify-label'),
  notifyEarly: document.getElementById('notify-early'),
  notifyMinPriority: document.getElementById('notify-min-priority'),
  notifyMonthPresets: document.getElementById('notify-month-presets'),
  notifyTagChips: document.getElementById('notify-tag-chips'),
  notifyTestBtn: document.getElementById('notify-test-btn'),
  thicknessSort: document.getElementById('thickness-sort'),
  thicknessTag: document.getElementById('thickness-tag'),
  thicknessPriority: document.getElementById('thickness-priority'),
  thicknessRecurrence: document.getElementById('thickness-recurrence'),
  dbSyncHint: document.getElementById('db-sync-hint'),
  authAccountHint: document.getElementById('auth-account-hint'),
  signOutBtn: document.getElementById('sign-out-btn'),
  exportNotesBtn: document.getElementById('export-notes-btn'),
  importNotesBtn: document.getElementById('import-notes-btn'),
  importNotesFile: document.getElementById('import-notes-file'),
  importNotesText: document.getElementById('import-notes-text'),
  importNotesPasteBtn: document.getElementById('import-notes-paste-btn'),
  importMergeSeg: document.getElementById('import-merge-seg'),
  aiChecklistList: document.getElementById('ai-checklist-list'),
  aiChecklistAdd: document.getElementById('ai-checklist-add'),
  closeSettingsBtn: document.getElementById('close-settings-btn'),
  noteContextOverlay: document.getElementById('note-context-overlay'),
  noteContextMenu: document.getElementById('note-context-menu'),
  noteConfirmOverlay: document.getElementById('note-confirm-overlay'),
  noteConfirmBody: document.getElementById('note-confirm-body'),
  noteConfirmCancel: document.getElementById('note-confirm-cancel'),
  noteConfirmOk: document.getElementById('note-confirm-ok'),
  loadingOverlay: document.getElementById('loading-overlay'),
  authOverlay: document.getElementById('auth-overlay'),
  googleLoginBtn: document.getElementById('google-login-btn'),
  authError: document.getElementById('auth-error'),
  /* Calendar view */
  calendarView: document.getElementById('calendar-view'),
  calYearBack: document.getElementById('cal-year-back'),
  calYearLabel: document.getElementById('cal-year-label'),
  calMonthTitle: document.getElementById('cal-month-title'),
  calWeekdays: document.getElementById('cal-weekdays'),
  calScroll: document.getElementById('cal-scroll'),
  calYearView: document.getElementById('cal-year-view'),
  calNotes: document.getElementById('cal-notes'),
  calTodayBtn: document.getElementById('cal-today-btn'),
  calZoomOut: document.getElementById('cal-zoom-out'),
  calZoomIn: document.getElementById('cal-zoom-in'),
  /* Calorie spreadsheet */
  calorieView: document.getElementById('calorie-view'),
  calorieTotals: document.getElementById('calorie-totals'),
  calorieTbody: document.getElementById('calorie-tbody'),
  calorieEmpty: document.getElementById('calorie-empty'),
  calorieScroll: document.getElementById('calorie-scroll'),
  calorieAddDayBtn: document.getElementById('calorie-add-day-btn'),
  calorieProteinFactor: document.getElementById('calorie-protein-factor'),
  calorieHeight: document.getElementById('calorie-height'),
  calorieBirthdate: document.getElementById('calorie-birthdate'),
  calorieAgeDisplay: document.getElementById('calorie-age-display'),
  calorieSex: document.getElementById('calorie-sex'),
  calorieGoalWaist: document.getElementById('calorie-goal-waist'),
  calorieGoalWeight: document.getElementById('calorie-goal-weight'),
  calorieToneEat: document.getElementById('calorie-tone-eat'),
  calorieToneBurn: document.getElementById('calorie-tone-burn'),
  calorieToneEmpty: document.getElementById('calorie-tone-empty'),
  calorieToneReset: document.getElementById('calorie-tone-reset'),
  calorieThead: document.getElementById('calorie-thead'),
  calorieQuickFreq: document.getElementById('calorie-quick-freq'),
  calorieDash: document.getElementById('calorie-dash'),
  calorieHealthSheet: document.getElementById('calorie-health-sheet'),
  dockCalorieLogBtn: document.getElementById('dock-calorie-log-btn'),
  dockCalorieHealthBtn: document.getElementById('dock-calorie-health-btn'),
  calorieTodayCard: document.getElementById('calorie-today-card'),
  calorieTodayTitle: document.getElementById('calorie-today-title'),
  calorieTodaySub: document.getElementById('calorie-today-sub'),
  calorieTodayBase: document.getElementById('calorie-today-base'),
  calorieTodayBmi: document.getElementById('calorie-today-bmi'),
  calorieTodayWeight: document.getElementById('calorie-today-weight'),
  calorieTodayWaist: document.getElementById('calorie-today-waist'),
  calorieTodayMus: document.getElementById('calorie-today-mus'),
  calorieTodayMeals: document.getElementById('calorie-today-meals'),
  calorieTodaySummary: document.getElementById('calorie-today-summary'),
  calorieFabs: document.getElementById('dock-context-calorie'),
  calorieFabMeal: document.getElementById('calorie-fab-meal'),
  calorieFabMus: document.getElementById('calorie-fab-mus'),
  dockContextRail: document.getElementById('dock-context-rail'),
  calorieQuickOverlay: document.getElementById('calorie-quick-overlay'),
  calorieQuickBackdrop: document.getElementById('calorie-quick-backdrop'),
  calorieQuickTitle: document.getElementById('calorie-quick-title'),
  calorieQuickHint: document.getElementById('calorie-quick-hint'),
  calorieQuickInput: document.getElementById('calorie-quick-input'),
  calorieQuickClear: document.getElementById('calorie-quick-clear'),
  calorieQuickCancel: document.getElementById('calorie-quick-cancel'),
  calorieQuickOk: document.getElementById('calorie-quick-ok'),
  dockModeCalorie: document.getElementById('dock-mode-calorie'),
  modeMenuCalorie: document.getElementById('mode-menu-calorie'),
};

function boardHomeView() {
  return 'calorie';
}

function showView(_view) {
  // Calorie-only app — always the calorie sheet.
  const next = 'calorie';
  state.view = next;

  const onList = next === 'list';
  const onCal = next === 'calendar';
  const onCalorie = next === 'calorie';
  const onEditor = next === 'editor';

  if (els.boardTopbar) els.boardTopbar.hidden = !(onList || onCal || onCalorie);
  els.listView.hidden = !onList;
  els.editorView.hidden = !onEditor;
  if (els.calendarView) els.calendarView.hidden = !onCal;
  if (els.calorieView) els.calorieView.hidden = !onCalorie;
  if (els.notesList) els.notesList.hidden = false;
  if (onCal) renderCalendar();
  if (onCalorie) renderCalorieSheet();
  updateFilterDockVisibility();
  updateUndoFab();
  if (next !== 'editor') hideEditorSaveDot();
}

function setLoading(visible, message = 'กำลังโหลด...') {
  els.loadingOverlay.hidden = !visible;
  els.loadingOverlay.querySelector('p').textContent = message;
}

function setAuthOverlayVisible(visible) {
  if (!els.authOverlay) return;
  els.authOverlay.hidden = !visible;
  document.body.classList.toggle('auth-required', Boolean(visible));
}

function setAuthError(message = '') {
  if (!els.authError) return;
  els.authError.textContent = message || '';
  els.authError.hidden = !message;
}

function refreshAuthAccountHint() {
  if (!els.authAccountHint) return;
  if (state.authUser?.email) {
    els.authAccountHint.textContent = `เข้าสู่ระบบ: ${state.authUser.email}`;
  } else {
    els.authAccountHint.textContent = 'ยังไม่ได้เข้าสู่ระบบ — คลาวด์จะบันทึกหลังล็อกอิน';
  }
  if (els.signOutBtn) els.signOutBtn.hidden = !state.authUser;
}

function onSignedIn(user) {
  state.authUser = user;
  setAuthOverlayVisible(false);
  setAuthError('');
  refreshAuthAccountHint();
}

async function requireCloudAuth() {
  try {
    await handleAuthRedirect();
  } catch (err) {
    setAuthError(err?.message || 'ล็อกอินไม่สำเร็จ');
  }
  const user = await getAllowedUser();
  if (user) {
    onSignedIn(user);
    return user;
  }
  state.authUser = null;
  refreshAuthAccountHint();
  setAuthOverlayVisible(true);
  return null;
}

async function handleGoogleLoginClick() {
  setAuthError('');
  if (els.googleLoginBtn) els.googleLoginBtn.disabled = true;
  try {
    const user = await startLogin();
    if (!user) {
      // Redirect flow — page will reload after Google.
      setAuthError('กำลังพาไปหน้า Google…');
      return;
    }
    onSignedIn(user);
    setSyncStatus('busy', 'กำลังเชื่อมคลาวด์…');
    void syncSpaceInBackground({ force: true, announce: true });
  } catch (err) {
    setAuthError(err?.message || 'ล็อกอินไม่สำเร็จ');
  } finally {
    if (els.googleLoginBtn) els.googleLoginBtn.disabled = false;
  }
}

let undoHandler = null;
let lastUndoAction = null; // survives toast hide — used by bottom-left undo fab
let snoozePickNoteId = null;

function hideActionToast() {
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  undoHandler = null;
  if (els.actionToast) {
    els.actionToast.classList.remove('visible');
    els.actionToast.hidden = true;
  }
  if (els.actionToastUndo) els.actionToastUndo.hidden = true;
}

/** Map sync/DB / save chatter → small top-right status dot (no bottom toast). */
function syncStateFromMessage(message) {
  const t = String(message || '');
  if (!t) return null;
  // Keep real errors as toasts (return null → setStatus shows action-toast).
  if (/ไม่สำเร็จ|บันทึกไม่ได้|เพิ่มไม่ได้|โหลดไม่สำเร็จ|นำเข้าไม่สำเร็จ|ไม่พบวัน|พิมพ์.+ก่อน|ใส่แคล|ตรวจ JSON/i.test(t)) {
    return null;
  }
  if (/กำลัง(พิมพ์|บันทึก|ซิงค์|เชื่อม|โหลด)|connecting|syncing|saving/i.test(t)) return 'busy';
  if (/ออฟไลน์|เชื่อมต่อไม่ได้|offline/i.test(t)) return 'offline';
  // Routine save / sync confirmations — never pop the bottom toast.
  if (/บันทึก|อัปเดต|เคลียร์|ซิงค์|เชื่อม|ย้ายโน้ตเข้า|ฐานข้อมูล/i.test(t)) return 'ok';
  return null;
}

let syncTipTimer = null;

function setSyncStatus(state, message = '') {
  const btn = els.syncStatusBtn;
  if (!btn) return;
  const next = state || 'idle';
  btn.dataset.state = next;
  const label = String(message || '').trim() || (
    next === 'ok' ? 'เชื่อมฐานข้อมูลแล้ว'
      : next === 'busy' ? 'กำลังซิงค์…'
        : next === 'offline' ? 'ออฟไลน์ · เก็บในเครื่อง'
          : 'สถานะฐานข้อมูล'
  );
  btn.title = label;
  btn.setAttribute('aria-label', label);
  if (els.syncStatusTip) {
    els.syncStatusTip.textContent = label;
  }
  if (els.dbSyncHint) {
    els.dbSyncHint.textContent = `สถานะ: ${label}`;
  }
}

function flashSyncTip(ms = 1600) {
  const tip = els.syncStatusTip;
  if (!tip) return;
  tip.hidden = false;
  if (syncTipTimer) clearTimeout(syncTipTimer);
  syncTipTimer = setTimeout(() => {
    tip.hidden = true;
    syncTipTimer = null;
  }, ms);
}

function setDbStatusMessage(message) {
  const text = String(message || '').trim();
  if (!text) return;
  const state = syncStateFromMessage(text) || 'idle';
  setSyncStatus(state, text);
}

function setStatus(message, opts = {}) {
  const text = String(message || '').trim();
  if (!text) {
    hideActionToast();
    return;
  }
  // DB/sync chatter → quiet top-right dot (not a popup toast).
  if (!opts.forceToast && !opts.undo && syncStateFromMessage(text)) {
    setDbStatusMessage(text);
    return;
  }
  if (!els.actionToast || !els.actionToastMsg) {
    console.info('[status]', text);
    return;
  }
  if (statusTimer) clearTimeout(statusTimer);
  undoHandler = typeof opts.undo === 'function' ? opts.undo : null;
  if (undoHandler) {
    lastUndoAction = { run: undoHandler, label: text };
  }
  updateUndoFab();
  els.actionToastMsg.textContent = text;
  if (els.actionToastUndo) {
    els.actionToastUndo.hidden = !undoHandler;
  }
  els.actionToast.hidden = false;
  requestAnimationFrame(() => els.actionToast?.classList.add('visible'));
  const ms = Number.isFinite(opts.ms) ? opts.ms : undoHandler ? 5200 : 2800;
  statusTimer = setTimeout(() => hideActionToast(), ms);
}

function canUndo() {
  return Boolean(undoHandler || lastUndoAction?.run);
}

function updateUndoFab() {
  const btn = els.undoFabBtn;
  if (!btn) return;
  // Calendar has its own bottom toolbar (Today / zoom); keep undo off that sheet
  const show = state.view === 'list';
  btn.hidden = !show;
  btn.disabled = !canUndo();
  btn.setAttribute('aria-disabled', btn.disabled ? 'true' : 'false');
  if (lastUndoAction?.label) {
    btn.title = `เลิกทำ: ${lastUndoAction.label}`;
  } else {
    btn.title = 'เลิกทำล่าสุด';
  }
}

function runUndo() {
  const fn = undoHandler || lastUndoAction?.run;
  hideActionToast();
  lastUndoAction = null;
  updateUndoFab();
  if (fn) fn();
}

function autosave() {
  saveManager.scheduleSave(() => state.notesData);
  refreshNoteNotifications();
  scheduleUserContextRefresh();
  flashEditorSaveDot();
}

let editorSaveDotTimer = null;
function flashEditorSaveDot() {
  if (state.view !== 'editor' || !els.editorSaveDot) return;
  els.editorSaveDot.hidden = false;
  if (editorSaveDotTimer) clearTimeout(editorSaveDotTimer);
  editorSaveDotTimer = setTimeout(() => {
    hideEditorSaveDot();
  }, 1600);
}

function hideEditorSaveDot() {
  if (editorSaveDotTimer) {
    clearTimeout(editorSaveDotTimer);
    editorSaveDotTimer = null;
  }
  if (els.editorSaveDot) els.editorSaveDot.hidden = true;
}

let userContextTimer = null;
function scheduleUserContextRefresh() {
  if (userContextTimer) clearTimeout(userContextTimer);
  userContextTimer = setTimeout(() => {
    refreshUserContextLazy(state.notesData).catch((err) => {
      console.warn('user context refresh failed', err);
    });
  }, 900);
}

async function fillAiContextPreview() {
  if (!els.aiContextPreview) return;
  try {
    const m = await loadUserContextMod();
    const learned = m.loadUserContextMd() || m.refreshUserContext(state.notesData).md;
    els.aiContextPreview.textContent =
      m.composeAiMemoryMd(learned, state.settings) || '(ยังไม่มีความจำ)';
  } catch {
    els.aiContextPreview.textContent = '(ยังไม่มีความจำ)';
  }
}

async function currentAiMemoryMd() {
  try {
    const m = await loadUserContextMod();
    const learned = m.loadUserContextMd() || m.refreshUserContext(state.notesData).md;
    return m.composeAiMemoryMd(learned, state.settings);
  } catch {
    return '';
  }
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
  if (state.view !== 'editor') return;
  if (state.activeNotepadId) {
    flushNotepadToState();
    autosave();
    return;
  }
  if (!state.activeNoteId) return;
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
  const unit = densityToCssUnit(FIXED_UI.cardDensity);
  els.listView?.style.setProperty('--card-density', String(unit));
}

function applyDockScale() {
  const scale = dockScaleToCss(FIXED_UI.dockScale);
  const lift = dockOffsetYToLiftPx(FIXED_UI.dockOffsetY);
  if (els.filterDock) {
    els.filterDock.style.setProperty('--dock-scale', String(scale));
    els.filterDock.style.setProperty('--dock-lift', `${lift}px`);
  }
  applyDockOffset();
  requestAnimationFrame(applyDockOffset);
}

function applyTheme() {
  document.body.classList.add('light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#e8f0ea');
  applyBoxColors();
  applyCalorieTones();
}

function applyBoxColors() {
  const prio = { ...DEFAULT_PRIORITY_COLORS };
  const due = { ...DEFAULT_DUE_COLORS };
  state.settings.priorityColors = prio;
  state.settings.dueColors = due;
  const root = document.documentElement;
  root.style.setProperty('--prio-normal', prio.normal);
  root.style.setProperty('--prio-important', prio.important);
  root.style.setProperty('--prio-urgent', prio.urgent);
  root.style.setProperty('--prio-critical', prio.critical);
  root.style.setProperty('--due-far', due.far);
  root.style.setProperty('--due-mid', due.mid);
  root.style.setProperty('--due-near', due.near);
  root.style.setProperty('--due-today', due.today);
  root.style.setProperty('--due-overdue', due.overdue);
}

function calorieToneTargets() {
  return [
    document.documentElement,
    document.body,
    document.getElementById('calorie-view'),
    document.querySelector('.calorie-table'),
    document.getElementById('tone-settings-row'),
  ].filter(Boolean);
}

function applyCalorieTones() {
  const tones = normalizeCalorieTones(state.settings?.calorieTones);
  if (state.settings) state.settings.calorieTones = tones;
  const vars = calorieToneCssVars(tones);
  calorieToneTargets().forEach((el) => {
    Object.entries(vars).forEach(([key, value]) => {
      el.style.setProperty(key, value);
    });
  });
  if (els.calorieToneEat && document.activeElement !== els.calorieToneEat) {
    els.calorieToneEat.value = tones.eat;
  }
  if (els.calorieToneBurn && document.activeElement !== els.calorieToneBurn) {
    els.calorieToneBurn.value = tones.burn;
  }
  if (els.calorieToneEmpty && document.activeElement !== els.calorieToneEmpty) {
    els.calorieToneEmpty.value = tones.empty;
  }
  // Live swatches in Settings so the user sees the change immediately.
  document.querySelectorAll('[data-tone-swatch]').forEach((node) => {
    const key = node.getAttribute('data-tone-swatch');
    if (key && tones[key]) node.style.background = tones[key];
  });
}

function persistCalorieTonesFromUi({ reset = false } = {}) {
  const next = reset
    ? { ...DEFAULT_CALORIE_TONES }
    : normalizeCalorieTones({
      eat: els.calorieToneEat?.value,
      burn: els.calorieToneBurn?.value,
      empty: els.calorieToneEmpty?.value,
    });
  state.settings.calorieTones = next;
  saveSettings(state.settings);
  // Re-read from disk to prove persistence round-trip.
  state.settings.calorieTones = normalizeCalorieTones(loadSettings().calorieTones);
  applyCalorieTones();
}

function applyFilterOrder() {
  const cluster = els.filterDockFilters;
  if (!cluster) return;
  const order = normalizeFilterOrder(FIXED_UI.filterOrder);
  state.settings.filterOrder = order;
  order.forEach((id) => {
    const el = cluster.querySelector(`.filter-dd[data-filter="${CSS.escape(id)}"]`);
    if (el) cluster.appendChild(el);
  });
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
    els.notifyLabel.value = prefs.label || 'แคลโน้ต';
  }
  if (els.notifyEarly) els.notifyEarly.value = String(prefs.earlyMinutes || 0);
  if (els.notifyMinPriority) els.notifyMinPriority.value = prefs.minPriority || 'normal';
  if (els.notifyMonthPresets && document.activeElement !== els.notifyMonthPresets) {
    els.notifyMonthPresets.value = getMonthPresets().join(', ');
  }

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
      'โน้ตที่มีกำหนดเวลาจะเด้งแจ้งเตือนระบบ · แนะนำติดตั้ง แคลโน้ต บนหน้าจอโฮม';
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
  const bt = FIXED_UI.barThickness;
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

function isNoteMode() {
  return state.appMode === 'note';
}

function isCalendarMode() {
  return state.appMode === 'calendar';
}

function isCalorieMode() {
  return state.appMode === 'calorie';
}

function notesForCurrentGroup() {
  // งานหลัก: all task notes (workspaces no longer split the work board)
  return filterNotesByStatus(state.notesData.notes, state.listGroup);
}

function ensureCaloriePayload() {
  const cal = normalizeCalorie(state.notesData.calorie);
  if (state.notesData.calorie !== cal) {
    state.notesData = { ...state.notesData, calorie: cal };
  }
  return cal;
}

function persistCalorie(nextCalorie, { status = '', fullRender = false, immediate = true } = {}) {
  const now = new Date().toISOString();
  // Always stamp calorie.updatedAt so cloud merge keeps profile/goals (height etc.)
  // instead of letting a newer remote sheet meta overwrite local choices.
  state.notesData = {
    ...state.notesData,
    calorie: normalizeCalorie({ ...nextCalorie, updatedAt: now }),
    updatedAt: now,
  };
  // Standard: write local + cloud immediately (no debounce race with sync).
  if (immediate) {
    void saveManager.saveNow(() => state.notesData).catch(() => {
      /* local already written inside SaveManager; cloud may retry */
    });
  } else {
    saveManager.scheduleSave(() => state.notesData);
  }
  if (status) setStatus(status);
  if (!isCalorieMode()) return;
  if (state.caloriePane === 'health') {
    paintCalorieHealthSheet(ensureCaloriePayload());
    return;
  }
  if (fullRender) renderCalorieSheet();
  else refreshCalorieDerived();
}

/** Read body-profile / goals from Settings inputs (null = unchanged / invalid skip). */
function readCalorieProfileFromUi(sheet) {
  const pf = Number(els.calorieProteinFactor?.value);
  const height = Number(els.calorieHeight?.value);
  const birthDate = String(els.calorieBirthdate?.value || '').trim();
  const sex = els.calorieSex?.value === 'female' ? 'female' : 'male';
  const goalWaistRaw = String(els.calorieGoalWaist?.value || '').trim();
  const goalWeightRaw = String(els.calorieGoalWeight?.value || '').trim();
  const goalWaistCm = goalWaistRaw === '' ? null : Number(goalWaistRaw);
  const goalWeightKg = goalWeightRaw === '' ? null : Number(goalWeightRaw);
  return {
    ...sheet,
    proteinFactor: Number.isFinite(pf) ? pf : sheet.proteinFactor,
    heightCm: Number.isFinite(height) ? height : sheet.heightCm,
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate : sheet.birthDate,
    sex,
    goalWaistCm: goalWaistRaw === '' || !Number.isFinite(goalWaistCm) ? null : goalWaistCm,
    goalWeightKg: goalWeightRaw === '' || !Number.isFinite(goalWeightKg) ? null : goalWeightKg,
  };
}

function calorieProfileChanged(before, after) {
  if (!before || !after) return true;
  return (
    before.heightCm !== after.heightCm
    || before.proteinFactor !== after.proteinFactor
    || before.birthDate !== after.birthDate
    || before.sex !== after.sex
    || before.goalWaistCm !== after.goalWaistCm
    || before.goalWeightKg !== after.goalWeightKg
  );
}

/** Immediate local + cloud save for Settings profile/goals. */
function flushCalorieProfileFromUi({ status = '', force = false } = {}) {
  const sheet = ensureCaloriePayload();
  const next = readCalorieProfileFromUi(sheet);
  if (!force && !calorieProfileChanged(sheet, next)) return false;
  persistCalorie(next, { status, fullRender: true, immediate: true });
  return true;
}

function calorieToneClass(n) {
  if (n == null || !Number.isFinite(n) || n === 0) return 'is-zero';
  return n > 0 ? 'is-pos' : 'is-neg';
}

function setDerivedCell(td, text, valueForTone = null) {
  if (!td) return;
  td.textContent = text == null ? '' : String(text);
  td.classList.remove('is-pos', 'is-neg', 'is-zero');
  if (valueForTone != null) td.classList.add(calorieToneClass(valueForTone));
}

function paintCalorieMonthTotals(monthKey) {
  const info = totalsForMonth(ensureCaloriePayload(), monthKey);
  state.calorieActiveMonth = info.monthKey;
  if (els.calorieTotals) {
    els.calorieTotals.innerHTML = renderCalorieTotalsHtml(info.totals, {
      monthLabel: info.label,
    });
  }
  return info;
}

/** Pick month from the top-most visible day row while scrolling. */
function syncCalorieMonthFromScroll() {
  if (!els.calorieScroll || !els.calorieTbody) return;
  const scrollTop = els.calorieScroll.scrollTop;
  const headerH = els.calorieScroll.querySelector('thead')?.getBoundingClientRect?.().height || 20;
  const probe = scrollTop + headerH + 8;
  const rows = els.calorieTbody.querySelectorAll('tr.cal-day-a[data-month]');
  if (!rows.length) {
    paintCalorieMonthTotals(monthKeyFromDate(toDateKey()));
    return;
  }
  let active = rows[0].dataset.month;
  for (const tr of rows) {
    if (tr.offsetTop <= probe) active = tr.dataset.month || active;
    else break;
  }
  if (active && active !== state.calorieActiveMonth) {
    paintCalorieMonthTotals(active);
  }
}

function syncCalorieProfileInputs(sheet) {
  if (els.calorieProteinFactor && document.activeElement !== els.calorieProteinFactor) {
    els.calorieProteinFactor.value = String(sheet.proteinFactor);
  }
  if (els.calorieHeight && document.activeElement !== els.calorieHeight) {
    els.calorieHeight.value = String(sheet.heightCm ?? '');
  }
  if (els.calorieBirthdate && document.activeElement !== els.calorieBirthdate) {
    els.calorieBirthdate.value = sheet.birthDate || '';
  }
  if (els.calorieAgeDisplay) {
    const age = ageFromBirthDate(sheet.birthDate, new Date());
    els.calorieAgeDisplay.textContent =
      age != null ? `อายุ ${age} ปี (จากวันเกิด)` : 'อายุ — ปี';
  }
  if (els.calorieSex && document.activeElement !== els.calorieSex) {
    els.calorieSex.value = sheet.sex === 'female' ? 'female' : 'male';
  }
  if (els.calorieGoalWaist && document.activeElement !== els.calorieGoalWaist) {
    els.calorieGoalWaist.value =
      sheet.goalWaistCm == null ? '' : String(sheet.goalWaistCm);
  }
  if (els.calorieGoalWeight && document.activeElement !== els.calorieGoalWeight) {
    els.calorieGoalWeight.value =
      sheet.goalWeightKg == null ? '' : String(sheet.goalWeightKg);
  }
}

function paintCalorieDash(sheet) {
  const el = els.calorieDash;
  if (!el) return;
  if (state.caloriePane === 'health') {
    el.hidden = true;
    return;
  }
  const summary = computeWeekSummary(sheet);
  if (!summary.daysLogged) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  el.innerHTML = renderWeekDashHtml(summary);
}

function paintCalorieHealthSheet(sheet) {
  const el = els.calorieHealthSheet;
  if (!el) return;
  if (state.caloriePane !== 'health') {
    el.hidden = true;
    return;
  }
  const days = normalizeTrendDays(state.calorieTrendDays, 7);
  state.calorieTrendDays = days;
  const snap = computeHealthSnapshot(sheet, toDateKey(), days);
  el.hidden = false;
  el.innerHTML = renderHealthSheetHtml(snap);
}

function setCaloriePane(pane) {
  state.caloriePane = pane === 'health' ? 'health' : 'log';
  document.body.classList.toggle('calorie-health-pane', state.caloriePane === 'health');
  if (els.dockCalorieLogBtn) els.dockCalorieLogBtn.hidden = state.caloriePane !== 'health';
  if (els.dockCalorieHealthBtn) els.dockCalorieHealthBtn.hidden = state.caloriePane === 'health';
  if (state.caloriePane === 'health') {
    if (els.calorieTodayCard) els.calorieTodayCard.hidden = true;
    if (els.calorieDash) els.calorieDash.hidden = true;
    if (els.calorieScroll) els.calorieScroll.hidden = true;
    paintCalorieHealthSheet(ensureCaloriePayload());
    syncCalorieFabs();
  } else {
    if (els.calorieScroll) els.calorieScroll.hidden = false;
    if (els.calorieHealthSheet) els.calorieHealthSheet.hidden = true;
    renderCalorieSheet();
  }
  applyDockOffset();
}

function paintCalorieTodayCard(rows, sheet) {
  const card = els.calorieTodayCard;
  if (!card) return;
  const todayKey = toDateKey();
  let row = rows.find((r) => r.date === todayKey);
  if (!row && rows.length) row = rows[0]; // newest day if today missing
  if (!row) {
    card.hidden = true;
    card.dataset.dayId = '';
    return;
  }
  card.hidden = false;
  card.dataset.dayId = row.id;
  const isToday = row.date === todayKey;
  if (els.calorieTodayTitle) {
    els.calorieTodayTitle.textContent = isToday ? 'วันนี้' : 'วันล่าสุด';
  }
  if (els.calorieTodaySub) {
    els.calorieTodaySub.textContent = `${row.dateDisplay || formatDateDisplay(row.date)} · ${row.dayName || thaiDayName(row.date)}`;
  }
  const m = row.metrics || {};
  if (els.calorieTodayBase) els.calorieTodayBase.textContent = `base ${m.base ?? '—'}`;
  if (els.calorieTodayBmi) {
    els.calorieTodayBmi.textContent = m.bmi != null ? `BMI ${m.bmi}` : 'BMI —';
  }
  const fillIfIdle = (input, value) => {
    if (!input || document.activeElement === input) return;
    input.value = value == null || value === '' ? '' : String(value);
  };
  fillIfIdle(els.calorieTodayWeight, row.weight);
  fillIfIdle(els.calorieTodayWaist, row.waist);
  fillIfIdle(els.calorieTodayMus, row.mus);
  const syncClearWrap = (input) => {
    const wrap = input?.closest?.('.cal-input-wrap, .ctc-field-wrap');
    if (!wrap) return;
    const has = String(input.value || '').trim() !== '';
    wrap.classList.toggle('has-value', has);
  };
  syncClearWrap(els.calorieTodayWeight);
  syncClearWrap(els.calorieTodayWaist);
  syncClearWrap(els.calorieTodayMus);
  if (els.calorieTodayMeals && document.activeElement?.closest?.('#calorie-today-meals') == null) {
    const meals = expandMealsForEdit(row.meals);
    const cols = Math.max(meals.length, MIN_MEAL_SLOTS);
    els.calorieTodayMeals.innerHTML = Array.from({ length: cols }, (_, i) => {
      const v = meals[i] || '';
      const has = v ? ' has-value' : '';
      return `<label class="ctc-meal cal-input-wrap${has}" data-n="${i + 1}"><input data-ctc-meal="${i}" value="${String(v).replace(/"/g, '&quot;')}" inputmode="decimal" autocomplete="off" spellcheck="false" readonly aria-label="มื้อ ${i + 1}" placeholder="${i + 1}" title="แตะเพื่อแก้ / เคลียร์แล้วบันทึก"></label>`;
    }).join('');
  }
  if (els.calorieTodaySummary) {
    const items = [
      ['cal', m.addCal, null],
      ['P', m.prot, null],
      ['bal', m.balance == null ? null : formatSigned(m.balance, 0), m.balance],
      ['Σ', m.bsum, null],
      ['mus', m.mus, null],
    ];
    els.calorieTodaySummary.innerHTML = items
      .map(([label, val, tone]) => {
        const cls =
          tone == null || !Number.isFinite(tone) || tone === 0
            ? ''
            : tone > 0
              ? 'is-pos'
              : 'is-neg';
        return `<span class="${cls}">${label} <strong>${val == null || val === '' ? '—' : val}</strong></span>`;
      })
      .join('');
  }
}

/** Update monthly totals + derived columns without destroying inputs. */
function refreshCalorieDerived() {
  if (!els.calorieTbody) return;
  const { sheet, rows } = computeTotals(ensureCaloriePayload());
  paintCalorieMonthTotals(state.calorieActiveMonth);
  syncCalorieProfileInputs(sheet);
  paintCalorieDash(sheet);
  paintCalorieTodayCard(rows, sheet);
  if (els.calorieEmpty) els.calorieEmpty.hidden = rows.length > 0;
  rows.forEach((row) => {
    const trA = els.calorieTbody.querySelector(`tr.cal-day-a[data-day-id="${CSS.escape(row.id)}"]`);
    const trB = els.calorieTbody.querySelector(`tr.cal-day-b[data-day-id="${CSS.escape(row.id)}"]`);
    if (!trA) return;
    const m = row.metrics;
    const dayCell = trA.querySelector('.cal-col-day');
    if (dayCell) dayCell.textContent = row.dayName || '';
    const dateBtn = trA.querySelector('.cal-date-btn');
    if (dateBtn) dateBtn.textContent = row.dateDisplay || formatDateDisplay(row.date);
    const cell = (tr, key) => tr?.querySelector(`[data-cal-derived="${key}"]`);
    setDerivedCell(cell(trA, 'addCal'), m.addCal ?? '', null);
    setDerivedCell(cell(trA, 'prot'), m.prot ?? '', null);
    setDerivedCell(
      cell(trA, 'pRm'),
      m.pRm == null ? '' : formatSigned(m.pRm, 1),
      m.pRm,
    );
    setDerivedCell(
      cell(trA, 'balance'),
      m.balance == null ? '' : formatSigned(m.balance, 0),
      m.balance,
    );
    setDerivedCell(
      cell(trA, 'blKg'),
      m.blKg == null ? '' : formatSigned(m.blKg, 2),
      m.blKg,
    );
    setDerivedCell(cell(trB, 'base'), m.base ?? '', null);
    setDerivedCell(cell(trB, 'bsum'), m.bsum ?? '', null);
    setDerivedCell(
      cell(trB, 'pctBl'),
      m.pctBl == null ? '' : `${m.pctBl}%`,
      m.pctBl,
    );
  });
}

function renderCalorieSheet() {
  if (!els.calorieTbody) return;
  // Keep a today row ready so the vertical card is always loggable.
  {
    const { sheet: withToday, created } = addDayFromLast(ensureCaloriePayload(), toDateKey());
    if (created) {
      state.notesData = {
        ...state.notesData,
        calorie: normalizeCalorie(withToday),
        updatedAt: new Date().toISOString(),
      };
      // Local only until Firestore has been pulled — never let a blank today
      // race ahead and setDoc-wipe the shared cloud space.
      saveNotes(state.notesData);
      if (state.cloudHydrated && state.authUser) {
        saveManager.scheduleSave(() => state.notesData);
      }
    }
  }
  const { sheet, rows, months } = computeTotals(ensureCaloriePayload());
  const fallbackMonth = months[months.length - 1]?.key || monthKeyFromDate(toDateKey());
  if (!state.calorieActiveMonth || !months.some((m) => m.key === state.calorieActiveMonth)) {
    state.calorieActiveMonth = fallbackMonth;
  }
  paintCalorieMonthTotals(state.calorieActiveMonth);
  syncCalorieProfileInputs(sheet);
  const mealCols = mealColumnCount(sheet);
  if (els.calorieThead) els.calorieThead.innerHTML = renderCalorieMealHeaderHtml(mealCols);
  els.calorieTbody.innerHTML = renderCalorieRowsHtml(rows, toDateKey(), mealCols);
  paintCalorieDash(sheet);
  paintCalorieTodayCard(rows, sheet);
  paintCalorieHealthSheet(sheet);
  applyCalorieTones();
  if (els.calorieEmpty) els.calorieEmpty.hidden = rows.length > 0;
  document.body.classList.toggle('calorie-health-pane', state.caloriePane === 'health');
  if (els.calorieScroll) els.calorieScroll.hidden = state.caloriePane === 'health';
  if (els.calorieTodayCard && state.caloriePane === 'health') els.calorieTodayCard.hidden = true;
  requestAnimationFrame(() => {
    if (els.calorieScroll && state.caloriePane !== 'health') els.calorieScroll.scrollTop = 0;
    syncCalorieMonthFromScroll();
  });
}

function addCalorieDay() {
  const { sheet, created } = addDayFromLast(ensureCaloriePayload(), toDateKey(new Date()));
  state.calorieActiveMonth = monthKeyFromDate(toDateKey());
  persistCalorie(sheet, {
    status: created ? 'เพิ่มวันนี้แล้ว' : 'มีวันนี้แล้ว',
    fullRender: true,
  });
  requestAnimationFrame(() => {
    if (els.calorieScroll) els.calorieScroll.scrollTop = 0;
    syncCalorieMonthFromScroll();
  });
}

function syncCalorieFabs() {
  const show = isCalorieMode() && els.filterDock && !els.filterDock.hidden;
  if (els.calorieFabs) els.calorieFabs.hidden = !show;
  syncDockContextRail();
}

function syncDockContextRail() {
  const rail = els.dockContextRail;
  if (!rail) return;
  const active = Array.from(rail.children).some((el) => !el.hidden);
  rail.classList.toggle('is-active', active);
}

let calorieQuickMode = null; // 'meal' | 'mus'
/** Edit existing cell: { dayId, mealIndex? } — null = append (FAB). */
let calorieQuickEdit = null;

function paintCalorieQuickFreq() {
  const wrap = els.calorieQuickFreq;
  if (!wrap) return;
  const list = topFrequent(ensureCaloriePayload(), calorieQuickMode === 'mus' ? 'mus' : 'meal');
  if (!list.length) {
    wrap.hidden = true;
    wrap.innerHTML = '';
    return;
  }
  wrap.hidden = false;
  wrap.innerHTML = list
    .slice(0, 5)
    .map(
      (item) =>
        `<button type="button" class="cq-freq-chip" data-freq-text="${String(item.text).replace(/"/g, '&quot;')}" title="${String(item.text).replace(/"/g, '&quot;')}">${String(item.label || item.text).slice(0, 22)}</button>`,
    )
    .join('');
}

function syncCalorieQuickChrome() {
  const editing = Boolean(calorieQuickEdit);
  if (els.calorieQuickClear) els.calorieQuickClear.hidden = !editing;
  if (els.calorieQuickOk) {
    els.calorieQuickOk.textContent = editing ? 'บันทึก' : 'เพิ่ม';
  }
}

function openCalorieQuick(mode) {
  calorieQuickMode = mode === 'mus' ? 'mus' : 'meal';
  calorieQuickEdit = null;
  if (!els.calorieQuickOverlay) return;
  if (els.calorieQuickTitle) {
    els.calorieQuickTitle.textContent = calorieQuickMode === 'mus' ? 'เพิ่มออกกำลัง' : 'เพิ่มมื้อ';
  }
  if (els.calorieQuickHint) {
    els.calorieQuickHint.textContent = calorieQuickMode === 'mus'
      ? 'แตะใช้บ่อยเพื่อเติมช่อง แล้วกดเพิ่ม · หรือพิมพ์เอง'
      : 'แตะใช้บ่อยเพื่อเติมช่อง แล้วกดเพิ่ม · หรือพิมพ์เอง';
  }
  if (els.calorieQuickInput) {
    els.calorieQuickInput.value = '';
    els.calorieQuickInput.placeholder = calorieQuickMode === 'mus' ? 'ท่า + แคลที่เผา' : 'แคล,โปรตีน';
  }
  syncCalorieQuickChrome();
  paintCalorieQuickFreq();
  els.calorieQuickOverlay.hidden = false;
  requestAnimationFrame(() => {
    try { els.calorieQuickInput?.focus({ preventScroll: false }); } catch { /* ignore */ }
  });
}

/**
 * Tap a calorie number cell → edit sheet: เคลียร์ → บันทึก → data updates.
 * @param {{ mode: 'meal'|'mus', dayId: string, mealIndex?: number, value?: string }} opts
 */
function openCalorieCellEditor(opts) {
  const mode = opts?.mode === 'mus' ? 'mus' : 'meal';
  const dayId = String(opts?.dayId || '');
  if (!dayId || !els.calorieQuickOverlay) return;
  // Avoid double-open from focusin + click on the same cell.
  if (
    !els.calorieQuickOverlay.hidden &&
    calorieQuickEdit?.dayId === dayId &&
    calorieQuickMode === mode &&
    (mode === 'mus' || calorieQuickEdit?.mealIndex === Number(opts?.mealIndex))
  ) {
    return;
  }
  const sheet = ensureCaloriePayload();
  const day = sheet.days.find((d) => d.id === dayId);
  if (!day) return;

  calorieQuickMode = mode;
  let value = String(opts?.value ?? '').trim();
  let mealIndex = Number.isFinite(opts?.mealIndex) ? Number(opts.mealIndex) : null;

  if (mode === 'meal') {
    const meals = expandMealsForEdit(day.meals);
    if (mealIndex == null || mealIndex < 0) {
      mealIndex = meals.findIndex((c) => !String(c || '').trim());
      if (mealIndex < 0) mealIndex = meals.length;
    }
    while (meals.length <= mealIndex) meals.push('');
    if (!value) value = String(meals[mealIndex] || '').trim();
    calorieQuickEdit = { dayId, mealIndex };
    if (els.calorieQuickTitle) {
      els.calorieQuickTitle.textContent = value ? `แก้มื้อ ${mealIndex + 1}` : `มื้อ ${mealIndex + 1}`;
    }
    if (els.calorieQuickHint) {
      els.calorieQuickHint.textContent = 'แก้ตัวเลขแคล · กดเคลียร์แล้วบันทึกเพื่อลบ · หรือพิมพ์ใหม่แล้วบันทึก';
    }
    if (els.calorieQuickInput) {
      els.calorieQuickInput.placeholder = 'แคล,โปรตีน';
      els.calorieQuickInput.value = value;
    }
  } else {
    if (!value) {
      const mus = day.mus;
      const note = String(day.note || '').trim();
      value = mus == null || mus === '' ? '' : (note ? `${note} ${mus}` : String(mus));
    }
    calorieQuickEdit = { dayId, mealIndex: null };
    if (els.calorieQuickTitle) {
      els.calorieQuickTitle.textContent = value ? 'แก้ mus' : 'mus';
    }
    if (els.calorieQuickHint) {
      els.calorieQuickHint.textContent = 'แก้แคลเบิร์น · กดเคลียร์แล้วบันทึกเพื่อลบ · หรือพิมพ์ใหม่แล้วบันทึก';
    }
    if (els.calorieQuickInput) {
      els.calorieQuickInput.placeholder = 'ท่า + แคลที่เผา';
      els.calorieQuickInput.value = value;
    }
  }

  syncCalorieQuickChrome();
  paintCalorieQuickFreq();
  els.calorieQuickOverlay.hidden = false;
  requestAnimationFrame(() => {
    try {
      els.calorieQuickInput?.focus({ preventScroll: false });
      els.calorieQuickInput?.select?.();
    } catch { /* ignore */ }
  });
}

function closeCalorieQuick() {
  calorieQuickMode = null;
  calorieQuickEdit = null;
  if (els.calorieQuickOverlay) els.calorieQuickOverlay.hidden = true;
  syncCalorieQuickChrome();
}

function clearCalorieQuickInput() {
  if (!els.calorieQuickInput) return;
  els.calorieQuickInput.value = '';
  try {
    els.calorieQuickInput.focus({ preventScroll: false });
  } catch { /* ignore */ }
}

function submitCalorieQuick() {
  const text = String(els.calorieQuickInput?.value || '').trim();
  const editing = Boolean(calorieQuickEdit);

  // Edit path: เคลียร์แล้วกดบันทึก = ลบค่าในช่องนั้น · พิมพ์ใหม่แล้วบันทึก = อัปเดต
  if (editing) {
    const { dayId, mealIndex } = calorieQuickEdit;
    const sheet = ensureCaloriePayload();
    const day = sheet.days.find((d) => d.id === dayId);
    if (!day) {
      setStatus('ไม่พบวัน');
      return;
    }
    try {
      if (calorieQuickMode === 'mus') {
        if (!text) {
          persistCalorie(pruneFrequentMus(patchDay(sheet, dayId, { mus: null, note: '' })), {
            status: 'เคลียร์ mus แล้ว · อัปเดตแล้ว',
            fullRender: true,
          });
        } else {
          const parsed = parseQuickExercise(text);
          if (!parsed) throw new Error('ใส่ออกกำลัง + แคล เช่น ไหล่ 150');
          persistCalorie(
            patchDay(sheet, dayId, { mus: parsed.burn, note: parsed.label || '' }),
            {
              status: `บันทึก mus ${parsed.burn}${parsed.label ? ` · ${parsed.label}` : ''} แล้ว`,
              fullRender: true,
            },
          );
        }
      } else {
        const meals = expandMealsForEdit(day.meals);
        const idx = Number.isFinite(mealIndex) ? mealIndex : 0;
        while (meals.length <= idx) meals.push('');
        if (!text) {
          meals[idx] = '';
        } else {
          const parsed = parseQuickMeal(text);
          if (!parsed) throw new Error('ใส่แคลอรี่ เช่น 130,27');
          meals[idx] = formatMealCell(parsed.cal, parsed.prot);
        }
        persistCalorie(patchDay(sheet, dayId, { meals: normalizeMeals(meals) }), {
          status: text ? `บันทึกมื้อ ${idx + 1} แล้ว` : `เคลียร์มื้อ ${idx + 1} แล้ว · อัปเดตแล้ว`,
          fullRender: true,
        });
      }
      closeCalorieQuick();
    } catch (err) {
      setStatus(err?.message || 'บันทึกไม่ได้');
    }
    return;
  }

  if (!text) {
    setStatus(calorieQuickMode === 'mus' ? 'พิมพ์ท่า + แคลก่อน' : 'พิมพ์แคล/โปรตีนก่อน');
    return;
  }
  try {
    if (calorieQuickMode === 'mus') {
      const { sheet, parsed } = appendQuickExercise(ensureCaloriePayload(), text);
      state.calorieActiveMonth = monthKeyFromDate(toDateKey());
      persistCalorie(sheet, {
        status: `+mus ${parsed.burn}${parsed.label ? ` · ${parsed.label}` : ''}`,
        fullRender: true,
      });
    } else {
      const { sheet, slot, parsed } = appendQuickMeal(ensureCaloriePayload(), text);
      state.calorieActiveMonth = monthKeyFromDate(toDateKey());
      persistCalorie(sheet, {
        status: `มื้อ ${slot}: ${parsed.cal}${parsed.prot ? `,${parsed.prot}` : ''}`,
        fullRender: true,
      });
    }
    closeCalorieQuick();
    requestAnimationFrame(() => {
      if (els.calorieScroll) els.calorieScroll.scrollTop = 0;
      syncCalorieMonthFromScroll();
    });
  } catch (err) {
    setStatus(err?.message || 'เพิ่มไม่ได้');
  }
}

function setAppMode(_mode, { persist = true } = {}) {
  // Product is calorie-only — ignore requests for retired work/note/calendar modes.
  const next = 'calorie';
  if (state.activeNotepadId && state.view === 'editor') {
    flushNotepadToState();
    saveManager.saveNow(() => state.notesData);
  }
  state.appMode = next;
  document.body.classList.remove('note-mode', 'calendar-mode', 'notepad-editing');
  document.body.classList.add('calorie-mode', 'calorie-only');
  if (persist) {
    state.settings.appMode = next;
    saveSettings(state.settings);
  }
  closeCalorieQuick();
  closeModeMenu();
  renderModeSwitcher();
  showView('calorie');
  updateFilterDockVisibility();
  updateUndoFab();
  syncCalorieFabs();
}

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function parseMonthKey(key) {
  const [y, m] = String(key || '').split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return { year: y, month: m - 1 };
}

function shiftMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function ensureCalendarScrollRange() {
  if (state.calendarScrollRange) return state.calendarScrollRange;
  const center = { year: state.calendarYear, month: state.calendarMonth };
  const start = shiftMonth(center.year, center.month, -12);
  const end = shiftMonth(center.year, center.month, 12);
  state.calendarScrollRange = { start, end };
  return state.calendarScrollRange;
}

function setCalendarZoom(zoom) {
  state.calendarZoom = zoom === 'year' ? 'year' : 'month';
  if (els.calendarView) els.calendarView.dataset.calZoom = state.calendarZoom;
  const yearMode = state.calendarZoom === 'year';
  if (els.calWeekdays) els.calWeekdays.hidden = yearMode;
  if (els.calScroll) els.calScroll.hidden = yearMode;
  if (els.calYearView) els.calYearView.hidden = !yearMode;
  if (els.calZoomOut) els.calZoomOut.disabled = yearMode;
  if (els.calZoomIn) els.calZoomIn.disabled = !yearMode;
  // Day sheet only on month zoom
  if (yearMode) collapseCalendarNotes();
  updateCalendarChrome();
}

function updateCalendarChrome() {
  const y = state.calendarYear;
  const m = state.calendarMonth;
  if (els.calYearLabel) els.calYearLabel.textContent = yearLabel(y);
  if (els.calMonthTitle) {
    if (state.calendarZoom === 'year') {
      els.calMonthTitle.textContent = yearLabel(y);
    } else {
      els.calMonthTitle.textContent = monthNameOnly(y, m);
    }
  }
  if (els.calYearBack) {
    els.calYearBack.setAttribute(
      'aria-label',
      state.calendarZoom === 'year' ? 'ปีก่อนหน้าในมุมมองปี' : `มุมมองรายปี ${yearLabel(y)}`,
    );
  }
}

function renderCalendar() {
  if (!els.calScroll && !els.calYearView) return;
  setCalendarZoom(state.calendarZoom || 'month');
  if (state.calendarZoom === 'year') {
    renderCalendarYearView();
  } else {
    renderCalendarMonthScroll({ scrollToCurrent: !els.calScroll?.dataset.ready });
  }
  if (state.calendarSelectedDate && state.calendarZoom === 'month') {
    renderCalendarNotes(state.calendarSelectedDate);
  }
}

function buildCalCellEl(cell, year, month, { mini = false } = {}) {
  const div = document.createElement('div');
  div.className = mini ? 'cal-cell cal-cell-mini' : 'cal-cell';
  if (cell.empty) {
    div.classList.add('empty');
    return div;
  }
  if (cell.isToday) div.classList.add('today');
  if (state.calendarSelectedDate && cell.dateKey === state.calendarSelectedDate) {
    div.classList.add('selected');
  }
  div.setAttribute('role', 'button');
  div.setAttribute('tabindex', mini ? '-1' : '0');
  div.setAttribute(
    'aria-label',
    `${cell.day} ${monthNameOnly(year, month)}`,
  );
  div.dataset.dateKey = cell.dateKey;
  div.innerHTML = `<span class="cal-cell-day">${cell.day}</span>`;

  if (!mini && cell.count > 0) {
    const dateNotes = notesOnDate(state.notesData.notes, cell.dateKey);
    const hasHot = dateNotes.some((n) => {
      const prox = scheduleProximity(n.scheduledAt);
      return prox.level === 'overdue' || prox.level === 'today';
    });
    const dots = document.createElement('div');
    dots.className = 'cal-cell-dots';
    if (hasHot) div.classList.add('overdue');
    const dotCount = Math.min(cell.count, 3);
    for (let i = 0; i < dotCount; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'cal-cell-dot';
      dots.appendChild(dot);
    }
    div.appendChild(dots);
  } else if (mini && cell.count > 0) {
    div.classList.add('has-notes');
  }
  return div;
}

function renderMonthBlock(year, month, notes) {
  const section = document.createElement('section');
  section.className = 'cal-month-block';
  section.dataset.monthKey = monthKey(year, month);
  section.dataset.year = String(year);
  section.dataset.month = String(month);

  const title = document.createElement('h3');
  title.className = 'cal-month-block-title';
  title.textContent = monthLabel(year, month);
  section.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  const built = buildMonthGrid(year, month, notes);
  built.cells.forEach((cell) => {
    const el = buildCalCellEl(cell, year, month);
    if (!cell.empty) {
      el.addEventListener('click', () => selectCalendarDate(cell.dateKey));
    }
    grid.appendChild(el);
  });
  section.appendChild(grid);
  return section;
}

function renderCalendarMonthScroll({ scrollToCurrent = false } = {}) {
  if (!els.calScroll) return;
  const notes = state.notesData.notes || [];
  const range = ensureCalendarScrollRange();
  const targetYear = state.calendarYear;
  const targetMonth = state.calendarMonth;
  els.calScroll.innerHTML = '';

  let cursor = { ...range.start };
  const endKey = monthKey(range.end.year, range.end.month);
  while (true) {
    const key = monthKey(cursor.year, cursor.month);
    els.calScroll.appendChild(renderMonthBlock(cursor.year, cursor.month, notes));
    if (key === endKey) break;
    cursor = shiftMonth(cursor.year, cursor.month, 1);
  }
  els.calScroll.dataset.ready = '1';
  // Keep chrome on the intended month until scroll settles (observer can fire early)
  state.calendarYear = targetYear;
  state.calendarMonth = targetMonth;
  updateCalendarChrome();

  if (scrollToCurrent) {
    scrollCalendarToMonth(targetYear, targetMonth, 'auto');
    requestAnimationFrame(() => {
      bindCalendarScrollObserver();
      highlightCalendarSelection();
    });
  } else {
    bindCalendarScrollObserver();
    highlightCalendarSelection();
  }
}

let calScrollObserver = null;

function bindCalendarScrollObserver() {
  if (!els.calScroll || typeof IntersectionObserver === 'undefined') return;
  if (calScrollObserver) {
    calScrollObserver.disconnect();
    calScrollObserver = null;
  }
  calScrollObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      const top = visible[0]?.target;
      if (!top) return;
      const y = Number(top.dataset.year);
      const m = Number(top.dataset.month);
      if (!Number.isFinite(y) || !Number.isFinite(m)) return;
      if (y === state.calendarYear && m === state.calendarMonth) return;
      state.calendarYear = y;
      state.calendarMonth = m;
      updateCalendarChrome();
    },
    { root: els.calScroll, threshold: [0.35, 0.55, 0.75] },
  );
  els.calScroll.querySelectorAll('.cal-month-block').forEach((block) => {
    calScrollObserver.observe(block);
  });
}

function scrollCalendarToMonth(year, month, behavior = 'smooth') {
  if (!els.calScroll) return;
  const key = monthKey(year, month);
  const block = els.calScroll.querySelector(`.cal-month-block[data-month-key="${key}"]`);
  if (!block) return;
  state.calendarYear = year;
  state.calendarMonth = month;
  updateCalendarChrome();
  const top = block.offsetTop;
  if (behavior === 'smooth' && typeof els.calScroll.scrollTo === 'function') {
    els.calScroll.scrollTo({ top, behavior: 'smooth' });
  } else {
    els.calScroll.scrollTop = top;
  }
  highlightCalendarSelection();
}

function renderCalendarYearView() {
  if (!els.calYearView) return;
  const notes = state.notesData.notes || [];
  const year = state.calendarYear;
  els.calYearView.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'cal-year-nav';
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'cal-nav-btn';
  prev.setAttribute('aria-label', 'ปีก่อน');
  prev.textContent = '‹';
  prev.addEventListener('click', () => {
    state.calendarYear -= 1;
    renderCalendarYearView();
    updateCalendarChrome();
  });
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'cal-nav-btn';
  next.setAttribute('aria-label', 'ปีถัดไป');
  next.textContent = '›';
  next.addEventListener('click', () => {
    state.calendarYear += 1;
    renderCalendarYearView();
    updateCalendarChrome();
  });
  const label = document.createElement('h3');
  label.className = 'cal-year-nav-title';
  label.textContent = yearLabel(year);
  head.append(prev, label, next);
  els.calYearView.appendChild(head);

  const grid = document.createElement('div');
  grid.className = 'cal-year-grid';
  for (let month = 0; month < 12; month += 1) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'cal-year-month';
    card.dataset.month = String(month);
    if (year === new Date().getFullYear() && month === new Date().getMonth()) {
      card.classList.add('is-current');
    }
    const name = document.createElement('span');
    name.className = 'cal-year-month-name';
    name.textContent = monthNameOnly(year, month, { short: true });
    card.appendChild(name);

    const mini = document.createElement('div');
    mini.className = 'cal-grid cal-grid-mini';
    const built = buildMonthGrid(year, month, notes);
    built.cells.forEach((cell) => {
      mini.appendChild(buildCalCellEl(cell, year, month, { mini: true }));
    });
    card.appendChild(mini);
    card.addEventListener('click', () => {
      state.calendarMonth = month;
      state.calendarYear = year;
      state.calendarScrollRange = null;
      setCalendarZoom('month');
      renderCalendarMonthScroll({ scrollToCurrent: true });
    });
    grid.appendChild(card);
  }
  els.calYearView.appendChild(grid);
  updateCalendarChrome();
}

function highlightCalendarSelection() {
  if (!els.calScroll) return;
  els.calScroll.querySelectorAll('.cal-cell.selected').forEach((c) => c.classList.remove('selected'));
  if (!state.calendarSelectedDate) return;
  els.calScroll
    .querySelectorAll(`.cal-cell[data-date-key="${state.calendarSelectedDate}"]`)
    .forEach((c) => c.classList.add('selected'));
}

function collapseCalendarNotes() {
  if (!els.calNotes) return;
  els.calNotes.hidden = true;
  els.calendarView?.classList.remove('cal-notes-open');
}

function selectCalendarDate(dateKey) {
  // Tap same day again → collapse sheet
  if (state.calendarSelectedDate === dateKey && els.calNotes && !els.calNotes.hidden) {
    state.calendarSelectedDate = null;
    highlightCalendarSelection();
    collapseCalendarNotes();
    return;
  }
  state.calendarSelectedDate = dateKey;
  const parsed = parseMonthKey(dateKey.slice(0, 7));
  if (parsed) {
    state.calendarYear = parsed.year;
    state.calendarMonth = parsed.month;
    updateCalendarChrome();
  }
  highlightCalendarSelection();
  renderCalendarNotes(dateKey);
}

function renderCalendarNotes(dateKey) {
  if (!els.calNotes) return;

  const notes = state.notesData.notes;
  const dateNotes = notesOnDate(notes, dateKey);

  const d = new Date(`${dateKey}T00:00:00`);
  const dateLabel = d.toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  els.calNotes.hidden = false;
  els.calendarView?.classList.add('cal-notes-open');

  if (dateNotes.length === 0) {
    els.calNotes.innerHTML = `
      <div class="cal-notes-handle" aria-hidden="true"></div>
      <p class="cal-notes-empty">${dateLabel} — ไม่มีงาน</p>`;
    return;
  }

  const sorted = [...dateNotes].sort((a, b) => {
    const aHasTime = !!a.scheduledAt;
    const bHasTime = !!b.scheduledAt;
    if (aHasTime && !bHasTime) return -1;
    if (!aHasTime && bHasTime) return 1;
    if (aHasTime && bHasTime) return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  let html = `
    <div class="cal-notes-handle" aria-hidden="true"></div>
    <p class="cal-notes-title">${dateLabel}</p>`;

  sorted.forEach((note) => {
    const priority = notePriority(note);
    const prioColors = loadSettings().priorityColors || DEFAULT_PRIORITY_COLORS;
    const prioColor = prioColors[priority] || prioColors.normal;
    const tags = getTagsForNote(note, state.notesData.tags || []);
    const titleText = stripLeadingEmoji(note.title || '') || 'ไม่มีหัวข้อ';
    const metaHtml = cardMetaInlineHtml(note, tags);
    const leadHtml = cardLeadingIconHtml(note, tags);

    html += `<div class="note-card note-card-split note-card-compact" data-note-id="${escapeHtml(note.id)}" role="button" tabindex="0">
      <div class="card-compact-body" style="--prio:${escapeHtml(prioColor)}">
        <div class="card-compact-row">
          ${leadHtml}
          <h3 class="card-title">${escapeHtml(titleText)}</h3>
          ${metaHtml}
        </div>
      </div>
    </div>`;
  });

  els.calNotes.innerHTML = html;

  els.calNotes.querySelectorAll('.note-card').forEach((card) => {
    card.addEventListener('click', () => {
      const noteId = card.dataset.noteId;
      if (noteId) openEditor(noteId);
    });
  });
}

function goCalendarToday() {
  const now = new Date();
  state.calendarYear = now.getFullYear();
  state.calendarMonth = now.getMonth();
  state.calendarSelectedDate = dateKeyFromDate(now);
  state.calendarScrollRange = null;
  if (state.calendarZoom === 'year') {
    setCalendarZoom('month');
  }
  renderCalendarMonthScroll({ scrollToCurrent: true });
  renderCalendarNotes(state.calendarSelectedDate);
}

function calendarZoomOut() {
  if (state.calendarZoom === 'year') return;
  setCalendarZoom('year');
  renderCalendarYearView();
}

function calendarZoomIn() {
  if (state.calendarZoom !== 'year') return;
  state.calendarScrollRange = null;
  setCalendarZoom('month');
  renderCalendarMonthScroll({ scrollToCurrent: true });
}

function renderModeSwitcher() {
  if (els.modeSwitchName) {
    if (isCalorieMode()) els.modeSwitchName.textContent = 'แคลโน้ต';
    else if (isCalendarMode()) els.modeSwitchName.textContent = 'ปฏิทิน';
    else els.modeSwitchName.textContent = isNoteMode() ? 'Note' : 'งานหลัก';
  }
  if (els.modeSwitchBtn) {
    let ariaLabel = 'โหมดงานหลัก';
    if (isCalorieMode()) ariaLabel = 'แคลโน้ต';
    else if (isCalendarMode()) ariaLabel = 'โหมดปฏิทิน';
    else if (isNoteMode()) ariaLabel = 'โหมด Note';
    els.modeSwitchBtn.setAttribute('aria-label', ariaLabel);
  }
  const onWork = !isNoteMode() && !isCalendarMode() && !isCalorieMode();
  if (els.modeMenuWork) {
    els.modeMenuWork.setAttribute('aria-current', onWork ? 'page' : 'false');
  }
  if (els.modeMenuNote) {
    els.modeMenuNote.setAttribute('aria-current', isNoteMode() ? 'page' : 'false');
  }
  if (els.modeMenuCalendar) {
    els.modeMenuCalendar.setAttribute('aria-current', isCalendarMode() ? 'page' : 'false');
  }
  if (els.modeMenuCalorie) {
    els.modeMenuCalorie.setAttribute('aria-current', isCalorieMode() ? 'page' : 'false');
  }
  if (els.dockModeWork) {
    els.dockModeWork.setAttribute('aria-pressed', onWork ? 'true' : 'false');
  }
  if (els.dockModeNote) {
    els.dockModeNote.setAttribute('aria-pressed', isNoteMode() ? 'true' : 'false');
  }
  if (els.dockModeCalendar) {
    els.dockModeCalendar.setAttribute('aria-pressed', isCalendarMode() ? 'true' : 'false');
  }
  if (els.dockModeCalorie) {
    els.dockModeCalorie.setAttribute('aria-pressed', isCalorieMode() ? 'true' : 'false');
  }
  if (els.notepadMenuSection) {
    els.notepadMenuSection.hidden = !isNoteMode();
  }
  if (isNoteMode()) renderNotepadMenuList();
}

function focusAiNoteTitle({ select = true } = {}) {
  const input = els.aiNoteDraftTitle;
  if (!input) return;
  try {
    input.focus({ preventScroll: false });
  } catch {
    input.focus();
  }
  try {
    input.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch {
    /* ignore */
  }
  if (select) {
    try {
      const len = String(input.value || '').length;
      input.setSelectionRange(0, len);
    } catch {
      /* ignore */
    }
  }
}

function closeModeMenu() {
  if (els.modeMenuOverlay) els.modeMenuOverlay.hidden = true;
  els.modeSwitchBtn?.setAttribute('aria-expanded', 'false');
}

function openModeMenu() {
  renderModeSwitcher();
  renderNotepadMenuList();
  if (els.modeMenuOverlay) els.modeMenuOverlay.hidden = false;
  els.modeSwitchBtn?.setAttribute('aria-expanded', 'true');
}

function renderNotepadMenuList() {
  const list = els.notepadMenuList;
  if (!list) return;
  const pads = normalizeNotepads(state.notesData.notepads);
  if (!pads.length) {
    list.innerHTML = '<p class="settings-hint" style="margin:0.25rem 0.35rem">ยังไม่มี Note — กด + Note ใหม่</p>';
    return;
  }
  list.innerHTML = pads
    .map((p) => {
      const current = p.id === state.activeNotepadId;
      return `<div class="workspace-menu-row">
        <button type="button" class="workspace-menu-item" role="menuitem" data-notepad-id="${escapeHtml(p.id)}"${current ? ' aria-current="page"' : ''}>
          <span>${escapeHtml(p.name)}</span>
          <span class="ws-sub">${current ? 'เปิดอยู่' : ''}</span>
        </button>
        <button type="button" class="workspace-menu-del" data-notepad-delete="${escapeHtml(p.id)}" aria-label="ลบ Note">ลบ</button>
      </div>`;
    })
    .join('');
}

function promptNewNotepad() {
  const name = window.prompt('ชื่อ Note ใหม่', '');
  if (name == null) return;
  const trimmed = String(name).trim();
  if (!trimmed) {
    setStatus('ใส่ชื่อ Note');
    return;
  }
  const { data, notepad } = addNotepad(state.notesData, trimmed);
  state.notesData = data;
  rememberRecentNotepad(notepad.id);
  autosave();
  setAppMode('note');
  closeModeMenu();
  openNotepadEditor(notepad.id, { focusTitle: true });
  setStatus(`สร้าง Note「${notepad.name}」แล้ว`);
}

function promptRenameNotepad(notepadId) {
  const pad = getNotepad(state.notesData, notepadId);
  if (!pad) return;
  const name = window.prompt('เปลี่ยนชื่อ Note', pad.name);
  if (name == null) return;
  const trimmed = String(name).trim();
  if (!trimmed || trimmed === pad.name) return;
  state.notesData = renameNotepad(state.notesData, notepadId, trimmed);
  autosave();
  renderModeSwitcher();
  if (state.activeNotepadId === notepadId && els.noteTitle) {
    els.noteTitle.value = trimmed;
  }
  renderNotesList();
  renderNotepadQuickBar();
  setStatus('เปลี่ยนชื่อ Note แล้ว');
}

function tryDeleteNotepad(notepadId) {
  const pad = getNotepad(state.notesData, notepadId);
  if (!pad) return;
  if (!window.confirm(`ลบ Note「${pad.name}」?`)) return;
  try {
    state.notesData = deleteNotepad(state.notesData, notepadId);
    if (state.activeNotepadId === notepadId) {
      state.activeNotepadId = null;
      document.body.classList.remove('notepad-editing');
      showView('list');
    }
    const recent = Array.isArray(state.settings.recentNotepadIds)
      ? state.settings.recentNotepadIds.filter((id) => id !== notepadId)
      : [];
    state.settings.recentNotepadIds = recent;
    if (state.settings.lastNotepadId === notepadId) {
      state.settings.lastNotepadId = recent[0] || null;
    }
    saveSettings(state.settings);
    autosave();
    renderNotepadMenuList();
    renderNotesList();
    renderNotepadQuickBar();
    setStatus('ลบ Note แล้ว');
  } catch (err) {
    setStatus(err.message || 'ลบ Note ไม่ได้');
  }
}

function rememberRecentNotepad(notepadId) {
  state.settings = touchRecentNotepadId(state.settings, notepadId);
  saveSettings(state.settings);
}

function openNotepadEditor(notepadId, { focusTitle = false } = {}) {
  const pad = getNotepad(state.notesData, notepadId);
  if (!pad) return;
  if (state.activeNotepadId && state.activeNotepadId !== notepadId) {
    flushNotepadToState();
    saveManager.saveNow(() => state.notesData);
  }
  state.appMode = 'note';
  state.activeNotepadId = notepadId;
  state.activeNoteId = null;
  state.settings.appMode = 'note';
  rememberRecentNotepad(notepadId);
  document.body.classList.add('note-mode');
  document.body.classList.add('notepad-editing');
  if (els.noteTitle) els.noteTitle.value = pad.name || '';
  if (els.noteContent) els.noteContent.value = pad.content || '';
  state.editorSheets = normalizeSheetBlocks(pad.sheets);
  state.editorTextPrefs = normalizeTextPrefs(pad.textPrefs);
  state.sheetFocus = null;
  showView('editor');
  renderModeSwitcher();
  renderNotepadQuickBar();
  renderNotepadSheets();
  renderNoteTextBar();
  hideEditorSaveDot();
  queueMicrotask(() => {
    const target = focusTitle ? els.noteTitle : els.noteContent;
    try { target?.focus({ preventScroll: false }); }
    catch { target?.focus(); }
    if (focusTitle && els.noteTitle) {
      try {
        const len = String(els.noteTitle.value || '').length;
        els.noteTitle.setSelectionRange(0, len);
      } catch {
        /* ignore */
      }
    }
  });
}

function flushNotepadToState() {
  if (!state.activeNotepadId) return;
  const name = els.noteTitle?.value ?? '';
  const content = els.noteContent?.value ?? '';
  state.notesData = updateNotepadContent(state.notesData, state.activeNotepadId, {
    name,
    content,
    sheets: state.editorSheets,
    textPrefs: state.editorTextPrefs,
  });
}

function clearNotepadSheetUi() {
  state.editorSheets = [];
  state.editorTextPrefs = { ...DEFAULT_TEXT_PREFS };
  state.sheetFocus = null;
  if (els.notepadSheetBlocks) els.notepadSheetBlocks.innerHTML = '';
  if (els.notepadAddSheetBtn) els.notepadAddSheetBtn.hidden = true;
  if (els.notepadSheetHint) els.notepadSheetHint.hidden = true;
  if (els.noteTextBar) els.noteTextBar.hidden = true;
  applyTextPrefsToTextarea(els.noteContent, DEFAULT_TEXT_PREFS);
}

function renderNoteTextBar() {
  const editing = Boolean(state.activeNotepadId) && document.body.classList.contains('notepad-editing');
  const prefs = normalizeTextPrefs(state.editorTextPrefs);
  state.editorTextPrefs = prefs;
  if (els.noteTextBar) els.noteTextBar.hidden = !editing;
  if (els.noteTextCode) els.noteTextCode.setAttribute('aria-pressed', prefs.codeMode ? 'true' : 'false');
  if (els.noteTextTab2) els.noteTextTab2.setAttribute('aria-pressed', prefs.tabWidth === 2 ? 'true' : 'false');
  if (els.noteTextTab4) els.noteTextTab4.setAttribute('aria-pressed', prefs.tabWidth === 4 ? 'true' : 'false');
  applyTextPrefsToTextarea(els.noteContent, prefs);
  if (els.noteContent) {
    els.noteContent.spellcheck = !prefs.codeMode;
  }
}

function patchEditorTextPrefs(patch) {
  if (!state.activeNotepadId) return;
  state.editorTextPrefs = normalizeTextPrefs({
    ...normalizeTextPrefs(state.editorTextPrefs),
    ...patch,
  });
  renderNoteTextBar();
  flushNotepadToState();
  autosave();
}

function renderNotepadSheets() {
  const host = els.notepadSheetBlocks;
  const addBtn = els.notepadAddSheetBtn;
  const hint = els.notepadSheetHint;
  const editing = Boolean(state.activeNotepadId) && document.body.classList.contains('notepad-editing');
  if (addBtn) addBtn.hidden = !editing;
  if (hint) hint.hidden = !editing;
  if (!host) return;
  if (!editing) {
    host.innerHTML = '';
    return;
  }
  const sheets = normalizeSheetBlocks(state.editorSheets);
  state.editorSheets = sheets;
  host.innerHTML = '';
  sheets.forEach((sheet, index) => {
    host.appendChild(buildNotepadSheetBlockEl(sheet, index));
  });
}

function buildNotepadSheetBlockEl(sheet, index) {
  const { values, errors } = evaluateSheet(sheet);
  const wrap = document.createElement('section');
  wrap.className = 'notepad-sheet-block';
  wrap.dataset.sheetId = sheet.id;

  const focusKey =
    state.sheetFocus?.sheetId === sheet.id ? state.sheetFocus.key : null;
  const focusRaw = focusKey ? String(sheet.cells[focusKey] || '') : '';
  const activeEl = document.activeElement;
  const activeCellKey =
    activeEl?.classList?.contains('notepad-sheet-cell') &&
    activeEl?.dataset?.sheetId === sheet.id
      ? activeEl.dataset.cellKey
      : null;

  const head = document.createElement('div');
  head.className = 'notepad-sheet-head';
  head.innerHTML = `
    <span class="notepad-sheet-head-title">ตารางคำนวณ ${index + 1}</span>
    <button type="button" class="notepad-sheet-remove" data-sheet-remove="${escapeHtml(sheet.id)}">ลบตาราง</button>
  `;

  const formulaRow = document.createElement('div');
  formulaRow.className = 'notepad-sheet-formula';
  formulaRow.innerHTML = `
    <span class="notepad-sheet-formula-ref">${escapeHtml(focusKey || 'A1')}</span>
    <input class="notepad-sheet-formula-input" type="text" spellcheck="false" autocomplete="off"
      data-sheet-formula="${escapeHtml(sheet.id)}"
      placeholder="พิมพ์ค่า หรือ =A1+B1 / =SUM(A1:A10)"
      value="${escapeHtml(focusRaw)}">
  `;

  const scroll = document.createElement('div');
  scroll.className = 'notepad-sheet-scroll';
  const table = document.createElement('table');
  table.className = 'notepad-sheet-table';
  table.setAttribute('aria-label', `ตารางคำนวณ ${index + 1}`);

  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  hr.innerHTML = `<th class="sheet-corner"></th>`;
  for (let c = 0; c < sheet.cols; c += 1) {
    hr.innerHTML += `<th>${colIndexToLetter(c)}</th>`;
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let r = 0; r < sheet.rows; r += 1) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<th class="sheet-row-head">${r + 1}</th>`;
    for (let c = 0; c < sheet.cols; c += 1) {
      const key = cellKey(c, r);
      const raw = String(sheet.cells[key] || '');
      const err = errors[key];
      const display = raw.startsWith('=')
        ? formatSheetDisplay(values[key], err)
        : raw;
      const td = document.createElement('td');
      if (focusKey === key) td.classList.add('is-selected');
      const input = document.createElement('input');
      input.className = 'notepad-sheet-cell';
      input.type = 'text';
      input.spellcheck = false;
      input.autocomplete = 'off';
      input.dataset.sheetId = sheet.id;
      input.dataset.cellKey = key;
      // Only the actively focused input shows raw formula; others show computed value.
      const editingHere = activeCellKey === key;
      input.value = editingHere ? raw : display;
      if (!raw.startsWith('=') && Number.isNaN(Number(String(raw).replace(/,/g, ''))) && raw) {
        input.classList.add('is-text');
      }
      if (raw.startsWith('=') && !editingHere) input.classList.add('is-formula-result');
      if (err && !editingHere) input.classList.add('is-error');
      input.addEventListener('focus', () => {
        focusSheetCell(sheet.id, key, { select: true, revealRaw: true, input });
      });
      input.addEventListener('blur', () => {
        setSheetCellValue(sheet.id, key, input.value, { silentFocus: true });
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
          const nextKey = cellKey(c, Math.min(sheet.rows - 1, r + 1));
          state.sheetFocus = { sheetId: sheet.id, key: nextKey };
          queueMicrotask(() => {
            const next = els.notepadSheetBlocks?.querySelector(
              `input.notepad-sheet-cell[data-sheet-id="${CSS.escape(sheet.id)}"][data-cell-key="${nextKey}"]`,
            );
            next?.focus();
            next?.select?.();
          });
        }
      });
      td.appendChild(input);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  scroll.appendChild(table);

  wrap.append(head, formulaRow, scroll);

  const formulaInput = formulaRow.querySelector('.notepad-sheet-formula-input');
  formulaInput?.addEventListener('change', () => {
    const key =
      state.sheetFocus?.sheetId === sheet.id ? state.sheetFocus.key : 'A1';
    setSheetCellValue(sheet.id, key, formulaInput.value);
  });
  formulaInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      formulaInput.blur();
    }
  });

  return wrap;
}

function focusSheetCell(sheetId, key, { select = false, revealRaw = false, input = null } = {}) {
  state.sheetFocus = { sheetId, key };
  const block = els.notepadSheetBlocks?.querySelector(`[data-sheet-id="${CSS.escape(sheetId)}"]`);
  if (!block) return;
  block.querySelectorAll('td.is-selected').forEach((td) => td.classList.remove('is-selected'));
  const cellInput =
    input ||
    block.querySelector(
      `input.notepad-sheet-cell[data-cell-key="${key}"]`,
    );
  cellInput?.closest('td')?.classList.add('is-selected');
  const sheet = normalizeSheetBlocks(state.editorSheets).find((s) => s.id === sheetId);
  const raw = sheet ? String(sheet.cells[key] || '') : '';
  if (revealRaw && cellInput && raw.startsWith('=')) {
    cellInput.value = raw;
    cellInput.classList.remove('is-formula-result', 'is-error');
  }
  const refEl = block.querySelector('.notepad-sheet-formula-ref');
  const formulaInput = block.querySelector('.notepad-sheet-formula-input');
  if (refEl) refEl.textContent = key;
  if (formulaInput && document.activeElement !== formulaInput) {
    formulaInput.value = raw;
  }
  if (select) {
    try {
      cellInput?.select?.();
    } catch {
      /* ignore */
    }
  }
}

function setSheetCellValue(sheetId, key, rawValue, { silentFocus = false } = {}) {
  const ref = parseCellRef(key);
  if (!ref) return;
  const sheets = normalizeSheetBlocks(state.editorSheets);
  const idx = sheets.findIndex((s) => s.id === sheetId);
  if (idx < 0) return;
  const prev = String(sheets[idx].cells[key] || '');
  const val = String(rawValue ?? '').slice(0, 200);
  if (prev === val) {
    if (!silentFocus) renderNotepadSheets();
    return;
  }
  const sheet = { ...sheets[idx], cells: { ...sheets[idx].cells } };
  if (!val) delete sheet.cells[key];
  else sheet.cells[key] = val;
  sheets[idx] = sheet;
  state.editorSheets = sheets;
  state.sheetFocus = { sheetId, key };
  flushNotepadToState();
  autosave();
  renderNotepadSheets();
}

function addNotepadSheetBlock() {
  if (!state.activeNotepadId) return;
  if (state.editorSheets.length >= 8) {
    setStatus('เพิ่มตารางได้สูงสุด 8 ต่อโน้ต');
    return;
  }
  const block = createSheetBlock();
  // Tiny starter example so formulas are discoverable.
  block.cells = {
    A1: 'รายการ',
    B1: 'จำนวน',
    C1: 'ราคา',
    D1: 'รวม',
    A2: '1',
    B2: '2',
    C2: '50',
    D2: '=B2*C2',
    A3: '2',
    B3: '3',
    C3: '20',
    D3: '=B3*C3',
    C11: 'ผลรวม',
    D11: '=SUM(D2:D10)',
  };
  state.editorSheets = [...normalizeSheetBlocks(state.editorSheets), block];
  state.sheetFocus = { sheetId: block.id, key: 'D2' };
  flushNotepadToState();
  autosave();
  renderNotepadSheets();
  setStatus('เพิ่มตารางคำนวณแล้ว');
  queueMicrotask(() => {
    els.notepadSheetBlocks
      ?.querySelector(`[data-sheet-id="${block.id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function removeNotepadSheetBlock(sheetId) {
  if (!sheetId) return;
  state.editorSheets = normalizeSheetBlocks(state.editorSheets).filter((s) => s.id !== sheetId);
  if (state.sheetFocus?.sheetId === sheetId) state.sheetFocus = null;
  flushNotepadToState();
  autosave();
  renderNotepadSheets();
  setStatus('ลบตารางแล้ว');
}

function sortedFilteredNotes() {
  let notes = notesForCurrentGroup();
  notes = filterNotesByPriority(notes, state.priorityFilter);
  notes = filterNotesByRecurrence(notes, state.recurrenceFilter);
  notes = filterNotesByTag(notes, state.tagFilterId);
  notes = filterNotesByDueScope(notes, state.dueScope);
  notes = filterNotesBySearch(notes, state.searchQuery, state.notesData.tags || []);
  if (state.sortMode === 'schedule') return sortNotesBySchedule(notes);
  if (state.sortMode === 'manual') return sortNotesManual(notes);
  return sortNotes(notes);
}

function renderGroupNav() {
  els.groupActiveBtn.classList.toggle('active', state.listGroup === NOTE_STATUS.ACTIVE);
  els.groupDoneBtn.classList.toggle('active', state.listGroup === NOTE_STATUS.DONE);
  els.groupTrashBtn.classList.toggle('active', state.listGroup === NOTE_STATUS.TRASH);

  const isActiveGroup = state.listGroup === NOTE_STATUS.ACTIVE;
  if (isNoteMode() || isCalorieMode()) {
    if (els.addNoteBtn) els.addNoteBtn.hidden = false;
    if (els.addBlankBtn) els.addBlankBtn.hidden = true;
  } else {
    if (els.addNoteBtn) els.addNoteBtn.hidden = !isActiveGroup;
    if (els.addBlankBtn) els.addBlankBtn.hidden = !isActiveGroup;
  }
  if (els.addNoteBtn) {
    els.addNoteBtn.setAttribute(
      'aria-label',
      isCalorieMode() ? 'เพิ่มวัน' : isNoteMode() ? 'เพิ่ม Note' : 'เพิ่มงาน',
    );
    els.addNoteBtn.title = isCalorieMode() ? 'เพิ่มวัน' : isNoteMode() ? 'เพิ่ม Note' : 'เพิ่มงาน';
  }
  updateFilterDockVisibility();
  renderModeSwitcher();

  const build = getAppBuild();
  const groupTitle =
    state.listGroup === NOTE_STATUS.DONE
      ? 'ทำแล้ว'
      : state.listGroup === NOTE_STATUS.TRASH
        ? 'ถังขยะ'
        : 'งานหลัก';
  const name = isCalorieMode()
    ? 'แคลโน้ต'
    : isNoteMode()
      ? 'Note'
      : groupTitle === 'งานหลัก'
        ? 'งานหลัก'
        : `งานหลัก · ${groupTitle}`;
  if (els.appTitle) {
    els.appTitle.textContent = `${name} · ${NOTE_APP_VERSION} · b${build}`;
  }
}

const SORT_FILTER_OPTIONS = [
  { id: 'updated', label: 'ล่าสุด', button: 'ล่าสุด' },
  { id: 'schedule', label: 'ตามกำหนด', button: 'ตามกำหนด' },
  { id: 'manual', label: 'อิสระ', button: 'อิสระ' },
];

function updateFilterDockVisibility() {
  const onBoard = state.view === 'list' || state.view === 'calendar' || state.view === 'calorie';
  const onList = state.view === 'list';
  const selecting = onList && state.selectionMode && !isNoteMode() && !isCalorieMode();
  const notepadEditing = isNoteMode() && state.view === 'editor' && Boolean(state.activeNotepadId);
  const calMode = isCalendarMode();
  const calorieMode = isCalorieMode();
  if (els.filterDock) {
    const showDock = (onBoard && !state.selectionMode) || notepadEditing;
    els.filterDock.hidden = !showDock;
    // Filters are work-list only — not on calendar/calorie sheets
    const showFilters = showDock && onList && !isNoteMode() && !calMode && !calorieMode && state.listGroup === NOTE_STATUS.ACTIVE;
    if (els.filterDockFiltersWrap) els.filterDockFiltersWrap.hidden = !showFilters;
    // In Note/Calendar/Calorie mode: hide group drawer, keep left slot so mode switch stays centered
    if (els.groupNavBtn) {
      const hideGroup = isNoteMode() || calMode || calorieMode;
      els.groupNavBtn.hidden = false;
      els.groupNavBtn.classList.toggle('is-slot-empty', hideGroup);
      els.groupNavBtn.tabIndex = hideGroup ? -1 : 0;
      els.groupNavBtn.setAttribute('aria-hidden', hideGroup ? 'true' : 'false');
    }
    if (!showFilters) closeFilterMenus();
    renderNotepadQuickBar();
    syncCalorieFabs();
    syncDockContextRail();
  }
  document.body.classList.toggle('notepad-dock', Boolean(notepadEditing));
  if (els.selectionDock) {
    els.selectionDock.hidden = !selecting;
  }
  document.body.classList.toggle('selection-mode', Boolean(selecting));
  applyDockOffset();
  renderFloatTagIcons();
  if (selecting) renderSelectionDock();
}

function orderedNotepadsForQuickBar() {
  const pads = normalizeNotepads(state.notesData.notepads);
  if (!pads.length) return [];
  const byId = new Map(pads.map((p) => [p.id, p]));
  const recent = Array.isArray(state.settings.recentNotepadIds)
    ? state.settings.recentNotepadIds
    : [];
  const ordered = [];
  const seen = new Set();
  const pushId = (id) => {
    const pad = byId.get(id);
    if (!pad || seen.has(pad.id)) return;
    seen.add(pad.id);
    ordered.push(pad);
  };
  pushId(state.activeNotepadId);
  pushId(state.settings.lastNotepadId);
  recent.forEach(pushId);
  pads
    .slice()
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .forEach((p) => pushId(p.id));
  return ordered;
}

function truncateQuickTitle(name, max = 18) {
  const t = String(name || '').trim() || 'Note';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function renderNotepadQuickBar() {
  const bar = els.notepadQuickBar;
  const scroll = els.notepadQuickScroll;
  if (!bar || !scroll) return;
  const show =
    isNoteMode() &&
    !state.selectionMode &&
    els.filterDock &&
    !els.filterDock.hidden;
  if (!show) {
    bar.hidden = true;
    scroll.innerHTML = '';
    return;
  }
  const pads = orderedNotepadsForQuickBar();
  bar.hidden = false;
  if (!pads.length) {
    scroll.innerHTML = '<span class="notepad-quick-empty">ยังไม่มีหัวข้อ — กด + เพื่อสร้าง</span>';
    return;
  }
  const activeId = state.activeNotepadId || state.settings.lastNotepadId || '';
  scroll.innerHTML = pads
    .map((pad) => {
      const active = pad.id === activeId ? ' is-active' : '';
      const label = truncateQuickTitle(pad.name);
      return `<button type="button" class="notepad-quick-chip${active}" data-notepad-quick-id="${escapeHtml(pad.id)}" title="${escapeHtml(pad.name || 'Note')}" aria-current="${pad.id === activeId ? 'page' : 'false'}">${escapeHtml(label)}</button>`;
    })
    .join('');
  // Keep the active chip near the left edge for thumb reach.
  queueMicrotask(() => {
    const activeChip = scroll.querySelector('.notepad-quick-chip.is-active');
    if (!activeChip) return;
    try {
      activeChip.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    } catch {
      /* ignore */
    }
  });
}

function onNotepadQuickChipClick(notepadId) {
  if (!notepadId) return;
  if (state.activeNotepadId === notepadId && state.view === 'editor') {
    // Already open — jump to content for writing.
    try { els.noteContent?.focus({ preventScroll: false }); }
    catch { els.noteContent?.focus(); }
    return;
  }
  // Selecting a note title opens the pad focused on content (not the title field).
  openNotepadEditor(notepadId, { focusTitle: false });
}

function cloneNoteSnapshot(note) {
  if (!note) return null;
  try {
    return structuredClone(note);
  } catch {
    return JSON.parse(JSON.stringify(note));
  }
}

function selectionCount() {
  return state.selectedIds?.size || 0;
}

function isNoteSelected(noteId) {
  return Boolean(state.selectedIds?.has(noteId));
}

function enterSelectionMode(noteId) {
  closeContextMenu();
  closeFilterMenus();
  state.selectionMode = true;
  state.selectedIds = new Set(noteId ? [noteId] : []);
  updateFilterDockVisibility();
  renderNotesList();
  setStatus(noteId ? 'เลือกแล้ว · แตะรายการอื่นต่อ' : 'โหมดเลือก');
}

function exitSelectionMode({ silent = false } = {}) {
  if (!state.selectionMode && !(state.selectedIds?.size)) return;
  state.selectionMode = false;
  state.selectedIds = new Set();
  updateFilterDockVisibility();
  renderNotesList();
  if (!silent) setStatus('');
}

function toggleNoteSelected(noteId) {
  if (!noteId) return;
  if (!state.selectionMode) {
    enterSelectionMode(noteId);
    return;
  }
  if (state.selectedIds.has(noteId)) state.selectedIds.delete(noteId);
  else state.selectedIds.add(noteId);
  if (state.selectedIds.size === 0) {
    exitSelectionMode({ silent: true });
    return;
  }
  renderSelectionDock();
  // Update card chrome without full list rebuild when possible
  const safeId = String(noteId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const card = els.notesList?.querySelector(`.note-card[data-note-id="${safeId}"]`);
  if (card) card.classList.toggle('is-selected', isNoteSelected(noteId));
  else renderNotesList();
}

function batchActionsForGroup() {
  if (state.listGroup === NOTE_STATUS.ACTIVE) {
    return [
      { id: 'done', label: 'ทำแล้ว', className: 'primary' },
      { id: 'trash', label: 'ลบ', className: 'danger' },
    ];
  }
  if (state.listGroup === NOTE_STATUS.DONE) {
    return [
      { id: 'restore', label: 'คืนเป็นงาน', className: 'primary' },
      { id: 'trash', label: 'ลบ', className: 'danger' },
    ];
  }
  return [
    { id: 'restore', label: 'กู้คืน', className: 'primary' },
    { id: 'purge', label: 'ลบถาวร', className: 'danger' },
  ];
}

function renderSelectionDock() {
  if (!els.selectionDock) return;
  const n = selectionCount();
  if (els.selectionCountLabel) {
    els.selectionCountLabel.textContent = `${n} รายการ`;
  }
  if (!els.selectionDockActions) return;
  els.selectionDockActions.innerHTML = '';
  batchActionsForGroup().forEach((a) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `selection-dock-btn${a.className ? ` ${a.className}` : ''}`;
    btn.textContent = a.label;
    btn.disabled = n === 0;
    btn.addEventListener('click', () => applyBatchAction(a.id));
    els.selectionDockActions.appendChild(btn);
  });
}

async function applyBatchAction(action) {
  const ids = [...(state.selectedIds || [])];
  if (!ids.length) return;

  if (action === 'trash' && ids.length >= 2) {
    const ok = await showConfirm(`ลบ ${ids.length} รายการไปถังขยะ?`, {
      okLabel: 'ลบ',
      danger: true,
    });
    if (!ok) return;
  }
  if (action === 'purge') {
    const ok = await showConfirm(`ลบถาวร ${ids.length} รายการ? กู้คืนไม่ได้`, {
      okLabel: 'ลบถาวร',
      danger: true,
    });
    if (!ok) return;
  }

  const snapshots = ids.map((id) => cloneNoteSnapshot(getNoteById(id))).filter(Boolean);
  let data = state.notesData;
  let advancedCount = 0;
  let changed = 0;

  if (action === 'purge') {
    ids.forEach((id) => {
      data = purgeNote(id, data);
      changed += 1;
    });
    state.notesData = data;
    autosave();
    exitSelectionMode({ silent: true });
    renderNotesList();
    refreshNoteNotifications();
    setStatus(`ลบถาวร ${changed} รายการ`);
    return;
  }

  for (const id of ids) {
    const note = data.notes.find((n) => n.id === id);
    if (!note) continue;
    let updated = note;
    if (action === 'done') {
      const result = completeOrAdvanceNote(note, markNoteDone);
      updated = result.note;
      if (result.advanced) advancedCount += 1;
    } else if (action === 'trash') {
      updated = moveNoteToTrash(note);
    } else if (action === 'restore') {
      updated =
        state.listGroup === NOTE_STATUS.TRASH
          ? restoreNoteFromTrash(note)
          : markNoteActive(note);
    } else {
      continue;
    }
    data = updateNoteInData(data, updated);
    changed += 1;
  }

  if (!changed) return;

  state.notesData = data;
  autosave();
  exitSelectionMode({ silent: true });
  renderNotesList();
  refreshNoteNotifications();

  const undo = () => {
    let restored = state.notesData;
    snapshots.forEach((snap) => {
      restored = updateNoteInData(restored, snap);
    });
    state.notesData = restored;
    autosave();
    renderNotesList();
    refreshNoteNotifications();
    setStatus('เลิกทำแล้ว');
  };

  if (action === 'done') {
    const msg =
      advancedCount && advancedCount === changed
        ? `เลื่อนรอบถัดไป ${changed} รายการ`
        : advancedCount
          ? `ทำแล้ว ${changed} รายการ (ซ้ำ ${advancedCount})`
          : `ย้ายไปทำแล้ว ${changed} รายการ`;
    setStatus(msg, { undo });
  } else if (action === 'trash') {
    setStatus(`ย้ายไปถังขยะ ${changed} รายการ`, { undo });
  } else {
    setStatus(`กู้คืน ${changed} รายการ`, { undo });
  }
}

function initSelectionDock() {
  els.selectionCancelBtn?.addEventListener('click', () => exitSelectionMode());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.selectionMode) {
      e.preventDefault();
      exitSelectionMode();
    }
  });
}

function syncFilterMenuChrome(open) {
  document.body.classList.toggle('filter-menu-open', Boolean(open));
}

function closeFilterMenus() {
  ['filterSortMenu', 'filterPriorityMenu', 'filterRecurrenceMenu', 'filterDueMenu'].forEach((key) => {
    const menu = els[key];
    if (menu) menu.hidden = true;
  });
  ['filterSortBtn', 'filterPriorityBtn', 'filterRecurrenceBtn', 'filterDueBtn'].forEach((key) => {
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
    els.filterSortBtn.title = `กำหนดเวลา · ${opt.label} · กดค้าง = ล่าสุด`;
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
  state.settings.dueScope = state.dueScope || null;
  state.settings.sortMode = state.sortMode || 'updated';
  saveSettings(state.settings);
}

function snapshotListViewPrefs() {
  return {
    tagFilterId: state.tagFilterId || null,
    priorityFilter: state.priorityFilter || null,
    recurrenceFilter: state.recurrenceFilter || null,
    dueScope: state.dueScope || null,
    sortMode: state.sortMode || 'updated',
  };
}

function sameListViewPrefs(a, b) {
  return (
    a.tagFilterId === b.tagFilterId &&
    a.priorityFilter === b.priorityFilter &&
    a.recurrenceFilter === b.recurrenceFilter &&
    a.dueScope === b.dueScope &&
    a.sortMode === b.sortMode
  );
}

function restoreListViewPrefs(snap) {
  if (!snap) return;
  state.tagFilterId = snap.tagFilterId;
  state.priorityFilter = snap.priorityFilter;
  state.recurrenceFilter = snap.recurrenceFilter;
  state.dueScope = snap.dueScope;
  state.sortMode = snap.sortMode || 'updated';
  persistFilters();
  renderNotesList();
}

/** Apply list filter/sort change with Undo (bottom-left ↩). */
function commitListViewChange(mutator, statusMsg, { silent = false } = {}) {
  const prev = snapshotListViewPrefs();
  mutator();
  const next = snapshotListViewPrefs();
  if (sameListViewPrefs(prev, next)) return false;
  persistFilters();
  renderNotesList();
  if (silent) return true;
  const text = String(statusMsg || 'อัปเดตตัวกรอง').trim();
  if (!text) return true;
  setStatus(text, {
    undo: () => {
      restoreListViewPrefs(prev);
      setStatus('เลิกทำตัวกรองแล้ว');
    },
  });
  return true;
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
  state.dueScope = normalizeDueScope(s.dueScope);
  // Keep settings in sync if a deleted tag was dropped
  if (s.tagFilterId && s.tagFilterId !== TAG_FILTER_UNTAGGED && !tagId) {
    state.settings.tagFilterId = null;
    saveSettings(state.settings);
  }
}

function setSortMode(mode) {
  const opt = SORT_FILTER_OPTIONS.find((o) => o.id === mode);
  const label = opt?.label || mode;
  commitListViewChange(() => {
    state.sortMode = mode;
  }, `เรียง · ${label}`);
}

function countNotesByDueScope(notes, scope) {
  return filterNotesByDueScope(notes, scope).length;
}

function renderDueScopeBar() {
  const current = normalizeDueScope(state.dueScope);
  const opt = DUE_SCOPE_OPTIONS.find((o) => o.id === current);
  const isFiltered = Boolean(current);
  if (els.filterDueBtn) {
    els.filterDueBtn.textContent = isFiltered && opt ? opt.label : 'กำหนด';
    els.filterDueBtn.classList.toggle('is-active', isFiltered);
    els.filterDueBtn.title = isFiltered && opt
      ? `กำหนด · ${opt.label} · กดค้าง = ทั้งหมด`
      : 'กำหนด · กดค้าง = ทั้งหมด';
  }
  const groupNotes = notesForCurrentGroup();
  fillFilterMenu(
    els.filterDueMenu,
    DUE_SCOPE_OPTIONS.map((o) => {
      let label = o.label;
      if (o.id) {
        const n = countNotesByDueScope(groupNotes, o.id);
        if (n) label = `${o.label} (${n})`;
      }
      return {
        label,
        selected: current === o.id,
        onSelect: () => {
          const label = o.id && DUE_SCOPE_OPTIONS.find((x) => x.id === o.id)?.label;
          commitListViewChange(() => {
            state.dueScope = o.id;
          }, label ? `กำหนด · ${label}` : 'กำหนด · ทั้งหมด');
        },
      };
    }),
  );
}

function renderPriorityFilterBar() {
  const current = state.priorityFilter || null;
  const opt = PRIORITY_OPTIONS.find((o) => o.id === current);
  if (els.filterPriorityBtn) {
    els.filterPriorityBtn.textContent = opt ? opt.short : 'ความสำคัญ';
    els.filterPriorityBtn.classList.toggle('is-active', Boolean(current));
    els.filterPriorityBtn.title = opt
      ? `ความสำคัญ · ${opt.label} · กดค้าง = ทั้งหมด`
      : 'ความสำคัญ · กดค้าง = ทั้งหมด';
  }
  const items = [
    {
      label: 'ทั้งหมด',
      selected: !current,
      onSelect: () => {
        commitListViewChange(() => {
          state.priorityFilter = null;
        }, 'ความสำคัญ · ทั้งหมด');
      },
    },
    ...PRIORITY_OPTIONS.map((o) => ({
      label: o.label,
      selected: current === o.id,
      onSelect: () => {
        commitListViewChange(() => {
          state.priorityFilter = o.id;
        }, `ความสำคัญ · ${o.label}`);
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

function getMonthPresets() {
  return normalizeMonthPresets(state.settings?.notifyMonthPresets);
}

function fillSelectOptions(select, options, preferredValue) {
  if (!select) return;
  const cur = preferredValue !== undefined ? preferredValue : select.value;
  select.innerHTML = '';
  options.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = item.id == null ? '' : String(item.id);
    opt.textContent = item.label;
    select.appendChild(opt);
  });
  const values = new Set([...select.options].map((o) => o.value));
  if (cur != null && cur !== '' && !values.has(String(cur))) {
    const opt = document.createElement('option');
    opt.value = String(cur);
    const months = monthIntervalFromId(cur);
    opt.textContent = months ? `ทุก ${months} เดือน` : String(cur);
    select.appendChild(opt);
  }
  if (cur != null && cur !== undefined) {
    select.value = String(cur);
  }
}

function refreshScheduleSelectOptions() {
  const presets = getMonthPresets();
  const notifyOpts = buildNotifyRepeatSelectOptions(presets);
  const recurOpts = buildRecurrenceSelectOptions(presets);
  fillSelectOptions(els.noteNotifyRepeat, notifyOpts, els.noteNotifyRepeat?.value || 'none');
  fillSelectOptions(els.aiNoteDraftNotifyRepeat, notifyOpts, els.aiNoteDraftNotifyRepeat?.value || 'none');
  fillSelectOptions(els.aiNoteDraftRecurrence, recurOpts, els.aiNoteDraftRecurrence?.value || '');
}

/** If recurrence / notify-repeat needs an anchor and schedule is empty → today 09:00. */
function ensureAiScheduleAnchor() {
  if (!els.aiNoteDraftSchedule) return;
  if (els.aiNoteDraftSchedule.value) return;
  const recurrence = normalizeRecurrence(els.aiNoteDraftRecurrence?.value);
  const notifyRepeat = normalizeNotifyRepeat(els.aiNoteDraftNotifyRepeat?.value);
  if (!recurrence && notifyRepeat === 'none') return;
  els.aiNoteDraftSchedule.value = defaultDatetimeLocalValue();
  syncAiScheduleDisplay();
}

function renderEditorRecurrence() {
  if (!els.editorRecurrence) return;
  els.editorRecurrence.innerHTML = '';
  const note = getActiveNote();
  if (!note) return;

  const current = normalizeRecurrence(note.recurrence);
  const options = buildRecurrenceChipOptions(getMonthPresets());
  // Keep a custom everyNmo chip visible if not in presets.
  if (current && !options.some((o) => o.id === current)) {
    const months = monthIntervalFromId(current);
    if (months) {
      options.splice(options.length - 1, 0, {
        id: current,
        label: `ทุก ${months} เดือน`,
        short: `${months} ด.`,
      });
    }
  }
  options.forEach((opt) => {
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
  // Choosing a repeat without a date → default to today 09:00 (มาตรฐานแจ้งเตือน).
  if (nextRecurrence && !fromDatetimeLocalValue(els.noteSchedule.value) && !note.scheduledAt) {
    const local = defaultDatetimeLocalValue();
    els.noteSchedule.value = local;
    patch.scheduledAt = fromDatetimeLocalValue(local);
  }
  const updated = updateNote(note, patch);
  state.notesData = updateNoteInData(state.notesData, updated);
  autosave();
  renderEditorRecurrence();
}

function renderRecurrenceFilterBar() {
  const current = normalizeRecurrenceFilter(state.recurrenceFilter);
  const filterOptions = buildRecurrenceFilterOptions(getMonthPresets());
  const opt = filterOptions.find((o) => o.id === current);
  const isFiltered = Boolean(current);
  if (els.filterRecurrenceBtn) {
    els.filterRecurrenceBtn.textContent = isFiltered && opt ? opt.label : 'การซ้ำ';
    els.filterRecurrenceBtn.classList.toggle('is-active', isFiltered);
    els.filterRecurrenceBtn.title = isFiltered && opt
      ? `การซ้ำ · ${opt.label} · กดค้าง = ทั้งหมด`
      : 'การซ้ำ · กดค้าง = ทั้งหมด';
  }
  const groupNotes = notesForCurrentGroup();
  fillFilterMenu(
    els.filterRecurrenceMenu,
    filterOptions.map((o) => {
      let label = o.label;
      if (o.id) {
        const n = countNotesByRecurrence(groupNotes, o.id);
        if (n) label = `${o.label} (${n})`;
      }
      return {
        label,
        selected: current === o.id,
        onSelect: () => {
          const label = o.id
            ? filterOptions.find((x) => x.id === o.id)?.label
            : 'ทั้งหมด';
          commitListViewChange(() => {
            state.recurrenceFilter = o.id;
          }, `การซ้ำ · ${label || 'ทั้งหมด'}`);
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
  /* Dock tag button retired — floating tag icons handle filtering. */
}

function initFilterDock() {
  const bindings = [
    [
      els.filterDueBtn,
      els.filterDueMenu,
      () => {
        if (!normalizeDueScope(state.dueScope)) {
          setStatus('กำหนด · ทั้งหมดอยู่แล้ว');
          return;
        }
        commitListViewChange(() => {
          state.dueScope = null;
        }, 'กำหนด · ทั้งหมด');
      },
    ],
    [
      els.filterSortBtn,
      els.filterSortMenu,
      () => {
        if (state.sortMode === 'updated') {
          setStatus('เรียงล่าสุดอยู่แล้ว');
          return;
        }
        setSortMode('updated');
      },
    ],
    [
      els.filterPriorityBtn,
      els.filterPriorityMenu,
      () => {
        if (!state.priorityFilter) {
          setStatus('ความสำคัญ · ทั้งหมดอยู่แล้ว');
          return;
        }
        commitListViewChange(() => {
          state.priorityFilter = null;
        }, 'ความสำคัญ · ทั้งหมด');
      },
    ],
    [
      els.filterRecurrenceBtn,
      els.filterRecurrenceMenu,
      () => {
        if (!normalizeRecurrenceFilter(state.recurrenceFilter)) {
          setStatus('การซ้ำ · ทั้งหมดอยู่แล้ว');
          return;
        }
        commitListViewChange(() => {
          state.recurrenceFilter = null;
        }, 'การซ้ำ · ทั้งหมด');
      },
    ],
  ];

  bindings.forEach(([btn, menu, resetFn]) => {
    if (!btn || !menu) return;
    let suppressClick = false;
    let openedByPointer = false;
    let timer = null;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let moved = false;
    const LONG_MS = 420;
    const MOVE_PX = 12;

    const clearTimer = () => {
      clearTimeout(timer);
      timer = null;
    };

    const detachWindow = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onWinUp, true);
      window.removeEventListener('pointercancel', onWinUp, true);
    };

    const onMove = (e) => {
      if (pointerId == null || e.pointerId !== pointerId) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_PX) {
        moved = true;
        clearTimer();
      }
    };

    const onWinUp = (e) => {
      if (pointerId == null || e.pointerId !== pointerId) return;
      const wasMoved = moved;
      const longPressed = suppressClick;
      clearTimer();
      pointerId = null;
      detachWindow();
      if (longPressed || wasMoved) return;
      const r = btn.getBoundingClientRect();
      const pad = 10;
      if (
        e.clientX < r.left - pad ||
        e.clientX > r.right + pad ||
        e.clientY < r.top - pad ||
        e.clientY > r.bottom + pad
      ) {
        return;
      }
      openedByPointer = true;
      openFilterMenu(menu, btn);
    };

    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      clearTimer();
      detachWindow();
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      moved = false;
      openedByPointer = false;
      // Do not setPointerCapture — on iOS it often swallows the following click.
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onWinUp, true);
      window.addEventListener('pointercancel', onWinUp, true);
      timer = setTimeout(() => {
        timer = null;
        suppressClick = true;
        openedByPointer = true;
        btn.classList.add('is-filter-reset');
        closeFilterMenus();
        resetFn();
        if (navigator.vibrate) {
          try {
            navigator.vibrate(12);
          } catch {
            /* ignore */
          }
        }
        setTimeout(() => btn.classList.remove('is-filter-reset'), 220);
      }, LONG_MS);
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (openedByPointer) {
        openedByPointer = false;
        suppressClick = false;
        return;
      }
      if (suppressClick) {
        suppressClick = false;
        return;
      }
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
    return `<span class="schedule-badge upcoming">${escapeHtml(recur)}</span>`;
  }
  const status = getScheduleStatus(note.scheduledAt);
  const rel = relativeDayLabel(note.scheduledAt);
  const date = shortDate(note.scheduledAt);
  const prefix = recur ? `${escapeHtml(recur)} · ` : '';
  return `<span class="schedule-badge ${status}">${prefix}${escapeHtml(rel)} · ${escapeHtml(date)}</span>`;
}

/** Compact proximity cell for list row (right column) — legacy 3-col layout. */
function proximityCellHtml(note) {
  if (state.listGroup !== NOTE_STATUS.ACTIVE || !note.scheduledAt) {
    return `<div class="card-col card-col-due is-empty" aria-hidden="true"></div>`;
  }
  const prox = scheduleProximity(note.scheduledAt);
  if (prox.level === 'none' || !prox.label) {
    return `<div class="card-col card-col-due is-empty" aria-hidden="true"></div>`;
  }
  return `
    <div class="card-col card-col-due due-${escapeHtml(prox.level)}" title="${escapeHtml(relativeDayLabel(note.scheduledAt))}">
      <span class="due-count">${escapeHtml(prox.label)}</span>
    </div>
  `;
}

/** Short label for floating circular tag icons. */
function tagAbbrev(name) {
  const t = String(name || '').trim();
  if (!t) return '?';
  if (/^[A-Za-z0-9]/.test(t)) {
    const compact = t.replace(/[^A-Za-z0-9]/g, '');
    return (compact.slice(0, 2) || t.slice(0, 2)).toUpperCase();
  }
  return t.slice(0, 2);
}

let iconPickerTarget = null; // { type: 'tag'|'priority', id: string, label: string }

function getPriorityIcons() {
  return normalizePriorityIcons(state.settings?.priorityIcons || DEFAULT_PRIORITY_ICONS);
}

function getCardDisplay() {
  return normalizeCardDisplay(state.settings?.cardDisplay || DEFAULT_CARD_DISPLAY);
}

function metaShowsText(mode) {
  return mode === 'text' || mode === 'both';
}
function metaShowsIcon(mode) {
  return mode === 'icon' || mode === 'both';
}

function priorityIconColor(prio) {
  const display = getCardDisplay();
  const defaults = normalizePriorityColors(state.settings.priorityColors);
  if (display.iconColorMode === 'custom') {
    const custom = display.priorityIconColors?.[prio];
    if (custom) return custom;
  }
  return defaults[prio] || defaults.normal;
}

function cardLeadingIconHtml(note, tags) {
  const display = getCardDisplay();
  if (!display.leadIcon) return '';
  const firstTag = (tags || [])[0];
  const prio = notePriority(note);
  const prioIcons = getPriorityIcons();
  if (firstTag) {
    const iconId = normalizeIconId(firstTag.icon || bestIconForLabel(firstTag.name), 'doc');
    const color = safeTagColor(firstTag.color);
    return `<span class="card-lead-icon" style="--lead:${color}" title="${escapeHtml(firstTag.name)}">${iconSvg(iconId, { size: 16, className: 'card-lead-svg' })}</span>`;
  }
  const iconId = prioIcons[prio] || DEFAULT_PRIORITY_ICONS[prio] || 'circle';
  const color = priorityIconColor(prio);
  return `<span class="card-lead-icon is-prio" style="--lead:${color}" title="${escapeHtml(priorityLabel(prio))}">${iconSvg(iconId, { size: 16, className: 'card-lead-svg' })}</span>`;
}

function closeIconPicker() {
  iconPickerTarget = null;
  if (els.iconPickerOverlay) els.iconPickerOverlay.hidden = true;
}

function fillIconPickerGrid(host, icons, selectedId) {
  if (!host) return;
  host.innerHTML = icons
    .map((icon) => {
      const on = icon.id === selectedId ? ' is-on' : '';
      return `<button type="button" class="icon-pick-btn${on}" data-icon-id="${icon.id}" title="${escapeHtml(icon.label)}" aria-label="${escapeHtml(icon.label)}" aria-pressed="${icon.id === selectedId ? 'true' : 'false'}">${iconSvg(icon.id, { size: 20, className: 'icon-pick-svg' })}<span class="icon-pick-label">${escapeHtml(icon.label)}</span></button>`;
    })
    .join('');
}

function openIconPicker(target) {
  iconPickerTarget = target;
  if (!els.iconPickerOverlay) return;
  const label = target.label || '';
  const selected = normalizeIconId(target.iconId, 'doc');
  if (els.iconPickerTitle) {
    els.iconPickerTitle.textContent =
      target.type === 'priority' ? `ไอคอน · ${label}` : `ไอคอนแท็ก · ${label || 'แท็ก'}`;
  }
  if (els.iconPickerHint) {
    els.iconPickerHint.textContent = label
      ? `แนะนำจากชื่อ「${label}」`
      : 'ไอคอนที่แนะนำ';
  }
  const suggest = suggestIconsForLabel(label, { limit: 8 });
  fillIconPickerGrid(els.iconPickerSuggest, suggest, selected);
  fillIconPickerGrid(els.iconPickerAll, allIcons(), selected);
  els.iconPickerOverlay.hidden = false;
}

function applyPickedIcon(iconId) {
  if (!iconPickerTarget) return;
  const id = normalizeIconId(iconId, 'doc');
  if (iconPickerTarget.type === 'tag') {
    commitData(setTagIcon(state.notesData, iconPickerTarget.id, id));
  } else if (iconPickerTarget.type === 'priority') {
    const next = { ...getPriorityIcons(), [iconPickerTarget.id]: id };
    state.settings.priorityIcons = normalizePriorityIcons(next);
    saveSettings(state.settings);
    renderPriorityIconSettings();
    renderNotesList();
  }
  closeIconPicker();
}


function applyCardDisplaySettingsUi() {
  const display = getCardDisplay();
  state.settings.cardDisplay = display;
  els.cardLeadIconSeg?.querySelectorAll('[data-card-lead]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cardLead === (display.leadIcon ? '1' : '0'));
  });
  ['tag', 'priority', 'due', 'recurrence'].forEach((key) => {
    const seg = document.querySelector(`[data-card-meta="${key}"]`);
    seg?.querySelectorAll('[data-meta-show]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.metaShow === display[key]);
    });
  });
  els.cardIconColorSeg?.querySelectorAll('[data-icon-color-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.iconColorMode === display.iconColorMode);
  });
  if (els.cardIconColorCustom) {
    els.cardIconColorCustom.hidden = display.iconColorMode !== 'custom';
  }
  const defaults = normalizePriorityColors(state.settings.priorityColors);
  els.priorityIconColorGrid?.querySelectorAll('[data-prio-icon-color]').forEach((input) => {
    const key = input.dataset.prioIconColor;
    input.value = display.priorityIconColors?.[key] || defaults[key] || '#8b929a';
  });
}

function persistCardDisplayPatch(patch) {
  const next = normalizeCardDisplay({ ...getCardDisplay(), ...patch });
  state.settings.cardDisplay = next;
  saveSettings(state.settings);
  applyCardDisplaySettingsUi();
  renderNotesList();
}

function renderPriorityIconSettings() {
  const grid = els.priorityIconGrid;
  if (!grid) return;
  const icons = getPriorityIcons();
  grid.innerHTML = PRIORITY_OPTIONS.map((opt) => {
    const iconId = icons[opt.id] || DEFAULT_PRIORITY_ICONS[opt.id];
    return `<button type="button" class="priority-icon-row" data-priority-icon="${opt.id}" title="เลือกไอคอน ${escapeHtml(opt.label)}">
      <span class="priority-icon-swatch">${iconSvg(iconId, { size: 18 })}</span>
      <span class="priority-icon-name">${escapeHtml(opt.label)}</span>
      <span class="priority-icon-chev">›</span>
    </button>`;
  }).join('');
}

/**
 * Inside-card meta: tag · priority · recurrence · due as plain colored text,
 * horizontal, top-right — no hang badges.
 */
function cardMetaInlineHtml(note, tags) {
  if (state.listGroup !== NOTE_STATUS.ACTIVE) return '';
  const display = getCardDisplay();
  const parts = [];
  const firstTag = (tags || [])[0];
  if (firstTag && display.tag !== 'off') {
    const color = safeTagColor(firstTag.color);
    const iconId = normalizeIconId(firstTag.icon || bestIconForLabel(firstTag.name), 'doc');
    const iconPart = metaShowsIcon(display.tag)
      ? `<span class="meta-ico" aria-hidden="true">${iconSvg(iconId, { size: 12, className: 'meta-ico-svg' })}</span>`
      : '';
    const textPart = metaShowsText(display.tag)
      ? `<span class="meta-txt">${escapeHtml(firstTag.name)}</span>`
      : '';
    parts.push(
      `<span class="meta-bit meta-tag" style="--tag:${color}" title="${escapeHtml(firstTag.name)}">${iconPart}${textPart}</span>`,
    );
  }
  const priority = notePriority(note);
  if (priority !== NOTE_PRIORITY.NORMAL && display.priority !== 'off') {
    const prioIcons = getPriorityIcons();
    const iconId = prioIcons[priority] || DEFAULT_PRIORITY_ICONS[priority] || 'circle';
    const color = priorityIconColor(priority);
    const iconPart = metaShowsIcon(display.priority)
      ? `<span class="meta-ico" style="color:${color}" aria-hidden="true">${iconSvg(iconId, { size: 12, className: 'meta-ico-svg' })}</span>`
      : '';
    const textPart = metaShowsText(display.priority)
      ? `<span class="meta-txt">${escapeHtml(priorityLabel(priority, { short: true }))}</span>`
      : '';
    parts.push(
      `<span class="meta-bit meta-prio priority-${escapeHtml(priority)}" style="--prio-meta:${color}" title="${escapeHtml(priorityLabel(priority))}">${iconPart}${textPart}</span>`,
    );
  }
  const recur = recurrenceLabel(note.recurrence, { short: true });
  if (recur && display.recurrence !== 'off') {
    const iconPart = metaShowsIcon(display.recurrence)
      ? `<span class="meta-ico" aria-hidden="true">${iconSvg('clock', { size: 12, className: 'meta-ico-svg' })}</span>`
      : '';
    const textPart = metaShowsText(display.recurrence)
      ? `<span class="meta-txt">${escapeHtml(recur)}</span>`
      : '';
    parts.push(
      `<span class="meta-bit meta-recur" title="ทำซ้ำ">${iconPart}${textPart}</span>`,
    );
  }
  if (note.scheduledAt && display.due !== 'off') {
    const prox = scheduleProximity(note.scheduledAt);
    if (prox.level !== 'none' && prox.label) {
      const tip = relativeDayLabel(note.scheduledAt);
      const iconPart = metaShowsIcon(display.due)
        ? `<span class="meta-ico" aria-hidden="true">${iconSvg('calendar', { size: 12, className: 'meta-ico-svg' })}</span>`
        : '';
      const textPart = metaShowsText(display.due)
        ? `<span class="meta-txt">${escapeHtml(prox.label)}</span>`
        : '';
      parts.push(
        `<span class="meta-bit meta-due due-${escapeHtml(prox.level)}" title="${escapeHtml(tip)}">${iconPart}${textPart}</span>`,
      );
    }
  }
  if (!parts.length) return '';
  return `<div class="card-meta-inline">${parts.join('')}</div>`;
}

function renderFloatTagIcons() {
  const rail = els.floatTagRail;
  const host = els.floatTagIcons;
  if (!rail || !host) return;
  const show =
    state.view === 'list' &&
    !isNoteMode() &&
    !state.selectionMode &&
    state.listGroup === NOTE_STATUS.ACTIVE &&
    els.filterDock &&
    !els.filterDock.hidden;
  if (!show) {
    rail.hidden = true;
    host.innerHTML = '';
    return;
  }
  rail.hidden = false;
  const tags = orderedFilterTags();
  const currentId = state.tagFilterId || null;
  const allActive = !currentId ? ' is-active' : '';
  const noneActive = currentId === TAG_FILTER_UNTAGGED ? ' is-active' : '';
  const mid = tags
    .slice(0, 8)
    .map((tag) => {
      const active = currentId === tag.id ? ' is-active' : '';
      const iconId = normalizeIconId(tag.icon || bestIconForLabel(tag.name), 'doc');
      const glyph = iconSvg(iconId, { size: 15, className: 'float-tag-svg' });
      return `<button type="button" class="float-tag-icon has-svg${active}" data-float-tag-id="${escapeHtml(tag.id)}" title="${escapeHtml(tag.name)}" aria-label="แท็ก ${escapeHtml(tag.name)}" aria-pressed="${currentId === tag.id ? 'true' : 'false'}" style="--tag:${safeTagColor(tag.color)}">${glyph}</button>`;
    })
    .join('');
  host.innerHTML = `
    <button type="button" class="float-tag-icon is-edge${allActive}" data-float-tag-id="all" title="แท็กทั้งหมด" aria-label="แท็กทั้งหมด" aria-pressed="${!currentId ? 'true' : 'false'}">ทั้งหมด</button>
    ${mid}
    <button type="button" class="float-tag-icon is-edge${noneActive}" data-float-tag-id="${TAG_FILTER_UNTAGGED}" title="ไม่มีแท็ก" aria-label="ไม่มีแท็ก" aria-pressed="${currentId === TAG_FILTER_UNTAGGED ? 'true' : 'false'}">ไม่มีแท็ก</button>
  `;
}

function applyFloatTagFilter(tagId) {
  if (!tagId || state.selectionMode) return;
  if (state.listGroup !== NOTE_STATUS.ACTIVE) return;
  if (tagId === 'all') {
    if (!state.tagFilterId) return;
    commitListViewChange(() => {
      state.tagFilterId = null;
    }, '', { silent: true });
    return;
  }
  if (tagId === TAG_FILTER_UNTAGGED) {
    if (state.tagFilterId === TAG_FILTER_UNTAGGED) {
      commitListViewChange(() => {
        state.tagFilterId = null;
      }, '', { silent: true });
      return;
    }
    commitListViewChange(() => {
      state.tagFilterId = TAG_FILTER_UNTAGGED;
    }, '', { silent: true });
    return;
  }
  applyTagFilterFromCard(tagId);
}

function tagsCellHtml(tags) {
  if (!tags.length) {
    return `
      <div class="card-col card-col-tags is-empty" aria-hidden="true">
        <span class="card-tag-name is-muted">—</span>
      </div>
    `;
  }
  const names = tags
    .slice(0, 2)
    .map((tag) => {
      const active = state.tagFilterId === tag.id ? ' is-filter-active' : '';
      return `<button type="button" class="card-tag-name${active}" data-tag-id="${escapeHtml(tag.id)}" style="--tag:${safeTagColor(tag.color)}" title="กรองแท็ก ${escapeHtml(tag.name)}">${escapeHtml(tag.name)}</button>`;
    })
    .join('');
  const more = tags.length > 2 ? `<span class="card-tag-more">+${tags.length - 2}</span>` : '';
  return `<div class="card-col card-col-tags">${names}${more}</div>`;
}

function tagsInlineHtml(tags) {
  if (!tags.length) return '';
  const chips = tags
    .slice(0, 3)
    .map((tag) => {
      const active = state.tagFilterId === tag.id ? ' is-filter-active' : '';
      return `<button type="button" class="card-tag-inline${active}" data-tag-id="${escapeHtml(tag.id)}" style="--tag:${safeTagColor(tag.color)}" title="กรองแท็ก ${escapeHtml(tag.name)}">${escapeHtml(tag.name)}</button>`;
    })
    .join('');
  const more = tags.length > 3 ? `<span class="card-tag-more">+${tags.length - 3}</span>` : '';
  return `<div class="card-tags-inline">${chips}${more}</div>`;
}

function syncTitlesOnlyListClass() {
  const titlesOnly = state.settings.listShowContent !== true;
  const compactWork = !isNoteMode();
  els.notesList?.classList.toggle('notes-list--titles', titlesOnly);
  els.notesList?.classList.toggle('notes-list--compact', compactWork);
  document.body.classList.toggle('list-titles-only', titlesOnly);
}

/** Tap left tag column → filter list by that tag (tap again to clear). */
function applyTagFilterFromCard(tagId) {
  if (!tagId || state.selectionMode) return;
  if (state.listGroup !== NOTE_STATUS.ACTIVE) return;
  const tags = state.notesData?.tags || [];
  const tag = tags.find((t) => t.id === tagId);
  if (!tag) return;

  if (state.tagFilterId === tagId) {
    commitListViewChange(() => {
      state.tagFilterId = null;
    }, '', { silent: true });
    return;
  }
  commitListViewChange(() => {
    state.tagFilterId = tagId;
  }, '', { silent: true });
}

function initNotesListTagFilter() {
  els.notesList?.addEventListener(
    'click',
    (event) => {
      const btn = event.target.closest?.(
        '.card-tag-name[data-tag-id], .card-tag-inline[data-tag-id], .card-hang-tag[data-tag-id]',
      );
      if (!btn || !els.notesList.contains(btn)) return;
      event.preventDefault();
      event.stopPropagation();
      applyTagFilterFromCard(btn.dataset.tagId);
    },
    true,
  );
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
function showConfirm(message, { okLabel = 'ตกลง', cancelLabel = 'ยกเลิก', danger = false } = {}) {
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
    if (els.noteConfirmCancel) {
      els.noteConfirmCancel.textContent = cancelLabel;
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
  const selectItem = {
    id: 'select',
    label: 'เลือก',
    action: () => enterSelectionMode(note.id),
  };
  if (state.listGroup === NOTE_STATUS.ACTIVE) {
    return [
      selectItem,
      { id: 'done', label: 'ทำแล้ว', action: () => applyNoteAction(note.id, 'done') },
      { id: 'snooze', label: 'เลื่อน…', action: () => openSnoozeMenu(note.id) },
      { id: 'trash', label: 'ลบ', danger: true, action: () => applyNoteAction(note.id, 'trash') },
    ];
  }
  if (state.listGroup === NOTE_STATUS.DONE) {
    return [
      selectItem,
      { id: 'restore', label: 'คืนเป็นงาน', action: () => applyNoteAction(note.id, 'restore') },
      { id: 'trash', label: 'ลบ', danger: true, action: () => applyNoteAction(note.id, 'trash') },
    ];
  }
  return [
    selectItem,
    { id: 'restore', label: 'กู้คืน', action: () => applyNoteAction(note.id, 'restore') },
    {
      id: 'purge',
      label: 'ลบถาวร',
      danger: true,
      action: () => applyNoteAction(note.id, 'purge'),
    },
  ];
}

function formatScheduleWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function openSnoozeMenu(noteId) {
  const note = getNoteById(noteId);
  if (!note) return;

  state.contextNoteId = noteId;
  els.noteContextMenu.innerHTML = '';

  const hint = document.createElement('div');
  hint.className = 'context-menu-hint';
  hint.textContent = 'เลื่อนนัดครั้งนี้ · งานยังไม่เสร็จ · เตือนตามวันใหม่';
  els.noteContextMenu.appendChild(hint);

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'context-menu-item';
  back.textContent = '← กลับ';
  back.addEventListener('click', () => openContextMenu(noteId));
  els.noteContextMenu.appendChild(back);

  SNOOZE_OPTIONS.forEach((opt) => {
    const at = snoozeScheduledAt(note.scheduledAt, opt.id);
    const when = formatScheduleWhen(at);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'context-menu-item';
    btn.textContent = when ? `${opt.label} · ${when}` : opt.label;
    btn.addEventListener('click', () => {
      closeContextMenu();
      applyNoteAction(noteId, 'snooze', { snoozeId: opt.id });
    });
    els.noteContextMenu.appendChild(btn);
  });

  const custom = document.createElement('button');
  custom.type = 'button';
  custom.className = 'context-menu-item';
  custom.textContent = 'เลือกวันเวลา…';
  custom.addEventListener('click', () => {
    closeContextMenu();
    openSnoozePicker(noteId);
  });
  els.noteContextMenu.appendChild(custom);

  if (els.noteContextOverlay) els.noteContextOverlay.hidden = false;
  positionContextMenu(els.noteContextMenu);
  clearUiTextSelection();
}

function openSnoozePicker(noteId) {
  const note = getNoteById(noteId);
  if (!note || !els.snoozePickOverlay) return;
  snoozePickNoteId = noteId;
  const base = snoozeScheduledAt(note.scheduledAt, '1d') || defaultScheduleIso();
  if (els.snoozePickInput) {
    els.snoozePickInput.value = toDatetimeLocalValue(base);
  }
  els.snoozePickOverlay.hidden = false;
  queueMicrotask(() => {
    try {
      els.snoozePickInput?.focus();
      els.snoozePickInput?.showPicker?.();
    } catch {
      /* ignore */
    }
  });
}

function closeSnoozePicker() {
  snoozePickNoteId = null;
  if (els.snoozePickOverlay) els.snoozePickOverlay.hidden = true;
}

function confirmSnoozePicker() {
  const noteId = snoozePickNoteId;
  const iso = fromDatetimeLocalValue(els.snoozePickInput?.value);
  closeSnoozePicker();
  if (!noteId || !iso) {
    setStatus('เลือกวันเวลาก่อน');
    return;
  }
  applyNoteAction(noteId, 'snooze', { at: iso });
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
      if (item.id === 'snooze') {
        item.action();
        return;
      }
      closeContextMenu();
      item.action();
    });
    els.noteContextMenu.appendChild(btn);
  });

  if (els.noteContextOverlay) els.noteContextOverlay.hidden = false;
  positionContextMenu(els.noteContextMenu);
  clearUiTextSelection();
}

async function applyNoteAction(noteId, action, extra = {}) {
  const note = getNoteById(noteId);
  if (!note) return;

  const snapshot = { ...note };
  let updated = note;
  let advanced = false;
  if (action === 'done') {
    const result = completeOrAdvanceNote(note, markNoteDone);
    updated = result.note;
    advanced = result.advanced;
  } else if (action === 'snooze') {
    if (extra.at) {
      updated = snoozeNoteTo(note, extra.at);
    } else {
      const snoozeId = normalizeSnoozeId(extra.snoozeId);
      if (!snoozeId) {
        openSnoozeMenu(noteId);
        return;
      }
      updated = snoozeNote(note, snoozeId);
    }
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
  refreshNoteNotifications();

  const undo = () => {
    state.notesData = updateNoteInData(state.notesData, snapshot);
    autosave();
    renderNotesList();
    refreshNoteNotifications();
    setStatus('เลิกทำแล้ว');
  };

  if (action === 'done') {
    setStatus(advanced ? 'เลื่อนไปรอบถัดไป' : 'ย้ายไปทำแล้ว', { undo });
  } else if (action === 'snooze') {
    const when = formatScheduleWhen(updated.scheduledAt);
    setStatus(when ? `เลื่อนแล้ว · จะเตือน ${when}` : 'เลื่อนนัดแล้ว', { undo });
  } else if (action === 'trash') {
    setStatus('ย้ายไปถังขยะ', { undo });
  } else {
    setStatus('กู้คืนแล้ว', { undo });
  }
}

function cardActionsFor(note) {
  if (state.listGroup === NOTE_STATUS.ACTIVE) {
    return [
      { label: 'เลือก', title: 'เลือก', action: 'select' },
      { label: 'ทำแล้ว', title: 'ทำแล้ว', action: 'done' },
      { label: 'เลื่อน', title: 'เลื่อน', action: 'snooze' },
      { label: 'ลบ', title: 'ลบ', danger: true, action: 'trash' },
    ];
  }
  if (state.listGroup === NOTE_STATUS.DONE) {
    return [
      { label: 'เลือก', title: 'เลือก', action: 'select' },
      { label: 'คืน', title: 'คืนเป็นงาน', action: 'restore' },
      { label: 'ลบ', title: 'ลบ', danger: true, action: 'trash' },
    ];
  }
  return [
    { label: 'เลือก', title: 'เลือก', action: 'select' },
    { label: 'กู้คืน', title: 'กู้คืน', action: 'restore' },
    { label: 'ลบถาวร', title: 'ลบถาวร', danger: true, action: 'purge' },
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
      if (a.action === 'select') {
        toggleNoteSelected(note.id);
        return;
      }
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
  const dock =
    state.selectionMode && els.selectionDock && !els.selectionDock.hidden
      ? els.selectionDock
      : els.filterDock;
  if (!dock || dock.hidden) {
    document.documentElement.style.setProperty('--filters-dock-h', '0px');
    return;
  }
  const h = Math.ceil(dock.getBoundingClientRect().height || dock.offsetHeight || 0);
  document.documentElement.style.setProperty('--filters-dock-h', `${h}px`);
}

let filtersDockObserver = null;
function ensureFiltersDockObserver() {
  if (filtersDockObserver || typeof ResizeObserver === 'undefined') return;
  const targets = [els.filterDock, els.selectionDock].filter(Boolean);
  if (!targets.length) return;
  filtersDockObserver = new ResizeObserver(() => applyDockOffset());
  targets.forEach((el) => filtersDockObserver.observe(el));
}

function renderNotepadList() {
  renderGroupNav();
  applyCardDensity();
  ensureFiltersDockObserver();
  applyDockScale();
  renderNotepadQuickBar();
  applyDockOffset();
  requestAnimationFrame(applyDockOffset);

  const pads = normalizeNotepads(state.notesData.notepads);
  const q = String(state.searchQuery || '').trim().toLowerCase();
  const filtered = q
    ? pads.filter(
        (p) =>
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.content || '').toLowerCase().includes(q),
      )
    : pads;

  els.notesList.innerHTML = '';
  els.notesList.classList.remove('manual-sort');
  syncTitlesOnlyListClass();

  filtered.forEach((pad) => {
    const item = document.createElement('div');
    item.className = 'note-card note-card-split notepad-card';
    item.dataset.notepadId = pad.id;
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    const preview = String(pad.content || '').trim().slice(0, 160);
    item.innerHTML = `
      <div class="card-split-row card-split-title-first">
        <div class="card-col card-col-body">
          <h3 class="card-title">${escapeHtml(pad.name || 'Note')}</h3>
          ${preview ? `<p class="card-preview">${escapeHtml(preview)}</p>` : '<p class="card-preview" style="opacity:.55">ว่าง</p>'}
        </div>
      </div>`;
    attachNoteCardInteractions(item, {
      noteId: pad.id,
      onTap: () => openNotepadEditor(pad.id),
      onLongPress: () => promptRenameNotepad(pad.id),
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openNotepadEditor(pad.id);
      }
    });
    els.notesList.appendChild(item);
  });

  if (!filtered.length && q) {
    els.emptyStateText.textContent = `ไม่พบ “${q}”`;
  } else {
    els.emptyStateText.textContent = 'ยังไม่มี Note';
  }
  const hint = els.emptyState?.querySelector('.empty-state-hint');
  if (hint) {
    hint.textContent = 'Note = ข้อความล้วน · แยกจากงานหลัก · เพิ่มได้เรื่อยๆ เช่น ที่ดิน ร้านชา';
  }
  els.emptyState.hidden = filtered.length > 0;
  if (els.emptyAddBlankBtn) {
    els.emptyAddBlankBtn.hidden = false;
    els.emptyAddBlankBtn.textContent = '+ Note ใหม่';
  }
  if (els.emptyAddAiBtn) els.emptyAddAiBtn.hidden = true;
}

function renderNotesList() {
  if (isCalendarMode()) {
    if (state.view === 'calendar') renderCalendar();
    return;
  }
  if (isNoteMode()) {
    renderNotepadList();
    return;
  }

  renderGroupNav();
  renderDueScopeBar();
  renderSortBar();
  renderPriorityFilterBar();
  renderRecurrenceFilterBar();
  renderTagFilterBar();
  applyCardDensity();
  ensureFiltersDockObserver();
  applyDockScale();
  applyDockOffset();
  requestAnimationFrame(applyDockOffset);

  // restore work empty actions labels
  if (els.emptyAddBlankBtn) els.emptyAddBlankBtn.textContent = 'จดโน้ตว่าง';
  if (els.emptyAddAiBtn) els.emptyAddAiBtn.hidden = false;
  const workHint = els.emptyState?.querySelector('.empty-state-hint');
  if (workHint) {
    workHint.textContent = 'ข้อมูลถูกเก็บบนเซิร์ฟเวอร์อัตโนมัติ · แตะ + เพื่อจดเร็ว หรือใช้ AI ช่วย';
  }

  const notes = sortedFilteredNotes();
  els.notesList.innerHTML = '';
  syncTitlesOnlyListClass();

  const manual = isManualMode();
  els.notesList.classList.toggle('manual-sort', manual);

  notes.forEach((note) => {
    const item = document.createElement('div');
    item.className = 'note-card note-card-split';
    item.dataset.noteId = note.id;
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    if (state.listGroup === NOTE_STATUS.DONE) item.classList.add('done-card');
    if (state.listGroup === NOTE_STATUS.TRASH) item.classList.add('trash-card');
    if (state.selectionMode) item.classList.add('is-select-mode');
    if (state.selectionMode && isNoteSelected(note.id)) item.classList.add('is-selected');

    const priority = notePriority(note);
    const prioColors = normalizePriorityColors(state.settings.priorityColors);
    const prioColor = prioColors[priority] || prioColors.normal;
    const tags = getTagsForNote(note, state.notesData.tags || []);
    const showContent = state.settings.listShowContent === true;
    const preview = showContent ? previewText(note) : '';
    const previewHtml = preview
      ? `<p class="card-preview">${escapeHtml(preview)}</p>`
      : '';
    const titleText = stripLeadingEmoji(note.title || '') || 'ไม่มีหัวข้อ';
    const metaHtml = cardMetaInlineHtml(note, tags);
    const leadHtml = cardLeadingIconHtml(note, tags);

    item.classList.add('note-card-compact');
    item.innerHTML = `
      ${manual ? '<span class="drag-hint" aria-hidden="true">⠿</span>' : ''}
      <div class="card-compact-body" style="--prio:${escapeHtml(prioColor)}">
        <div class="card-compact-row">
          ${leadHtml}
          <h3 class="card-title">${escapeHtml(titleText)}</h3>
          ${metaHtml}
        </div>
        ${previewHtml}
      </div>
    `;

    appendCardAttachments(item, note);

    if (state.selectionMode) {
      attachNoteCardInteractions(item, {
        noteId: note.id,
        onTap: () => toggleNoteSelected(note.id),
        onLongPress: () => toggleNoteSelected(note.id),
      });
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleNoteSelected(note.id);
        }
      });
    } else if (manual) {
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

  const q = String(state.searchQuery || '').trim();
  if (!notes.length && q) {
    els.emptyStateText.textContent = `ไม่พบ “${q}”`;
  } else {
    els.emptyStateText.textContent = emptyMessageForGroup();
  }
  els.emptyState.hidden = notes.length > 0;
  const emptyPrimary = els.emptyState.querySelector('.btn-primary');
  if (emptyPrimary) emptyPrimary.hidden = state.listGroup !== NOTE_STATUS.ACTIVE;
  if (els.emptyAddBlankBtn) els.emptyAddBlankBtn.hidden = state.listGroup !== NOTE_STATUS.ACTIVE;
  renderFloatTagIcons();
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
  applyDockScale();
  // Body profile (rare-change) — keep in sync when opening settings.
  try {
    syncCalorieProfileInputs(ensureCaloriePayload());
  } catch {
    /* calorie payload may be empty before hydrate */
  }
  applyCalorieTones();
  if (els.geminiApiKey) els.geminiApiKey.value = state.settings.geminiApiKey || '';
  fillGeminiModelSelect(state.settings.geminiModel);
  if (els.aiProfile) els.aiProfile.value = state.settings.aiProfile || '';
  fillAiTagRuleDatalist();
  renderAiTagRulesList();
  fillAiContextPreview();
  applyCameraSettingsUi();
  applyTheme();
  applyCardDisplaySettingsUi();
  renderTagManager();
  renderPriorityIconSettings();
  applyNotifySettingsUi();
  applyBarThickness();
  refreshScheduleSelectOptions();
  syncTitlesOnlyListClass();
}

function applyCameraSettingsUi() {
  if (els.cameraQuality) {
    els.cameraQuality.value = normalizeCameraQuality(state.settings.cameraQuality);
  }
  if (els.cameraFacing) {
    els.cameraFacing.value = normalizeCameraFacing(state.settings.cameraFacing);
  }
  const saveOn = normalizeCameraSaveToDevice(state.settings.cameraSaveToDevice);
  els.cameraSaveSeg?.querySelectorAll('[data-camera-save]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cameraSave === (saveOn ? '1' : '0'));
  });
}

function persistCameraSettingsFromUi() {
  const quality = normalizeCameraQuality(els.cameraQuality?.value);
  const facing = normalizeCameraFacing(els.cameraFacing?.value);
  const saveBtn = els.cameraSaveSeg?.querySelector('[data-camera-save].active');
  const saveToDevice = normalizeCameraSaveToDevice(saveBtn?.dataset.cameraSave !== '0');
  const same =
    quality === state.settings.cameraQuality &&
    facing === state.settings.cameraFacing &&
    saveToDevice === state.settings.cameraSaveToDevice;
  if (same) return;
  state.settings.cameraQuality = quality;
  state.settings.cameraFacing = facing;
  state.settings.cameraSaveToDevice = saveToDevice;
  saveSettings(state.settings);
  inAppCameraCtl?.reloadFromSettings?.();
}

function openCameraSettingsFromOverlay() {
  persistCameraSettingsFromUi();
  openSettings();
  const row = els.cameraSettingsRow;
  if (row) {
    row.open = true;
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/** @type {any} */
let inAppCameraCtl = null;

async function initInAppCamera() {
  if (!els.inAppCamera || !els.inAppCameraVideo) return;
  if (inAppCameraCtl) return inAppCameraCtl;
  const { createInAppCamera } = await loadCameraMod();
  inAppCameraCtl = createInAppCamera({
    root: els.inAppCamera,
    video: els.inAppCameraVideo,
    statusEl: els.inAppCameraStatus,
    getSettings: () => ({
      cameraSaveToDevice: state.settings.cameraSaveToDevice,
      cameraFacing: state.settings.cameraFacing,
      cameraQuality: state.settings.cameraQuality,
    }),
    onCaptured: (file, meta) => {
      addAiMediaFiles([file]);
      const dim = meta?.width && meta?.height ? `${meta.width}×${meta.height}` : '';
      if (meta?.saved) {
        setStatus(dim ? `ถ่าย ${dim} · บันทึกลงเครื่องแล้ว` : 'ถ่ายแล้ว · บันทึกลงเครื่อง');
      } else if (dim) {
        setStatus(`ถ่าย ${dim}`);
      }
      setAiNoteStatus('แนบรูปแล้ว', { kind: 'done', restoreMs: 2000 });
    },
    onFallback: () => {
      setAiNoteStatus('ใช้กล้องระบบแทน', { kind: 'working', restoreMs: 1600 });
      els.aiNoteCamera?.click();
    },
    onOpenSettings: openCameraSettingsFromOverlay,
  });

  els.inAppCameraClose?.addEventListener('click', () => inAppCameraCtl?.close());
  els.inAppCameraShutter?.addEventListener('click', () => inAppCameraCtl?.capture());
  els.inAppCameraFlip?.addEventListener('click', async () => {
    await inAppCameraCtl?.flip();
    const facing = inAppCameraCtl?.getFacing?.();
    if (facing && facing !== state.settings.cameraFacing) {
      state.settings.cameraFacing = normalizeCameraFacing(facing);
      saveSettings(state.settings);
      applyCameraSettingsUi();
    }
  });
  els.inAppCameraSettings?.addEventListener('click', () => {
    openCameraSettingsFromOverlay();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (inAppCameraCtl?.isOpen?.()) {
      if (els.settingsOverlay && !els.settingsOverlay.hidden) return;
      inAppCameraCtl.close();
    }
  });
}

async function openInAppCameraOrFallback() {
  await initInAppCamera();
  if (inAppCameraCtl) {
    inAppCameraCtl.open();
    return;
  }
  els.aiNoteCamera?.click();
}

function closeSettings() {
  persistGeminiSettingsFromUi();
  persistAiProfileFromUi();
  persistCameraSettingsFromUi();
  // Number inputs may not have fired `change` yet — flush profile before hide.
  flushCalorieProfileFromUi({ status: '' });
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
      : [
          { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
          { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
        ];
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
    const { listGeminiModels } = await loadGeminiMod();
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
/** @type {{ id: string, text: string, done: boolean }[]} */
let aiChecklistDraft = [];
let importMergePreferred = true;

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
    checklist: checklistDraftForSave()
      .map((c) => `${c.id}:${c.done ? 1 : 0}:${c.text}`)
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
      checklistDraftForSave().length ||
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
  if (els.aiNoteDeleteBtn) {
    els.aiNoteDeleteBtn.hidden = aiFormMode !== 'edit';
  }
  updateAiCancelBtn();
}

async function trashNoteFromAiEdit() {
  if (aiFormMode !== 'edit' || !aiEditNoteId) return;
  const note = getNoteById(aiEditNoteId);
  if (!note) return;
  const ok = await showConfirm('ย้ายโน้ตไปถังขยะ?', { okLabel: 'ย้ายไปถังขยะ', danger: true });
  if (!ok) return;
  closeAiNoteModal();
  await applyNoteAction(note.id, 'trash');
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
  refreshScheduleSelectOptions();
  if (els.aiNoteSource) els.aiNoteSource.value = '';
  if (els.aiNoteDraftTitle) els.aiNoteDraftTitle.value = '';
  if (els.aiNoteDraftSummary) els.aiNoteDraftSummary.value = '';
  if (els.aiNoteDraftSchedule) els.aiNoteDraftSchedule.value = '';
  if (els.aiNoteDraftPriority) els.aiNoteDraftPriority.value = NOTE_PRIORITY.NORMAL;
  if (els.aiNoteDraftRecurrence) els.aiNoteDraftRecurrence.value = '';
  if (els.aiNoteDraftRemind) els.aiNoteDraftRemind.value = 'default';
  if (els.aiNoteDraftNotifyRepeat) els.aiNoteDraftNotifyRepeat.value = 'none';
  clearAiPendingMedia();
  aiChecklistDraft = [];
  renderAiChecklist();
  seedExistingTagChips();
  syncAiScheduleDisplay();
  setAiNoteStatus('');
}

function newChecklistItem(text = '', done = false) {
  return {
    id: crypto.randomUUID(),
    text: String(text || ''),
    done: Boolean(done),
  };
}

function renderAiChecklist() {
  const list = els.aiChecklistList;
  if (!list) return;
  list.innerHTML = '';
  aiChecklistDraft.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = `ai-checklist-row${item.done ? ' is-done' : ''}`;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = Boolean(item.done);
    cb.addEventListener('change', () => {
      aiChecklistDraft[index] = { ...item, done: cb.checked };
      renderAiChecklist();
      updateAiCancelBtn();
    });
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 200;
    input.placeholder = 'รายการย่อย…';
    input.value = item.text || '';
    input.addEventListener('input', () => {
      aiChecklistDraft[index] = { ...item, text: input.value, done: aiChecklistDraft[index]?.done };
      updateAiCancelBtn();
    });
    input.addEventListener('keydown', (e) => {
      // Desktop Thai/IME: Enter often confirms composition (keyCode 229 / isComposing).
      // Do not insert a row or re-render while composing — that drops mid-syllable text.
      if (e.key !== 'Enter') return;
      if (e.isComposing || e.keyCode === 229 || e.which === 229) return;
      e.preventDefault();
      aiChecklistDraft[index] = { ...item, text: input.value, done: aiChecklistDraft[index]?.done };
      aiChecklistDraft.splice(index + 1, 0, newChecklistItem());
      renderAiChecklist();
      const next = list.querySelectorAll('input[type="text"]')[index + 1];
      next?.focus();
    });
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'ai-checklist-remove';
    rm.setAttribute('aria-label', 'ลบข้อ');
    rm.textContent = '×';
    rm.addEventListener('click', () => {
      aiChecklistDraft.splice(index, 1);
      renderAiChecklist();
      updateAiCancelBtn();
    });
    row.append(cb, input, rm);
    list.appendChild(row);
  });
}

function checklistDraftForSave() {
  return normalizeChecklist(
    aiChecklistDraft
      .map((c) => ({ ...c, text: String(c.text || '').trim() }))
      .filter((c) => c.text),
  );
}

function exportNotesBackup() {
  const blob = exportNotesBlob(state.notesData);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `p-note-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  setStatus('ดาวน์โหลดสำรองแล้ว');
}

async function applyImportedNotes(text, { merge } = {}) {
  const useMerge = merge ?? importMergePreferred;
  let next;
  try {
    next = importFromText(text, state.notesData, { merge: useMerge });
  } catch (err) {
    console.warn('import failed', err);
    setStatus('นำเข้าไม่สำเร็จ · ตรวจ JSON');
    return false;
  }
  if (!hasCloudContent(next)) {
    setStatus('ไฟล์ว่างหรือไม่ใช่ข้อมูลแคลโน้ต');
    return false;
  }
  const calDays = Array.isArray(next.calorie?.days) ? next.calorie.days.length : 0;
  const ok = await showConfirm(
    useMerge
      ? `รวมข้อมูลเข้าของเดิม? วันแคล ${calDays} · โน้ต ${next.notes.length}`
      : `แทนที่ข้อมูลทั้งหมดด้วยสำรองนี้? วันแคล ${calDays} · โน้ต ${next.notes.length}`,
    { okLabel: useMerge ? 'รวม' : 'แทนที่', danger: !useMerge },
  );
  if (!ok) return false;
  state.notesData = next;
  state.syncBaseUpdatedAt = next.updatedAt || null;
  try {
    await saveManager.saveNow(() => state.notesData);
  } catch {
    saveNotes(state.notesData);
  }
  renderNotesList();
  renderTagManager();
  refreshNoteNotifications();
  scheduleUserContextRefresh();
  if (!state.authUser) {
    setStatus(useMerge ? 'รวมแล้วในเครื่อง · ล็อกอินเพื่อบันทึกคลาวด์' : 'นำเข้าแล้วในเครื่อง · ล็อกอินเพื่อบันทึกคลาวด์');
    setAuthOverlayVisible(true);
  } else if (state.online !== false) {
    setStatus(useMerge ? 'รวมสำรองแล้ว · บันทึกคลาวด์แล้ว' : 'นำเข้าแทนที่แล้ว · บันทึกคลาวด์แล้ว');
  } else {
    setStatus(useMerge ? 'รวมสำรองแล้ว' : 'นำเข้าแทนที่แล้ว');
  }
  return true;
}

async function safePushRemote(data) {
  const spaceId = state.spaceId || getSpaceId();
  let remoteRaw;
  try {
    remoteRaw = await fetchRemoteNotes(spaceId);
  } catch (err) {
    // Never setDoc-blind when we cannot read cloud — keep local until retry.
    throw err;
  }
  const remote = normalizeNotesData(remoteRaw);
  const local = normalizeNotesData(data);
  const remoteHas = hasCloudContent(remote);
  const localHas = hasCloudContent(local);

  // Sparse/empty local must never overwrite a filled Firestore space.
  if (!localHas && remoteHas) {
    state.syncBaseUpdatedAt = remote.updatedAt || state.syncBaseUpdatedAt;
    return remote;
  }

  if (remoteHas) {
    const merged = mergeNotesByUpdatedAt(local, remote);
    const saved = await pushRemoteNotes(spaceId, merged);
    // Keep in-memory/local union so the next paint matches Firestore.
    state.notesData = merged;
    saveNotes(merged);
    state.syncBaseUpdatedAt = saved?.updatedAt || merged.updatedAt;
    return saved;
  }

  if (!localHas) {
    // Both empty — skip noisy overwrite.
    state.syncBaseUpdatedAt = local.updatedAt || state.syncBaseUpdatedAt;
    return local;
  }

  const saved = await pushRemoteNotes(spaceId, local);
  state.syncBaseUpdatedAt = saved?.updatedAt || local.updatedAt || new Date().toISOString();
  return saved;
}

function fillAiFormFromNote(note) {
  if (!note) return;
  refreshScheduleSelectOptions();
  if (els.aiNoteSource) els.aiNoteSource.value = '';
  if (els.aiNoteDraftTitle) els.aiNoteDraftTitle.value = note.title || '';
  if (els.aiNoteDraftSummary) els.aiNoteDraftSummary.value = note.content || '';
  if (els.aiNoteDraftSchedule) {
    els.aiNoteDraftSchedule.value = toDatetimeLocalValue(note.scheduledAt);
  }
  if (els.aiNoteDraftPriority) els.aiNoteDraftPriority.value = notePriority(note);
  if (els.aiNoteDraftRecurrence) {
    fillSelectOptions(
      els.aiNoteDraftRecurrence,
      buildRecurrenceSelectOptions(getMonthPresets()),
      normalizeRecurrence(note.recurrence) || '',
    );
  }
  if (els.aiNoteDraftRemind) {
    els.aiNoteDraftRemind.value = normalizeRemindBefore(note.remindBefore);
  }
  if (els.aiNoteDraftNotifyRepeat) {
    fillSelectOptions(
      els.aiNoteDraftNotifyRepeat,
      buildNotifyRepeatSelectOptions(getMonthPresets()),
      normalizeNotifyRepeat(note.notifyRepeat),
    );
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
  aiChecklistDraft = normalizeChecklist(note.checklist);
  renderAiChecklist();
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
  requestCloseAiNoteModal();
}

/** Close AI form; ask before discarding typed work (desktop click-outside / Esc). */
async function requestCloseAiNoteModal() {
  if (!els.aiNoteModal || els.aiNoteModal.hidden) return;
  if (aiNoteBusy) return;
  if (isAiFormDirty()) {
    const ok = await showConfirm('ทิ้งสิ่งที่พิมพ์ไว้?', {
      okLabel: 'ทิ้ง',
      cancelLabel: 'กลับไปแก้',
      danger: true,
    });
    if (!ok) return;
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
  els.aiNoteDraftRecurrence?.addEventListener('change', ensureAiScheduleAnchor);
  els.aiNoteDraftNotifyRepeat?.addEventListener('change', ensureAiScheduleAnchor);
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
    <div class="attach-viewer-file-icon" aria-hidden="true">ไฟล์</div>
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
      icon.textContent = canInlinePreview(a) === 'pdf' ? 'PDF' : 'ไฟล์';
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
    openBtn.textContent = a.kind === 'image' ? (a.name || 'รูป') : (a.name || 'ไฟล์');
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
  const titleEl = document.getElementById('ai-note-title');
  if (titleEl) titleEl.textContent = 'เพิ่มงาน';
  const more = document.getElementById('ai-note-more');
  if (more) more.open = false;
  els.aiNoteModal.hidden = false;
  queueMicrotask(() => focusAiNoteTitle({ select: false }));
}

/** Blank note — same form, jump straight to title (no AI step required). */
function openQuickNoteModal() {
  if (!els.aiNoteModal) return;
  openAddNoteModal();
  const titleEl = document.getElementById('ai-note-title');
  if (titleEl) titleEl.textContent = 'จดโน้ตว่าง';
  queueMicrotask(() => focusAiNoteTitle({ select: false }));
}

function setSearchOpen(open, { focus = true } = {}) {
  if (!els.noteSearchRow) return;
  els.noteSearchRow.hidden = !open;
  els.searchToggleBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
  els.searchToggleBtn?.classList.toggle('is-active', open || Boolean(state.searchQuery));
  if (open && focus) {
    queueMicrotask(() => els.noteSearchInput?.focus());
  }
}

function applySearchQuery(raw) {
  state.searchQuery = String(raw || '');
  if (els.noteSearchClear) {
    els.noteSearchClear.hidden = !String(state.searchQuery).trim();
  }
  els.searchToggleBtn?.classList.toggle(
    'is-active',
    Boolean(String(state.searchQuery).trim()) || !(els.noteSearchRow?.hidden),
  );
  renderNotesList();
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
    if (els.aiNoteDraftTitle) focusAiNoteTitle({ select: true });
    else focusAiSourceField();
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
      const { prepareAiMedia } = await loadGeminiMod();
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
    const [{ summarizeToNoteDraft }, uc] = await Promise.all([
      loadGeminiMod(),
      loadUserContextMod(),
    ]);
    const ctx = uc.refreshUserContext(state.notesData);
    const memory =
      (await currentAiMemoryMd()) || ctx.md || uc.loadUserContextMd() || '';
    let draft = await summarizeToNoteDraft(apiKey, combined || source, {
      model: state.settings.geminiModel,
      existingTags: state.notesData.tags || [],
      images: aiImages,
      userContextMd: memory,
      now: new Date(),
    });
    draft = uc.refineDraftWithContext(
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
  // Desktop double-click on สร้าง/บันทึก used to create duplicate notes.
  if (aiNoteBusy) return;
  const title = stripLeadingEmoji(String(els.aiNoteDraftTitle?.value || '').trim() || 'โน้ต');
  const content = String(els.aiNoteDraftSummary?.value || '').trim();

  if (aiPendingMedia.some((m) => m.uploadState === 'error' && m.attachment?.needsCloud && !m.attachment?.data)) {
    setAiNoteStatus('มีไฟล์อัปโหลดไม่สำเร็จ', { kind: 'error', restoreMs: 2400 });
    return;
  }

  aiNoteBusy = true;
  if (els.aiNoteConfirmBtn) els.aiNoteConfirmBtn.disabled = true;
  if (els.aiNoteSummarizeBtn) els.aiNoteSummarizeBtn.disabled = true;

  try {
    await waitForPendingUploads();

    const attachments = attachmentsForPersist(
      aiPendingMedia.map((m) => m.attachment).filter(Boolean),
    );
    const checklist = checklistDraftForSave();
    if (!title && !content && !attachments.length && !checklist.length) {
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

    let scheduleAt = fromDatetimeLocalValue(els.aiNoteDraftSchedule?.value);
    const priority = els.aiNoteDraftPriority?.value;
    const recurrence = normalizeRecurrence(els.aiNoteDraftRecurrence?.value);
    const remindBefore = normalizeRemindBefore(els.aiNoteDraftRemind?.value);
    const notifyRepeat = normalizeNotifyRepeat(els.aiNoteDraftNotifyRepeat?.value);
    if ((recurrence || notifyRepeat !== 'none') && !scheduleAt) {
      scheduleAt = defaultScheduleIso();
    }

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
        checklist,
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

    let note = createNote(
      title || (checklist.length ? 'เช็กลิสต์' : ''),
      content,
    );
    note = updateNote(note, {
      scheduledAt: scheduleAt,
      priority,
      recurrence,
      remindBefore,
      notifyRepeat,
      checklist,
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
  } finally {
    aiNoteBusy = false;
    if (els.aiNoteConfirmBtn) els.aiNoteConfirmBtn.disabled = false;
    if (els.aiNoteSummarizeBtn) els.aiNoteSummarizeBtn.disabled = false;
  }
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

    const iconBtn = document.createElement('button');
    iconBtn.type = 'button';
    iconBtn.className = 'tag-icon-btn';
    const iconId = normalizeIconId(tag.icon || bestIconForLabel(tag.name), 'doc');
    iconBtn.innerHTML = iconSvg(iconId, { size: 18 });
    iconBtn.title = 'เลือกไอคอน';
    iconBtn.setAttribute('aria-label', `ไอคอนแท็ก ${tag.name}`);
    iconBtn.style.setProperty('--tag', safeTagColor(tag.color));
    iconBtn.addEventListener('click', () => {
      openIconPicker({
        type: 'tag',
        id: tag.id,
        label: tag.name,
        iconId,
      });
    });

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

    row.append(grip, iconBtn, color, name, count, ord, del);
    list.appendChild(row);
  });
  bindTagManagerListReorder();
}

function openEditor(noteId) {
  exitSelectionMode({ silent: true });
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
  if (state.activeNotepadId) {
    flushNotepadToState();
    saveManager.saveNow(() => state.notesData);
    state.activeNotepadId = null;
    document.body.classList.remove('notepad-editing');
    clearNotepadSheetUi();
    renderNotesList();
    showView(boardHomeView());
    return;
  }
  persistLocalChanges();
  if (discardDraftIfEmpty()) {
    setStatus('');
  } else {
    state.draftNoteId = null;
    saveManager.saveNow(() => state.notesData);
  }
  state.activeNoteId = null;
  document.body.classList.remove('notepad-editing');
  if (isCalendarMode()) {
    showView('calendar');
  } else {
    renderNotesList();
    showView('list');
  }
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
    els.appTitle.innerHTML = `แคลโน้ต <span class="title-version">${escapeHtml(verLabel)}</span>`;
  } else if (els.appTitle) {
    const ver = els.appTitle.querySelector('.title-version');
    if (ver) ver.textContent = verLabel;
  }
  const barVer = document.getElementById('mode-switch-ver');
  if (barVer) barVer.textContent = formatAppBuildLabel(build);
  const calVer = document.getElementById('calorie-app-ver');
  if (calVer) calVer.textContent = formatAppBuildLabel(build);
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
  exitSelectionMode({ silent: true });
  state.listGroup = group;
  if (group === NOTE_STATUS.ACTIVE) {
    applySavedFilters();
  } else {
    // Other groups ignore list filters; keep saved filters for when we return.
    state.tagFilterId = null;
    state.priorityFilter = null;
    state.recurrenceFilter = null;
    state.dueScope = null;
  }
  closeContextMenu();
  closeDrawer();
  renderNotesList();
}

/**
 * One-shot: pull notes from the old per-device space id into the shared space
 * payload so phone/desktop data is not orphaned after removing sync codes.
 */
async function mergePreviousDeviceSpace(localData) {
  const prevId = getPreviousSpaceId();
  if (!prevId) return { data: localData, fromPrev: false };
  try {
    const prevRaw = await fetchRemoteNotes(prevId);
    const prev = normalizeNotesData(prevRaw);
    if (!hasCloudContent(prev)) {
      clearPreviousSpaceId();
      return { data: localData, fromPrev: false };
    }
    const merged = mergeNotesByUpdatedAt(localData, prev);
    return { data: merged, fromPrev: true };
  } catch (err) {
    console.warn('previous space migrate skipped', err);
    return { data: localData, fromPrev: false };
  }
}

async function loadSpaceData(spaceId, localData) {
  // Returns { data, online, migrated, scheduleSnap }
  let remoteRaw = null;
  try {
    remoteRaw = await fetchRemoteNotes(spaceId);
  } catch {
    remoteRaw = null;
  }

  if (!remoteRaw) {
    const auto = await tryAutoImport(localData);
    // localData may already be normalized to v5; scheduleSnap handled by caller via peek
    return {
      data: auto.data,
      online: false,
      migrated: false,
      autoSource: auto.imported ? auto.source : null,
      scheduleSnap: false,
    };
  }

  const remoteVer = Number(remoteRaw.version) || 1;
  const remote = normalizeNotesData(remoteRaw);
  const remoteHas = hasCloudContent(remote);
  const localHas = hasCloudContent(localData);

  if (!remoteHas && localHas) {
    const merged = normalizeNotesData(localData);
    try {
      await pushRemoteNotes(spaceId, merged);
      return { data: merged, online: true, migrated: true, scheduleSnap: remoteVer < 5 };
    } catch {
      return { data: merged, online: false, migrated: false, scheduleSnap: remoteVer < 5 };
    }
  }

  if (remoteHas && localHas) {
    const merged = mergeNotesByUpdatedAt(localData, remote);
    if (localNeedsRemotePush(localData, remote)) {
      try {
        await pushRemoteNotes(spaceId, merged);
        return {
          data: merged,
          online: true,
          migrated: false,
          merged: true,
          scheduleSnap: remoteVer < 5,
        };
      } catch {
        return {
          data: merged,
          online: false,
          migrated: false,
          merged: true,
          scheduleSnap: remoteVer < 5,
        };
      }
    }
    return {
      data: merged,
      online: true,
      migrated: false,
      merged: true,
      scheduleSnap: remoteVer < 5,
    };
  }

  return {
    data: remote,
    online: true,
    migrated: false,
    scheduleSnap: remoteVer < 5,
  };
}

/** Fingerprint note/tag content (ignore top-level updatedAt churn). */
function notesContentKey(data) {
  const notes = Array.isArray(data?.notes) ? data.notes : [];
  const tags = Array.isArray(data?.tags) ? data.tags : [];
  const notepads = Array.isArray(data?.notepads) ? data.notepads : [];
  const notePart = notes
    .map((n) => `${n.id}:${n.updatedAt || ''}:${n.status || ''}`)
    .sort()
    .join(',');
  const tagPart = tags
    .map((t) => `${t.id}:${t.label || ''}:${t.color || ''}`)
    .sort()
    .join(',');
  const padPart = notepads
    .map(
      (p) =>
        `${p.id}:${p.name || ''}:${p.updatedAt || ''}:${(p.content || '').length}:${sheetFingerprint(p.sheets)}`,
    )
    .sort()
    .join(',');
  const calDays = Array.isArray(data?.calorie?.days) ? data.calorie.days : [];
  const calPart = `${data?.calorie?.updatedAt || ''}:${calDays
    .map((d) => `${d.id}:${d.updatedAt || ''}`)
    .sort()
    .join(',')}`;
  return `${notePart}|${tagPart}|${padPart}|${calPart}`;
}

function paintNotesFromLocal(data) {
  state.notesData = normalizeNotesData(data);
  state.syncBaseUpdatedAt = state.notesData?.updatedAt || null;
  state.appMode = 'calorie';
  state.settings.appMode = 'calorie';
  document.body.classList.remove('note-mode', 'calendar-mode', 'notepad-editing');
  document.body.classList.add('calorie-mode', 'calorie-only');
  state.sortMode = state.settings.sortMode || 'updated';
  applySavedFilters();
  saveNotes(state.notesData);
  applyTheme();
  applyCardDensity();
  applyDockScale();
  applyFilterOrder();
  reapplyBarLayout();
  applyBarThickness();
  renderModeSwitcher();
  showView('calorie');
  updateAppVersionLabel();
  syncCalorieFabs();
}

/**
 * Apply a remote sync result without blocking UI.
 * Re-merges with current state so edits during the fetch are kept.
 */
async function applySpaceSyncResult(result, { localVerBefore = null, announce = true } = {}) {
  if (state.view === 'editor') flushEditorToState();

  const beforeKey = notesContentKey(state.notesData);
  const merged = mergeNotesByUpdatedAt(state.notesData, result.data);
  state.notesData = merged;
  state.online = result.online;
  if (result.online) state.cloudHydrated = true;
  state.syncBaseUpdatedAt = merged?.updatedAt || result.data?.updatedAt || null;
  saveNotes(state.notesData);

  const didScheduleSnap =
    (localVerBefore != null && localVerBefore < 5) || Boolean(result.scheduleSnap);
  const hadScheduled = Array.isArray(state.notesData?.notes)
    && state.notesData.notes.some((n) => n?.scheduledAt);

  if (didScheduleSnap) {
    try {
      await saveManager.saveNow(() => state.notesData);
    } catch (err) {
      console.warn('schedule snap save failed', err);
    }
  } else if (result.online && localNeedsRemotePush(state.notesData, result.data)) {
    // Local edits landed while fetch/merge was in flight — push the union.
    try {
      await safePushRemote(state.notesData);
    } catch {
      /* offline race; next save/sync will retry */
    }
  }

  const contentChanged = notesContentKey(state.notesData) !== beforeKey;
  if (contentChanged && (state.view === 'list' || state.view === 'calendar' || state.view === 'calorie')) {
    renderModeSwitcher();
    if (state.view === 'calendar') renderCalendar();
    else if (state.view === 'calorie') renderCalorieSheet();
    else renderNotesList();
  } else if (contentChanged && state.activeNotepadId) {
    const pad = getNotepad(state.notesData, state.activeNotepadId);
    if (pad) {
      if (els.noteTitle) els.noteTitle.value = pad.name || '';
      if (els.noteContent) els.noteContent.value = pad.content || '';
    }
  }

  if (!announce) return contentChanged;

  if (didScheduleSnap && hadScheduled) {
    setStatus('ปรับเวลาแจ้งเตือนเป็น 09:00 แล้ว');
  } else if (result.migrated) {
    setStatus('ย้ายโน้ตเข้าคลาวด์แล้ว');
  } else if (!result.online) {
    setStatus(result.autoSource ? 'โหมดออฟไลน์ (กู้คืนข้อมูลเดิม)' : 'โหมดออฟไลน์ (เก็บในเครื่อง)');
  } else if (contentChanged) {
    setStatus('ซิงค์คลาวด์ล่าสุดแล้ว');
  } else {
    setStatus('เชื่อมคลาวด์แล้ว');
  }
  return contentChanged;
}

let spaceSyncInFlight = null;
let lastSpaceSyncAt = 0;
const BG_SYNC_MIN_INTERVAL_MS = 20_000;

/**
 * Warm Firestore in the background. Local UI is already painted.
 * Throttled so returning to the tab doesn't spam the API.
 * Resolves to true when note/tag content changed.
 */
function syncSpaceInBackground({ localVerBefore = null, force = false, announce = true } = {}) {
  if (!state.spaceId) return Promise.resolve(false);
  if (spaceSyncInFlight) return spaceSyncInFlight;
  const now = Date.now();
  if (!force && lastSpaceSyncAt && now - lastSpaceSyncAt < BG_SYNC_MIN_INTERVAL_MS) {
    return Promise.resolve(false);
  }

  spaceSyncInFlight = (async () => {
    try {
      if (announce) setSyncStatus('busy', 'กำลังซิงค์…');
      const prevMerge = await mergePreviousDeviceSpace(state.notesData);
      if (prevMerge.fromPrev) {
        state.notesData = normalizeNotesData(prevMerge.data);
        saveNotes(state.notesData);
        if (announce) setSyncStatus('busy', 'กำลังรวมพื้นที่เก่า…');
      }
      const result = await loadSpaceData(state.spaceId || SHARED_SPACE_ID, state.notesData);
      const changed = await applySpaceSyncResult(result, { localVerBefore, announce });
      if (result.online && getPreviousSpaceId()) {
        clearPreviousSpaceId();
      }
      lastSpaceSyncAt = Date.now();
      return Boolean(changed) || Boolean(prevMerge.fromPrev);
    } catch (err) {
      console.warn('background sync failed', err);
      state.online = false;
      if (announce) setDbStatusMessage('โหมดออฟไลน์ (เก็บในเครื่อง)');
      return false;
    } finally {
      spaceSyncInFlight = null;
    }
  })();
  return spaceSyncInFlight;
}

async function bootstrapData() {
  // Local-first: paint from device cache immediately, then auth + Firestore.
  try {
    state.spaceId = getSpaceId();
    state.settings = loadSettings();
    state.listGroup = NOTE_STATUS.ACTIVE;

    const localVerBefore = peekLocalNotesVersion();
    let localData = loadNotes().data;
    // Only when cache is empty — recover legacy/bundled before first paint.
    if (!hasCloudContent(localData)) {
      const auto = await tryAutoImport(localData);
      localData = auto.data;
    }

    saveManager.configure({
      onStatus: (message) => setStatus(message),
      remotePush: async (data) => {
        if (!state.authUser) {
          throw new Error('Not signed in');
        }
        // Wait for first cloud pull so we merge instead of wiping Firestore.
        if (!state.cloudHydrated && spaceSyncInFlight) {
          try {
            await spaceSyncInFlight;
          } catch { /* continue — safePushRemote still merges */ }
        }
        return safePushRemote(data);
      },
    });

    paintNotesFromLocal(localData);
    setLoading(false);
    refreshAuthAccountHint();

    const user = await requireCloudAuth();
    watchAuth((nextUser) => {
      if (!nextUser) {
        const wasSignedIn = Boolean(state.authUser);
        state.authUser = null;
        state.online = false;
        state.cloudHydrated = false;
        refreshAuthAccountHint();
        setAuthOverlayVisible(true);
        if (wasSignedIn) setSyncStatus('offline', 'ออกจากระบบแล้ว · ข้อมูลในเครื่องยังอยู่');
        return;
      }
      const first = !state.authUser;
      onSignedIn(nextUser);
      if (first) {
        setSyncStatus('busy', 'กำลังเชื่อมคลาวด์…');
        void syncSpaceInBackground({ localVerBefore, force: true, announce: true });
      }
    });

    if (!user) {
      setSyncStatus('offline', 'รอเข้าสู่ระบบเพื่อซิงค์คลาวด์');
      return;
    }

    setSyncStatus('busy', 'กำลังเชื่อมคลาวด์…');
    void syncSpaceInBackground({ localVerBefore, force: true, announce: true });
  } catch (err) {
    console.warn('bootstrap failed', err);
    try {
      state.notesData = loadNotes().data;
      state.settings = state.settings || loadSettings();
      applyTheme();
      showView(boardHomeView());
      if (!isCalendarMode()) renderNotesList();
      setDbStatusMessage('โหลดไม่สำเร็จ — ใช้ข้อมูลในเครื่อง');
    } catch (fallbackErr) {
      console.warn('bootstrap fallback failed', fallbackErr);
      setDbStatusMessage('โหลดไม่สำเร็จ');
    }
  } finally {
    setLoading(false);
  }
}

// Editor: swipe left OR right → save & leave editor.
// Overlays/drawer: keep close gestures.
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
          else if (inAppCameraCtl?.isOpen?.()) inAppCameraCtl.close();
          else if (els.attachViewer && !els.attachViewer.hidden) closeAttachViewer();
          else if (els.aiNoteModal && !els.aiNoteModal.hidden) requestCloseAiNoteModal();
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

async function init({ fromBoot = false } = {}) {
  applyTheme();
  refreshScheduleSelectOptions();
  // Search always visible on notes home
  setSearchOpen(true, { focus: false });
  // Camera / attach viewer / AI-heavy wiring: after list is usable

  els.addNoteBtn?.addEventListener('click', () => {
    if (isCalorieMode()) addCalorieDay();
    else if (isNoteMode()) promptNewNotepad();
    else openAddNoteModal();
  });
  els.emptyAddAiBtn?.addEventListener('click', openAddNoteModal);
  els.emptyAddBlankBtn?.addEventListener('click', () => {
    if (isNoteMode()) promptNewNotepad();
    else openQuickNoteModal();
  });
  els.undoFabBtn?.addEventListener('click', () => {
    if (!canUndo()) return;
    runUndo();
  });
  els.actionToastUndo?.addEventListener('click', (e) => {
    e.stopPropagation();
    runUndo();
  });
  els.snoozePickCancel?.addEventListener('click', closeSnoozePicker);
  els.snoozePickOk?.addEventListener('click', confirmSnoozePicker);
  els.snoozePickOverlay?.addEventListener('click', (e) => {
    if (e.target === els.snoozePickOverlay) closeSnoozePicker();
  });
  els.searchToggleBtn?.addEventListener('click', () => {
    const open = Boolean(els.noteSearchRow?.hidden);
    setSearchOpen(open);
    if (!open && !String(state.searchQuery || '').trim()) {
      applySearchQuery('');
    }
  });
  els.noteSearchInput?.addEventListener('input', () => {
    applySearchQuery(els.noteSearchInput.value);
  });
  els.noteSearchClear?.addEventListener('click', () => {
    if (els.noteSearchInput) els.noteSearchInput.value = '';
    applySearchQuery('');
    els.noteSearchInput?.focus();
  });
  els.syncStatusBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    flashSyncTip();
  });
  els.aiNoteCancelBtn?.addEventListener('click', onAiCancelOrReset);
  els.aiNoteDeleteBtn?.addEventListener('click', () => {
    trashNoteFromAiEdit();
  });
  els.aiNotePasteDraftBtn?.addEventListener('click', pasteDraftDetailsIntoSource);
  els.aiNoteSummarizeBtn?.addEventListener('click', () => {
    runAiSummarize();
  });
  els.aiNoteConfirmBtn?.addEventListener('click', confirmAiNoteDraft);
  els.aiNoteModal?.addEventListener('click', (e) => {
    if (e.target === els.aiNoteModal) requestCloseAiNoteModal();
  });
  // Esc on desktop: same dirty-check close as backdrop click
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!els.aiNoteModal || els.aiNoteModal.hidden) return;
    if (els.noteConfirmOverlay && !els.noteConfirmOverlay.hidden) return;
    e.preventDefault();
    requestCloseAiNoteModal();
  });
  els.aiNoteCameraBtn?.addEventListener('click', () => {
    openInAppCameraOrFallback();
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
  els.cameraQuality?.addEventListener('change', persistCameraSettingsFromUi);
  els.cameraFacing?.addEventListener('change', persistCameraSettingsFromUi);
  els.cameraSaveSeg?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-camera-save]');
    if (!btn) return;
    els.cameraSaveSeg.querySelectorAll('[data-camera-save]').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    persistCameraSettingsFromUi();
  });
  els.geminiApiKey?.addEventListener('change', persistGeminiSettingsFromUi);
  els.geminiModel?.addEventListener('change', persistGeminiSettingsFromUi);
  els.geminiLoadModelsBtn?.addEventListener('click', () => {
    loadGeminiModelsFromApi();
  });
  els.aiProfile?.addEventListener('change', persistAiProfileFromUi);
  els.aiProfile?.addEventListener('blur', persistAiProfileFromUi);
  els.aiTagRuleForm?.addEventListener('submit', addAiTagRuleFromForm);
  els.aiContextRefreshBtn?.addEventListener('click', async () => {
    persistAiProfileFromUi();
    const ctx = await refreshUserContextLazy(state.notesData);
    await fillAiContextPreview();
    setStatus(`รีเฟรชความจำแล้ว · แท็ก ${ctx.tagCount || 0} · โน้ต ${ctx.noteCount || 0}`);
  });


  els.cardLeadIconSeg?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-card-lead]');
    if (!btn) return;
    persistCardDisplayPatch({ leadIcon: btn.dataset.cardLead === '1' });
  });
  document.querySelectorAll('[data-card-meta]').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-meta-show]');
      if (!btn || !seg.contains(btn)) return;
      const key = seg.dataset.cardMeta;
      if (!key) return;
      persistCardDisplayPatch({ [key]: btn.dataset.metaShow });
    });
  });
  els.cardIconColorSeg?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-icon-color-mode]');
    if (!btn) return;
    persistCardDisplayPatch({ iconColorMode: btn.dataset.iconColorMode });
  });
  els.priorityIconColorGrid?.addEventListener('input', (e) => {
    const input = e.target.closest('[data-prio-icon-color]');
    if (!input) return;
    const key = input.dataset.prioIconColor;
    const cur = getCardDisplay();
    persistCardDisplayPatch({
      iconColorMode: 'custom',
      priorityIconColors: {
        ...cur.priorityIconColors,
        [key]: input.value,
      },
    });
  });

  els.priorityIconGrid?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-priority-icon]');
    if (!btn) return;
    const id = btn.dataset.priorityIcon;
    const opt = PRIORITY_OPTIONS.find((o) => o.id === id);
    const icons = getPriorityIcons();
    openIconPicker({
      type: 'priority',
      id,
      label: opt?.label || id,
      iconId: icons[id] || DEFAULT_PRIORITY_ICONS[id],
    });
  });
  els.iconPickerCloseBtn?.addEventListener('click', closeIconPicker);
  els.iconPickerBackdrop?.addEventListener('click', closeIconPicker);
  const onIconPickClick = (e) => {
    const btn = e.target.closest('[data-icon-id]');
    if (!btn) return;
    applyPickedIcon(btn.dataset.iconId);
  };
  els.iconPickerSuggest?.addEventListener('click', onIconPickClick);
  els.iconPickerAll?.addEventListener('click', onIconPickClick);

  els.settingsBtn.addEventListener('click', openSettings);
  els.dockCalorieHealthBtn?.addEventListener('click', () => setCaloriePane('health'));
  els.dockCalorieLogBtn?.addEventListener('click', () => setCaloriePane('log'));
  els.closeSettingsBtn.addEventListener('click', closeSettings);
  els.settingsBackdrop.addEventListener('click', closeSettings);

  els.openDrawerBtn?.addEventListener('click', toggleDrawer);
  els.drawerBackdrop.addEventListener('click', closeDrawer);

  applyFilterOrder();
  syncTitlesOnlyListClass();

  els.modeSwitchBtn?.addEventListener('click', () => {
    if (els.modeMenuOverlay && !els.modeMenuOverlay.hidden) closeModeMenu();
    else openModeMenu();
  });
  const onDockModeClick = (e) => {
    const modeBtn = e.currentTarget;
    const mode = modeBtn?.dataset?.appMode;
    if (!mode) return;
    setAppMode(mode);
  };
  els.dockModeWork?.addEventListener('click', onDockModeClick);
  els.dockModeNote?.addEventListener('click', onDockModeClick);
  els.dockModeCalendar?.addEventListener('click', onDockModeClick);
  els.dockModeCalorie?.addEventListener('click', onDockModeClick);
  /* Calendar — Apple-style year back / today / zoom */
  els.calYearBack?.addEventListener('click', () => {
    if (state.calendarZoom === 'year') {
      state.calendarYear -= 1;
      renderCalendarYearView();
      updateCalendarChrome();
    } else {
      calendarZoomOut();
    }
  });
  els.calTodayBtn?.addEventListener('click', () => goCalendarToday());
  els.calZoomOut?.addEventListener('click', () => calendarZoomOut());
  els.calZoomIn?.addEventListener('click', () => calendarZoomIn());
  // Swipe-down on day sheet handle collapses it
  els.calNotes?.addEventListener('click', (e) => {
    if (e.target.closest?.('.cal-notes-handle')) {
      state.calendarSelectedDate = null;
      highlightCalendarSelection();
      collapseCalendarNotes();
    }
  });
  els.calorieAddDayBtn?.addEventListener('click', () => addCalorieDay());
  els.calorieFabMeal?.addEventListener('click', () => openCalorieQuick('meal'));
  els.calorieFabMus?.addEventListener('click', () => openCalorieQuick('mus'));
  els.calorieQuickCancel?.addEventListener('click', closeCalorieQuick);
  els.calorieQuickBackdrop?.addEventListener('click', closeCalorieQuick);
  els.calorieQuickClear?.addEventListener('click', clearCalorieQuickInput);
  els.calorieQuickOk?.addEventListener('click', submitCalorieQuick);
  els.calorieQuickInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitCalorieQuick();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCalorieQuick();
    }
  });
  const onCalorieProfileChange = () => {
    flushCalorieProfileFromUi({ status: '' });
  };
  const profileInputs = [
    els.calorieProteinFactor,
    els.calorieHeight,
    els.calorieBirthdate,
    els.calorieSex,
    els.calorieGoalWaist,
    els.calorieGoalWeight,
  ];
  profileInputs.forEach((el) => {
    el?.addEventListener('change', onCalorieProfileChange);
    // Mobile: value often commits on blur without a reliable change in some WebViews.
    el?.addEventListener('blur', onCalorieProfileChange);
  });
  const onCalorieToneChange = () => persistCalorieTonesFromUi();
  [els.calorieToneEat, els.calorieToneBurn, els.calorieToneEmpty].forEach((el) => {
    if (!el) return;
    el.addEventListener('input', onCalorieToneChange);
    el.addEventListener('change', onCalorieToneChange);
    // Some mobile WebViews only commit the native color picker on blur.
    el.addEventListener('blur', onCalorieToneChange);
  });
  els.calorieToneReset?.addEventListener('click', () => {
    persistCalorieTonesFromUi({ reset: true });
  });
  els.calorieQuickFreq?.addEventListener('click', (e) => {
    const chip = e.target?.closest?.('[data-freq-text]');
    if (!chip || !els.calorieQuickFreq.contains(chip)) return;
    e.preventDefault();
    if (els.calorieQuickInput) {
      els.calorieQuickInput.value = chip.dataset.freqText || '';
      try { els.calorieQuickInput.focus(); } catch { /* ignore */ }
    }
  });

  const applyTodayCardField = (input) => {
    const dayId = els.calorieTodayCard?.dataset?.dayId;
    if (!dayId || !input) return;
    const sheet = ensureCaloriePayload();
    if (input.hasAttribute('data-ctc-meal')) {
      const idx = Number(input.getAttribute('data-ctc-meal'));
      const day = sheet.days.find((d) => d.id === dayId);
      if (!day || !Number.isFinite(idx)) return;
      const meals = expandMealsForEdit(day.meals);
      while (meals.length <= idx) meals.push('');
      meals[idx] = String(input.value || '').trim().slice(0, 32);
      persistCalorie(patchDay(sheet, dayId, { meals: normalizeMeals(meals) }), {
        status: '',
        fullRender: true,
      });
      return;
    }
    const field =
      input === els.calorieTodayWeight
        ? 'weight'
        : input === els.calorieTodayWaist
          ? 'waist'
          : input === els.calorieTodayMus
            ? 'mus'
            : null;
    if (!field) return;
    const num = String(input.value || '').trim();
    const parsed = num === '' ? null : Number(num);
    if (num !== '' && !Number.isFinite(parsed)) return;
    let next = patchDay(sheet, dayId, { [field]: parsed });
    if (field === 'mus' && (parsed == null || parsed === 0)) {
      next = pruneFrequentMus(patchDay(next, dayId, { mus: null, note: '' }));
    }
    persistCalorie(next, {
      status: '',
      fullRender: field === 'weight' || field === 'mus',
    });
  };
  const onTodayCardChange = (e) => {
    const input = e.target?.closest?.('input');
    if (!input || !els.calorieTodayCard?.contains(input)) return;
    applyTodayCardField(input);
  };
  els.calorieTodayCard?.addEventListener('input', (e) => {
    const input = e.target?.closest?.('input');
    if (!input || !els.calorieTodayCard?.contains(input)) return;
    const wrap = input.closest('.cal-input-wrap, .ctc-field-wrap');
    if (wrap) wrap.classList.toggle('has-value', String(input.value || '').trim() !== '');
  });
  els.calorieTodayCard?.addEventListener('change', onTodayCardChange);
  els.calorieTodayCard?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const input = e.target?.closest?.('input');
    if (!input || !els.calorieTodayCard.contains(input)) return;
    e.preventDefault();
    input.blur();
  });
  els.calorieTodayCard?.addEventListener('click', (e) => {
    // แตะตัวเลขมื้อ/mus → แผ่นเคลียร์+บันทึก (ไม่มี ×)
    const mealInput = e.target?.closest?.('input[data-ctc-meal]');
    if (mealInput && els.calorieTodayCard.contains(mealInput)) {
      e.preventDefault();
      const dayId = els.calorieTodayCard.dataset.dayId;
      const idx = Number(mealInput.dataset.ctcMeal);
      if (!dayId || !Number.isFinite(idx)) return;
      openCalorieCellEditor({
        mode: 'meal',
        dayId,
        mealIndex: idx,
        value: mealInput.value,
      });
      return;
    }
    const musInput = e.target?.closest?.('#calorie-today-mus');
    if (musInput && els.calorieTodayCard.contains(musInput)) {
      e.preventDefault();
      const dayId = els.calorieTodayCard.dataset.dayId;
      if (!dayId) return;
      openCalorieCellEditor({ mode: 'mus', dayId, value: musInput.value });
    }
  });
  els.calorieTodayCard?.addEventListener('focusin', (e) => {
    const mealInput = e.target?.closest?.('input[data-ctc-meal]');
    if (mealInput && els.calorieTodayCard.contains(mealInput)) {
      mealInput.blur();
      const dayId = els.calorieTodayCard.dataset.dayId;
      const idx = Number(mealInput.dataset.ctcMeal);
      if (!dayId || !Number.isFinite(idx)) return;
      openCalorieCellEditor({
        mode: 'meal',
        dayId,
        mealIndex: idx,
        value: mealInput.value,
      });
      return;
    }
    const musInput = e.target?.closest?.('#calorie-today-mus');
    if (musInput && els.calorieTodayCard.contains(musInput)) {
      musInput.blur();
      const dayId = els.calorieTodayCard.dataset.dayId;
      if (!dayId) return;
      openCalorieCellEditor({ mode: 'mus', dayId, value: musInput.value });
    }
  });
  els.calorieHealthSheet?.addEventListener('click', (e) => {
    const openGoals = e.target?.closest?.('[data-calorie-action="open-settings"]');
    if (openGoals && els.calorieHealthSheet.contains(openGoals)) {
      e.preventDefault();
      openSettings();
      const goalRow = document.getElementById('goal-settings-row');
      if (goalRow) {
        goalRow.open = true;
        try {
          goalRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch { /* ignore */ }
      }
      try {
        els.calorieGoalWaist?.focus();
      } catch { /* ignore */ }
      return;
    }
    const btn = e.target?.closest?.('[data-chs-range]');
    if (!btn || !els.calorieHealthSheet.contains(btn)) return;
    e.preventDefault();
    const days = normalizeTrendDays(btn.dataset.chsRange, state.calorieTrendDays);
    if (days === state.calorieTrendDays) return;
    state.calorieTrendDays = days;
    paintCalorieHealthSheet(ensureCaloriePayload());
  });
  let calorieScrollTick = 0;
  els.calorieScroll?.addEventListener('scroll', () => {
    if (calorieScrollTick) return;
    calorieScrollTick = requestAnimationFrame(() => {
      calorieScrollTick = 0;
      syncCalorieMonthFromScroll();
    });
  }, { passive: true });
  const applyCalorieField = (input) => {
    if (!input || !els.calorieTbody?.contains(input)) return;
    const dayId = input.dataset.dayId;
    const field = input.dataset.calField;
    if (!dayId || !field || field === 'base') return;
    const sheet = ensureCaloriePayload();
    if (field === 'meal') {
      const idx = Number(input.dataset.mealIndex);
      const day = sheet.days.find((d) => d.id === dayId);
      if (!day || !Number.isFinite(idx)) return;
      const meals = expandMealsForEdit(day.meals);
      while (meals.length <= idx) meals.push('');
      meals[idx] = String(input.value || '').trim().slice(0, 32);
      persistCalorie(patchDay(sheet, dayId, { meals: normalizeMeals(meals) }), {
        status: '',
        fullRender: true,
      });
      return;
    }
    if (field === 'note') {
      persistCalorie(patchDay(sheet, dayId, { note: String(input.value || '').slice(0, 200) }), { status: '' });
      return;
    }
    if (field === 'date') {
      const v = String(input.value || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
      const next = patchDay(sheet, dayId, { date: v });
      state.calorieActiveMonth = monthKeyFromDate(v);
      persistCalorie(next, { status: '', fullRender: true });
      return;
    }
    const num = String(input.value || '').trim();
    const parsed = num === '' ? null : Number(num);
    if (num !== '' && !Number.isFinite(parsed)) return;
    let next = patchDay(sheet, dayId, { [field]: parsed });
    if (field === 'mus' && (parsed == null || parsed === 0)) {
      next = pruneFrequentMus(patchDay(next, dayId, { mus: null, note: '' }));
    }
    persistCalorie(next, {
      status: '',
      fullRender: field === 'weight' || field === 'mus',
    });
  };
  const markClearWrap = (input) => {
    const wrap = input?.closest?.('.cal-input-wrap, .ctc-field-wrap');
    if (!wrap) return;
    wrap.classList.toggle('has-value', String(input.value || '').trim() !== '');
  };
  els.calorieTbody?.addEventListener('input', (e) => {
    const input = e.target?.closest?.('input[data-cal-field]');
    if (input) markClearWrap(input);
  });
  els.calorieTbody?.addEventListener('change', (e) => {
    const input = e.target?.closest?.('input[data-cal-field]');
    if (input) applyCalorieField(input);
  });
  els.calorieTbody?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const input = e.target?.closest?.('input[data-cal-field]');
    if (!input) return;
    e.preventDefault();
    input.blur();
  });
  els.calorieTbody?.addEventListener('focusin', (e) => {
    const mealInput = e.target?.closest?.('input[data-cal-field="meal"]');
    if (mealInput && els.calorieTbody.contains(mealInput)) {
      mealInput.blur();
      openCalorieCellEditor({
        mode: 'meal',
        dayId: mealInput.dataset.dayId,
        mealIndex: Number(mealInput.dataset.mealIndex),
        value: mealInput.value,
      });
      return;
    }
    const musInput = e.target?.closest?.('input[data-cal-field="mus"]');
    if (musInput && els.calorieTbody.contains(musInput)) {
      musInput.blur();
      openCalorieCellEditor({
        mode: 'mus',
        dayId: musInput.dataset.dayId,
        value: musInput.value,
      });
    }
  });
  els.calorieTbody?.addEventListener('click', (e) => {
    const mealInput = e.target?.closest?.('input[data-cal-field="meal"]');
    if (mealInput && els.calorieTbody.contains(mealInput)) {
      e.preventDefault();
      openCalorieCellEditor({
        mode: 'meal',
        dayId: mealInput.dataset.dayId,
        mealIndex: Number(mealInput.dataset.mealIndex),
        value: mealInput.value,
      });
      return;
    }
    const musInput = e.target?.closest?.('input[data-cal-field="mus"]');
    if (musInput && els.calorieTbody.contains(musInput)) {
      e.preventDefault();
      openCalorieCellEditor({
        mode: 'mus',
        dayId: musInput.dataset.dayId,
        value: musInput.value,
      });
      return;
    }
    const dateOpen = e.target?.closest?.('[data-cal-date-open]');
    if (dateOpen && els.calorieTbody.contains(dateOpen)) {
      e.preventDefault();
      const id = dateOpen.dataset.calDateOpen;
      const picker = els.calorieTbody.querySelector(
        `input.cal-date-picker[data-day-id="${CSS.escape(id)}"]`,
      );
      if (picker) {
        try {
          if (typeof picker.showPicker === 'function') picker.showPicker();
          else {
            picker.style.pointerEvents = 'auto';
            picker.focus();
            picker.click();
          }
        } catch {
          picker.focus();
        }
      }
    }
  });

  els.notepadQuickScroll?.addEventListener('click', (e) => {
    const chip = e.target.closest?.('[data-notepad-quick-id]');
    if (!chip || !els.notepadQuickScroll.contains(chip)) return;
    e.preventDefault();
    onNotepadQuickChipClick(chip.dataset.notepadQuickId);
  });
  els.aiNoteFocusTitleBtn?.addEventListener('click', () => {
    focusAiNoteTitle({ select: true });
  });
  els.modeMenuOverlay?.addEventListener('click', (e) => {
    if (e.target === els.modeMenuOverlay) {
      closeModeMenu();
      return;
    }
    const modeBtn = e.target.closest('[data-app-mode]');
    if (modeBtn) {
      setAppMode(modeBtn.dataset.appMode);
      return;
    }
    const del = e.target.closest('[data-notepad-delete]');
    if (del) {
      tryDeleteNotepad(del.dataset.notepadDelete);
      return;
    }
    const item = e.target.closest('[data-notepad-id]');
    if (!item) return;
    const id = item.dataset.notepadId;
    if (!id) return;
    closeModeMenu();
    openNotepadEditor(id);
  });
  let npLongTimer = null;
  let npLongId = null;
  els.notepadMenuList?.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('[data-notepad-id]');
    if (!item) return;
    npLongId = item.dataset.notepadId;
    clearTimeout(npLongTimer);
    npLongTimer = setTimeout(() => {
      if (!npLongId) return;
      promptRenameNotepad(npLongId);
      npLongId = null;
    }, 480);
  });
  const clearNpLong = () => {
    clearTimeout(npLongTimer);
    npLongTimer = null;
    npLongId = null;
  };
  els.notepadMenuList?.addEventListener('pointerup', clearNpLong);
  els.notepadMenuList?.addEventListener('pointercancel', clearNpLong);
  els.notepadMenuList?.addEventListener('pointerleave', clearNpLong);
  els.notepadAddBtn?.addEventListener('click', () => promptNewNotepad());
  els.notepadAddSheetBtn?.addEventListener('click', () => addNotepadSheetBlock());
  els.notepadSheetBlocks?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest?.('[data-sheet-remove]');
    if (!removeBtn || !els.notepadSheetBlocks.contains(removeBtn)) return;
    e.preventDefault();
    removeNotepadSheetBlock(removeBtn.dataset.sheetRemove);
  });
  els.floatTagIcons?.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-float-tag-id]');
    if (!btn || !els.floatTagIcons.contains(btn)) return;
    e.preventDefault();
    applyFloatTagFilter(btn.dataset.floatTagId);
  });

  els.notifyOffBtn?.addEventListener('click', () => setNotificationsEnabled(false));
  els.notifyOnBtn?.addEventListener('click', () => setNotificationsEnabled(true));
  els.notifyLabel?.addEventListener('change', () => {
    persistNotifyPrefs({ label: els.notifyLabel.value.trim() || 'แคลโน้ต' });
  });
  els.notifyEarly?.addEventListener('change', () => {
    persistNotifyPrefs({ earlyMinutes: Number(els.notifyEarly.value) || 0 });
  });
  els.notifyMinPriority?.addEventListener('change', () => {
    persistNotifyPrefs({ minPriority: els.notifyMinPriority.value || 'normal' });
  });
  els.notifyMonthPresets?.addEventListener('change', () => {
    state.settings.notifyMonthPresets = normalizeMonthPresets(els.notifyMonthPresets.value);
    saveSettings(state.settings);
    els.notifyMonthPresets.value = getMonthPresets().join(', ');
    refreshScheduleSelectOptions();
    renderRecurrenceFilterBar();
  });
  els.notifyMonthPresets?.addEventListener('blur', () => {
    if (!els.notifyMonthPresets) return;
    state.settings.notifyMonthPresets = normalizeMonthPresets(els.notifyMonthPresets.value);
    saveSettings(state.settings);
    els.notifyMonthPresets.value = getMonthPresets().join(', ');
    refreshScheduleSelectOptions();
    renderRecurrenceFilterBar();
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

  initAiScheduleControls();
  bindAiFormDirtyWatchers();
  els.googleLoginBtn?.addEventListener('click', () => {
    void handleGoogleLoginClick();
  });
  els.signOutBtn?.addEventListener('click', async () => {
    const ok = await showConfirm('ออกจากระบบ? ข้อมูลในเครื่องยังอยู่ — คลาวด์จะหยุดซิงค์', {
      okLabel: 'ออกจากระบบ',
      danger: true,
    });
    if (!ok) return;
    await signOut();
    state.authUser = null;
    state.online = false;
    state.cloudHydrated = false;
    refreshAuthAccountHint();
    setAuthOverlayVisible(true);
    setSyncStatus('offline', 'ออกจากระบบแล้ว');
  });
  els.exportNotesBtn?.addEventListener('click', exportNotesBackup);
  els.importNotesBtn?.addEventListener('click', () => els.importNotesFile?.click());
  els.importNotesFile?.addEventListener('change', async () => {
    const file = els.importNotesFile.files?.[0];
    if (els.importNotesFile) els.importNotesFile.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      await applyImportedNotes(text);
    } catch (err) {
      console.warn('import file failed', err);
      setStatus('อ่านไฟล์ไม่สำเร็จ');
    }
  });
  els.importNotesPasteBtn?.addEventListener('click', async () => {
    const text = String(els.importNotesText?.value || '').trim();
    if (!text) {
      setStatus('วาง JSON ก่อน');
      return;
    }
    const ok = await applyImportedNotes(text);
    if (ok && els.importNotesText) els.importNotesText.value = '';
  });
  els.importMergeSeg?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-import-merge]');
    if (!btn) return;
    importMergePreferred = btn.dataset.importMerge === '1';
    els.importMergeSeg.querySelectorAll('[data-import-merge]').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
  });
  els.aiChecklistAdd?.addEventListener('click', () => {
    aiChecklistDraft.push(newChecklistItem());
    renderAiChecklist();
    updateAiCancelBtn();
    const inputs = els.aiChecklistList?.querySelectorAll('input[type="text"]');
    inputs?.[inputs.length - 1]?.focus();
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
        '.context-menu, .note-center-overlay, .filter-dock, .filter-dd-menu, .note-card',
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
    isEnabled: () => isManualMode() && !state.selectionMode,
    onTap: (noteId) => {
      if (state.selectionMode) toggleNoteSelected(noteId);
      else openEditor(noteId);
    },
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

  els.noteTextSmaller?.addEventListener('click', () => {
    patchEditorTextPrefs({ fontSize: clampFontSize(state.editorTextPrefs.fontSize, -1) });
  });
  els.noteTextLarger?.addEventListener('click', () => {
    patchEditorTextPrefs({ fontSize: clampFontSize(state.editorTextPrefs.fontSize, 1) });
  });
  els.noteTextCode?.addEventListener('click', () => {
    const on = !normalizeTextPrefs(state.editorTextPrefs).codeMode;
    patchEditorTextPrefs({ codeMode: on });
  });
  els.noteTextTab2?.addEventListener('click', () => patchEditorTextPrefs({ tabWidth: 2 }));
  els.noteTextTab4?.addEventListener('click', () => patchEditorTextPrefs({ tabWidth: 4 }));

  els.noteContent?.addEventListener('keydown', (event) => {
    if (!state.activeNotepadId || !document.body.classList.contains('notepad-editing')) return;
    const prefs = normalizeTextPrefs(state.editorTextPrefs);
    if (event.key === 'Tab') {
      event.preventDefault();
      handleTextareaTab(els.noteContent, {
        shiftKey: event.shiftKey,
        tabWidth: prefs.tabWidth,
      });
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && prefs.codeMode) {
      event.preventDefault();
      handleTextareaEnterIndent(els.noteContent);
    }
  });

  els.noteSchedule.addEventListener('change', flushEditorToState);
  els.noteRemindBefore?.addEventListener('change', () => {
    updateNotifyDetailsPreview();
    flushEditorToState();
  });
  els.noteNotifyRepeat?.addEventListener('change', () => {
    const repeat = normalizeNotifyRepeat(els.noteNotifyRepeat?.value);
    if (repeat !== 'none' && !els.noteSchedule.value) {
      els.noteSchedule.value = defaultDatetimeLocalValue();
    }
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
    if (document.visibilityState !== 'visible') return;
    refreshNoteNotifications();
    // Soft re-warm when returning to the app (throttled; toast only if data changed).
    void syncSpaceInBackground({ force: false, announce: false }).then((changed) => {
      if (changed) setDbStatusMessage('ซิงค์ข้อมูลล่าสุดแล้ว');
    });
  });
  window.addEventListener('pageshow', () => refreshNoteNotifications());
  window.addEventListener('focus', () => refreshNoteNotifications());
  window.addEventListener('online', () => {
    refreshNoteNotifications();
    setSyncStatus('busy', 'กำลังซิงค์…');
    void syncSpaceInBackground({ force: true, announce: true });
  });
  window.addEventListener('offline', () => {
    setSyncStatus('offline', 'ออฟไลน์ · เก็บในเครื่อง');
  });

  // Block iOS pinch/gesture zoom so the fixed layout never overflows its edges.
  document.addEventListener('gesturestart', (event) => event.preventDefault());
  document.addEventListener('gesturechange', (event) => event.preventDefault());

  initSwipeBack();
  initFilterDock();
  initSelectionDock();
  initNotesListTagFilter();
  const afterPaint = () => {
    initAttachViewer();
    // Camera only when user opens it — do not prefetch on boot.
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 800));
    idle(() => {
      // Warm user-context in background only if AI profile exists
      if (String(state.settings?.aiProfile || '').trim()) {
        refreshUserContextLazy(state.notesData);
      }
    }, { timeout: 2500 });
  };

  bootstrapData().then(async () => {
    afterPaint();
    if (getNotifyPrefs().enabled) {
      await registerNotifyServiceWorker();
      if (notificationPermission() === 'granted') refreshNoteNotifications();
    }
    startNotifyKeepalive(
      () => filterNotesByStatus(state.notesData.notes, NOTE_STATUS.ACTIVE),
      () => getNotifyPrefs(),
    );
  });
}

/** Called by boot.js after list-first paint. */
export async function hydrateApp() {
  document.documentElement.dataset.pnoteHydrated = '1';
  await init({ fromBoot: true });
}

// Direct entry (no boot.js) — full init.
if (document.documentElement.dataset.pnoteBoot !== '1') {
  init();
}

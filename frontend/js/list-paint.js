/**
 * List-first paint — work board only, no AI/settings/editor wiring.
 * Used by boot.js so the work list appears before app.js downloads.
 */
import { loadNotes } from './local.js?v=148';
import {
  NOTE_STATUS,
  NOTE_PRIORITY,
  filterNotesByStatus,
  filterNotesByTag,
  filterNotesByPriority,
  filterNotesBySearch,
  getTagsForNote,
  notePriority,
  normalizeNotesData,
  priorityLabel,
  safeTagColor,
  sortNotes,
  sortNotesManual,
  TAG_FILTER_UNTAGGED,
} from './notes.js?v=148';
import {
  filterNotesByRecurrence,
  filterNotesByDueScope,
  recurrenceLabel,
  relativeDayLabel,
  scheduleProximity,
  sortNotesBySchedule,
} from './schedule.js?v=148';
import {
  FIXED_UI,
  loadSettings,
  normalizeCardDisplay,
  normalizePriorityColors,
  DEFAULT_PRIORITY_COLORS,
  dockScaleToCss,
  dockOffsetYToLiftPx,
  densityToCssUnit,
} from './settings.js?v=153';
import {
  bestIconForLabel,
  DEFAULT_PRIORITY_ICONS,
  iconSvg,
  normalizeIconId,
  normalizePriorityIcons,
} from './icons.js?v=148';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

function metaShowsText(mode) {
  return mode === 'text' || mode === 'both';
}
function metaShowsIcon(mode) {
  return mode === 'icon' || mode === 'both';
}

function priorityIconColor(settings, display, prio) {
  const defaults = normalizePriorityColors(settings.priorityColors);
  if (display.iconColorMode === 'custom') {
    const custom = display.priorityIconColors?.[prio];
    if (custom) return custom;
  }
  return defaults[prio] || defaults.normal;
}

function sortedWorkNotes(data, settings) {
  let notes = filterNotesByStatus(data.notes || [], NOTE_STATUS.ACTIVE);
  const tagFilterId = settings.tagFilterId || null;
  if (tagFilterId === TAG_FILTER_UNTAGGED) {
    notes = notes.filter((n) => !(n.tagIds || []).length);
  } else if (tagFilterId) {
    notes = filterNotesByTag(notes, tagFilterId);
  }
  if (settings.priorityFilter) {
    notes = filterNotesByPriority(notes, settings.priorityFilter);
  }
  if (settings.recurrenceFilter) {
    notes = filterNotesByRecurrence(notes, settings.recurrenceFilter);
  }
  if (settings.dueScope) {
    notes = filterNotesByDueScope(notes, settings.dueScope);
  }
  const q = String(settings.searchQuery || '').trim();
  if (q) notes = filterNotesBySearch(notes, q, data.tags || []);

  const sortMode = settings.sortMode || 'updated';
  if (sortMode === 'schedule') return sortNotesBySchedule(notes);
  if (sortMode === 'manual') return sortNotesManual(notes);
  return sortNotes(notes);
}

function cardMetaHtml(note, tags, settings, display) {
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
  const prioIcons = normalizePriorityIcons(settings.priorityIcons || DEFAULT_PRIORITY_ICONS);
  if (priority !== NOTE_PRIORITY.NORMAL && display.priority !== 'off') {
    const iconId = prioIcons[priority] || DEFAULT_PRIORITY_ICONS[priority] || 'circle';
    const color = priorityIconColor(settings, display, priority);
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
    parts.push(`<span class="meta-bit meta-recur" title="ทำซ้ำ">${iconPart}${textPart}</span>`);
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

function leadIconHtml(note, tags, settings, display) {
  if (!display.leadIcon) return '';
  const firstTag = (tags || [])[0];
  const prio = notePriority(note);
  const prioIcons = normalizePriorityIcons(settings.priorityIcons || DEFAULT_PRIORITY_ICONS);
  if (firstTag) {
    const iconId = normalizeIconId(firstTag.icon || bestIconForLabel(firstTag.name), 'doc');
    const color = safeTagColor(firstTag.color);
    return `<span class="card-lead-icon" style="--lead:${color}" title="${escapeHtml(firstTag.name)}">${iconSvg(iconId, { size: 16, className: 'card-lead-svg' })}</span>`;
  }
  const iconId = prioIcons[prio] || DEFAULT_PRIORITY_ICONS[prio] || 'circle';
  const color = priorityIconColor(settings, display, prio);
  return `<span class="card-lead-icon is-prio" style="--lead:${color}" title="${escapeHtml(priorityLabel(prio))}">${iconSvg(iconId, { size: 16, className: 'card-lead-svg' })}</span>`;
}

function applyListChrome(settings) {
  document.body.classList.add('light');
  document.body.classList.toggle('note-mode', settings.appMode === 'note');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#e8f0ea');

  const listView = document.getElementById('list-view');
  if (listView) {
    listView.style.setProperty('--card-density', String(densityToCssUnit(FIXED_UI.cardDensity)));
  }
  const dock = document.getElementById('filter-dock');
  if (dock) {
    dock.style.setProperty('--dock-scale', String(dockScaleToCss(FIXED_UI.dockScale)));
    dock.style.setProperty('--dock-lift', `${dockOffsetYToLiftPx(FIXED_UI.dockOffsetY)}px`);
  }
  const prio = normalizePriorityColors(settings.priorityColors || DEFAULT_PRIORITY_COLORS);
  const root = document.documentElement;
  root.style.setProperty('--prio-normal', prio.normal);
  root.style.setProperty('--prio-important', prio.important);
  root.style.setProperty('--prio-urgent', prio.urgent);
  root.style.setProperty('--prio-critical', prio.critical);

  const modeName = document.getElementById('mode-switch-name');
  if (modeName) {
    if (settings.appMode === 'calendar') modeName.textContent = 'ปฏิทิน';
    else modeName.textContent = settings.appMode === 'note' ? 'Note' : 'งานหลัก';
  }
  const barVer = document.getElementById('mode-switch-ver');
  if (barVer) {
    const build =
      document.querySelector('meta[name="pnote-build"]')?.content || '';
    const n = String(build).replace(/^v/i, '');
    barVer.textContent = n ? `v${n}` : '';
  }
}

/**
 * Paint work list from localStorage as fast as possible.
 * @returns {{ settings: object, notesData: object }}
 */
export function paintListFromLocal() {
  const settings = loadSettings();
  // Work-list first: force work mode for the critical paint if last mode was note —
  // note mode can hydrate fully when app.js loads. Prefer showing work board shell.
  const bootSettings = {
    ...settings,
    appMode: 'work',
    searchQuery: '',
  };
  // loadNotes() returns { data } — never pass the wrapper into normalize/save
  // or first paint will wipe pnote_local_data.
  const { data: loaded } = loadNotes();
  const notesData = normalizeNotesData(loaded);

  applyListChrome(bootSettings);

  const boardTopbar = document.getElementById('board-topbar');
  const listView = document.getElementById('list-view');
  const editorView = document.getElementById('editor-view');
  const calendarView = document.getElementById('calendar-view');
  const loading = document.getElementById('loading-overlay');
  if (editorView) editorView.hidden = true;
  if (calendarView) calendarView.hidden = true;
  if (boardTopbar) boardTopbar.hidden = false;
  if (listView) listView.hidden = false;
  if (loading) loading.hidden = true;

  const notesList = document.getElementById('notes-list');
  const emptyState = document.getElementById('empty-state');
  const emptyText = document.getElementById('empty-state-text');
  if (!notesList) {
    return { settings, notesData };
  }

  const display = normalizeCardDisplay(bootSettings.cardDisplay);
  const prioColors = normalizePriorityColors(bootSettings.priorityColors);
  const notes = sortedWorkNotes(notesData, bootSettings);
  notesList.innerHTML = '';
  notesList.classList.toggle('notes-list--compact', true);

  notes.forEach((note) => {
    const item = document.createElement('div');
    item.className = 'note-card note-card-split note-card-compact';
    item.dataset.noteId = note.id;
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    const priority = notePriority(note);
    const prioColor = prioColors[priority] || prioColors.normal;
    const tags = getTagsForNote(note, notesData.tags || []);
    const titleText = stripLeadingEmoji(note.title || '') || 'ไม่มีหัวข้อ';
    const metaHtml = cardMetaHtml(note, tags, bootSettings, display);
    const leadHtml = leadIconHtml(note, tags, bootSettings, display);
    item.innerHTML = `
      <div class="card-compact-body" style="--prio:${escapeHtml(prioColor)}">
        <div class="card-compact-row">
          ${leadHtml}
          <h3 class="card-title">${escapeHtml(titleText)}</h3>
          ${metaHtml}
        </div>
      </div>
    `;
    notesList.appendChild(item);
  });

  if (emptyState) emptyState.hidden = notes.length > 0;
  if (emptyText && !notes.length) emptyText.textContent = 'ยังไม่มีงาน';

  document.documentElement.dataset.pnoteBoot = '1';
  return { settings, notesData };
}

/**
 * Exercise picker sheet (+ ท่า): browse the library by beginner group, search, filter by
 * equipment, favorite moves, and add a move to the muscle table (optionally logged today).
 */
import {
  ALL_EXERCISES,
  EQUIPMENT_TH,
  BEGINNER_GROUPS,
  exerciseImages,
  libraryExerciseByName,
  regionById,
  renderBodyPairHtml,
  renderBodySvg,
  restRemaining,
} from './muscle-map.js?v=327';
import { regionRestMap } from './muscle-tree.js?v=327';

const FAVS_KEY = 'pnote_ex_favs';
const FAV_GROUP = 'fav';
const SEARCH_LIMIT = 60;
const TOAST_MS = 8000;

let deps = {
  getTree: () => null,
  getTodayKey: () => '',
  onAdd: () => null,
  setStatus: () => {},
};
let els = {};
let groupId = null;
let query = '';
let detailId = '';
let detailOnly = false;
let showExtras = false;
let searchTimer = 0;
const eqSel = new Set();
let toastTimer = 0;
let toastUndo = null;
const thumbCache = new Map();

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Region id → number of drawn muscle paths on that side. */
function regionPathCounts(side) {
  const counts = new Map();
  for (const m of renderBodySvg(side).matchAll(/data-region="([^"]+)"/g)) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  return counts;
}
let sidePaths = null;

function thumbSide(e) {
  if (!sidePaths) sidePaths = { front: regionPathCounts('front'), back: regionPathCounts('back') };
  const score = (side) => e.p.reduce((n, id, i) => n + (sidePaths[side].get(id) || 0) * (i ? 1 : 2), 0);
  return score('back') > score('front') ? 'back' : 'front';
}

const musclePaint = (e) => (id) => (e.p.includes(id) ? { cls: 'xp-p' } : e.s.includes(id) ? { cls: 'xp-s' } : {});

function bodyThumb(e) {
  if (!thumbCache.has(e.id)) thumbCache.set(e.id, renderBodySvg(thumbSide(e), musclePaint(e), { label: e.name }));
  return thumbCache.get(e.id);
}

/** Pose photo with a small muscle badge; muscle figure alone when there is no photo. */
function thumbHtml(e) {
  const img = exerciseImages(e)[0];
  if (!img) return `<span class="xp-thumb-body">${bodyThumb(e)}</span>`;
  return `<img class="xp-thumb-img" src="${esc(img)}" alt="" loading="lazy" decoding="async">
    <span class="xp-thumb-badge">${bodyThumb(e)}</span>`;
}

const exById = new Map(ALL_EXERCISES.map((e) => [e.id, e]));

function detailHtml(e, tree, favs) {
  const imgs = exerciseImages(e);
  const fav = favs.has(e.id);
  const names = (ids) => ids.map((id) => regionById(id)?.name).filter(Boolean).join(', ') || '–';
  const photo = imgs.length
    ? `<div class="xp-detail-photo${imgs.length > 1 ? ' is-anim' : ''}">${imgs.slice(0, 2).map((u, i) => `<img class="xp-frame xp-frame-${i}" src="${esc(u)}" alt="${esc(`${e.name} จังหวะที่ ${i + 1}`)}" decoding="async">`).join('')}</div>`
    : '<p class="xp-empty">ยังไม่มีรูปท่านี้</p>';
  return `<div class="xp-detail">
      ${photo}
      <h3 class="xp-detail-th">${esc(e.name)}</h3>
      <p class="xp-detail-en">${esc(e.en || '')}${EQUIPMENT_TH[e.eq] ? ` · ${esc(EQUIPMENT_TH[e.eq])}` : ''}</p>
      <div class="xp-detail-muscles">
        <div class="xp-detail-body">${renderBodyPairHtml(musclePaint(e), { compact: true })}</div>
        <dl>
          <dt><i class="xp-key is-p"></i>กล้ามหลัก (นับ 1)</dt><dd>${esc(names(e.p))}</dd>
          <dt><i class="xp-key is-s"></i>กล้ามรอง (นับ ½)</dt><dd>${esc(names(e.s))}</dd>
        </dl>
      </div>
      <div class="xp-detail-actions">
        <button type="button" class="xp-star${fav ? ' is-on' : ''}" data-xp-fav="${esc(e.id)}" aria-pressed="${fav}" aria-label="${fav ? 'เอาออกจากท่าโปรด' : 'เพิ่มเป็นท่าโปรด'}">${fav ? '★' : '☆'}</button>
        <button type="button" class="btn btn-primary" data-xp-today="${esc(e.name)}" title="ติ๊กกล้ามหลัก/รองของท่านี้ว่าเล่นวันนี้">เล่นวันนี้</button>
      </div>
      <p class="xp-credit">รูป: free-exercise-db (สาธารณสมบัติ)</p>
    </div>`;
}

function loadFavs() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVS_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveFavs(favs) {
  try {
    localStorage.setItem(FAVS_KEY, JSON.stringify([...favs]));
  } catch { /* storage blocked */ }
}

function libraryFiltered() {
  return eqSel.size ? ALL_EXERCISES.filter((e) => eqSel.has(e.eq)) : ALL_EXERCISES;
}

function groupById(id) {
  return BEGINNER_GROUPS.find((g) => g.id === id) || null;
}

/** Moves whose first primary is in the group come first, then moves with any primary there. */
function groupExercises(group, list = libraryFiltered()) {
  const main = list.filter((e) => group.regions.includes(e.p[0]));
  const more = list.filter((e) => !group.regions.includes(e.p[0]) && e.p.some((id) => group.regions.includes(id)));
  return [...main, ...more];
}

/**
 * Loose key so common spellings meet: no spaces/dashes, no tone marks or ์,
 * ช/ต/ส/ซ→ท, ค→ก, doubled ล collapsed (สควอช = สควอส = สควอท, ดัมเบลล์ = ดัมเบล).
 */
const normQ = (s) => String(s || '')
  .toLowerCase()
  .replace(/[\s\-_/().,·]+/g, '')
  .replace(/[\u0E47-\u0E4E]/g, '')
  .replace(/[ชตสซศษ]/g, 'ท')
  .replace(/ค/g, 'ก')
  .replace(/ลล/g, 'ล');

const nameKeys = new Map();
function keysOf(e) {
  if (!nameKeys.has(e.id)) {
    const words = [e.name, e.en, ...(e.aka || [])].map(normQ).filter(Boolean);
    const areas = e.p.flatMap((id) => [regionById(id)?.name, ...BEGINNER_GROUPS.filter((g) => g.regions.includes(id)).map((g) => g.name)])
      .map(normQ).filter(Boolean);
    nameKeys.set(e.id, { words, areas });
  }
  return nameKeys.get(e.id);
}

function searchExercises(q, list = libraryFiltered()) {
  const key = normQ(q);
  if (!key) return [];
  const rank = (e) => {
    const { words, areas } = keysOf(e);
    if (words.some((n) => n === key)) return 0;
    if (words.some((n) => n.startsWith(key))) return 1;
    if (words.some((n) => n.includes(key))) return 2;
    if (areas.some((n) => n.includes(key))) return e.extra ? 4 : 3;
    return -1;
  };
  return list
    .map((e, i) => ({ e, r: rank(e), i }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.e);
}

function favFirst(list, favs) {
  return [...list.filter((e) => favs.has(e.id)), ...list.filter((e) => !favs.has(e.id))];
}

/** 'ok' = every trained region recovered, 'rest' = some still resting, 'never' = none trained. */
function groupRestState(regions, restMap) {
  let seen = false;
  for (const id of regions) {
    const info = restMap.get(id);
    if (!info) continue;
    seen = true;
    if (restRemaining(info.days, info.rest) > 0) return 'rest';
  }
  return seen ? 'ok' : 'never';
}

const REST_DOT_TITLE = { ok: 'พักครบแล้ว', rest: 'กำลังพัก', never: 'ยังไม่เคยเล่น' };

function safeTree() {
  try {
    return deps.getTree();
  } catch {
    return null;
  }
}

function paintChips() {
  if (!els.eq) return;
  const codes = Object.keys(EQUIPMENT_TH).filter((code) => ALL_EXERCISES.some((e) => e.eq === code));
  const chip = (code, label, on) =>
    `<button type="button" class="xp-chip${on ? ' is-on' : ''}" data-xp-eq="${esc(code)}" aria-pressed="${on}">${esc(label)}</button>`;
  els.eq.innerHTML = chip('', 'ทั้งหมด', !eqSel.size) + codes.map((c) => chip(c, EQUIPMENT_TH[c], eqSel.has(c))).join('');
}

function groupsHtml(tree, favs) {
  const restMap = tree ? regionRestMap(tree, deps.getTodayKey()) : new Map();
  const list = libraryFiltered();
  const card = (id, name, count, state) => `<button type="button" class="xp-group" data-xp-group="${esc(id)}">
      <span class="xp-group-name">${state ? `<i class="xp-dot is-${state}" title="${esc(REST_DOT_TITLE[state])}"></i>` : ''}${esc(name)}</span>
      <span class="xp-group-count">${count} ท่า</span>
    </button>`;
  const favCount = list.filter((e) => favs.has(e.id)).length;
  const favCard = favs.size ? card(FAV_GROUP, '★ ท่าโปรด', favCount, '') : '';
  const cards = BEGINNER_GROUPS
    .map((g) => card(g.id, g.name, groupExercises(g, list).length, groupRestState(g.regions, restMap)))
    .join('');
  return `<div class="xp-grid">${favCard}${cards}</div>
    <p class="xp-legend"><i class="xp-dot is-ok"></i>พักครบ <i class="xp-dot is-rest"></i>กำลังพัก <i class="xp-dot is-never"></i>ยังไม่เคยเล่น</p>`;
}

function rowHtml(e, tree, favs) {
  const fav = favs.has(e.id);
  const meta = [e.en, EQUIPMENT_TH[e.eq] || ''].filter(Boolean).join(' · ');
  return `<div class="xp-row">
      <button type="button" class="xp-thumb" data-xp-detail="${esc(e.id)}" aria-label="${esc(`ดูท่า ${e.name}`)}">${thumbHtml(e)}</button>
      <button type="button" class="xp-row-main" data-xp-detail="${esc(e.id)}" title="ดูท่าและกล้ามที่ใช้">
        <span class="xp-row-text">
          <span class="xp-row-name">${esc(e.name)}</span>
          <span class="xp-row-meta">${esc(meta)}</span>
        </span>
      </button>
      <button type="button" class="xp-star${fav ? ' is-on' : ''}" data-xp-fav="${esc(e.id)}" aria-pressed="${fav}" aria-label="${fav ? 'เอาออกจากท่าโปรด' : 'เพิ่มเป็นท่าโปรด'}">${fav ? '★' : '☆'}</button>
      <button type="button" class="btn btn-secondary xp-today" data-xp-today="${esc(e.name)}" title="ติ๊กกล้ามของท่านี้ว่าเล่นวันนี้">เล่นวันนี้</button>
    </div>`;
}

function listHtml(list, tree, favs, { limit = 0 } = {}) {
  const shown = limit ? list.slice(0, limit) : list;
  const rows = shown.map((e) => rowHtml(e, tree, favs)).join('');
  const more = limit && list.length > limit
    ? `<p class="xp-empty">แสดง ${limit} จาก ${list.length} ท่า · พิมพ์ให้เจาะจงขึ้น</p>` : '';
  const empty = list.length ? '' : `<p class="xp-empty">${eqSel.size ? 'ไม่พบท่าที่ตรงกับอุปกรณ์ที่เลือก' : 'ไม่พบท่า'}</p>`;
  const hint = '<p class="xp-empty">ไม่เจอท่าที่เล่น? แตะช่องกล้ามในตารางเองได้เลย · ท่าเป็นแค่ไกด์</p>';
  return `<div class="xp-list">${rows}</div>${more}${empty}${hint}`;
}

function paint() {
  if (!els.body) return;
  const tree = safeTree();
  const favs = loadFavs();
  const group = groupId === FAV_GROUP ? null : groupById(groupId);
  let title = 'ท่าไกด์';
  let html;
  const detail = detailId ? exById.get(detailId) : null;
  if (detail) {
    title = 'ท่า';
    html = detailHtml(detail, tree, favs);
  } else if (query.trim()) {
    title = 'ค้นหาท่า';
    html = listHtml(favFirst(searchExercises(query), favs), tree, favs, { limit: SEARCH_LIMIT });
  } else if (groupId === FAV_GROUP) {
    title = '★ ท่าโปรด';
    html = listHtml(libraryFiltered().filter((e) => favs.has(e.id)), tree, favs);
  } else if (group) {
    title = `กลุ่ม${group.name}`;
    const all = groupExercises(group);
    const main = all.filter((e) => !e.extra || favs.has(e.id));
    const extras = all.filter((e) => !main.includes(e));
    html = listHtml(favFirst(showExtras ? [...main, ...extras] : main, favs), tree, favs);
    if (extras.length && !showExtras) {
      html = html.replace('<p class="xp-empty">ไม่เจอท่า', `<button type="button" class="btn btn-secondary xp-more" data-xp-more>ท่าเพิ่มเติม (${extras.length}) · มีรูป</button><p class="xp-empty">ไม่เจอท่า`);
    }
  } else {
    html = groupsHtml(tree, favs);
  }
  if (els.title) els.title.textContent = title;
  if (els.back) els.back.hidden = !detail && !query.trim() && !groupId;
  if (els.search) els.search.hidden = Boolean(detail);
  if (els.eq) els.eq.hidden = Boolean(detail);
  const view = `${groupId}|${query}|${detailId}`;
  const keepScroll = els.body.dataset.view === view;
  if (!detail && !keepScroll && listScroll.view === view) listScroll.restore = true;
  const top = els.body.scrollTop;
  els.body.innerHTML = html;
  els.body.dataset.view = view;
  els.body.scrollTop = keepScroll ? top : listScroll.restore ? listScroll.top : 0;
  listScroll.restore = false;
}

const listScroll = { view: '', top: 0, restore: false };

function openDetail(id) {
  listScroll.view = els.body?.dataset.view || '';
  listScroll.top = els.body?.scrollTop || 0;
  detailId = id;
  paint();
}

function hideToast() {
  clearTimeout(toastTimer);
  toastUndo = null;
  if (els.toast) els.toast.hidden = true;
}

function showToast(text, undo) {
  if (!els.toast) return;
  clearTimeout(toastTimer);
  toastUndo = undo || null;
  els.toast.innerHTML = `<span class="xp-toast-text">${esc(text)}</span>${undo ? '<button type="button" class="xp-toast-undo" data-xp-undo>ยกเลิก</button>' : ''}`;
  els.toast.hidden = false;
  toastTimer = setTimeout(hideToast, TOAST_MS);
}

function logToday(name) {
  const res = deps.onAdd(name);
  if (!res) return;
  const label = res.node?.name || name;
  if (res.logged) showToast(`ติ๊กกล้ามของ ${label} วันนี้แล้ว`, res.undo);
  else showToast(`${label} บันทึกไว้แล้ววันนี้`);
  paint();
}

function toggleFav(id) {
  const favs = loadFavs();
  if (favs.has(id)) favs.delete(id);
  else favs.add(id);
  saveFavs(favs);
  if (groupId === FAV_GROUP && !favs.size) groupId = null;
  paint();
}

function onBodyClick(e) {
  const t = e.target;
  const grp = t?.closest?.('[data-xp-group]');
  if (grp) {
    groupId = grp.dataset.xpGroup;
    showExtras = false;
    paint();
    return;
  }
  if (t?.closest?.('[data-xp-more]')) {
    showExtras = true;
    paint();
    return;
  }
  const fav = t?.closest?.('[data-xp-fav]');
  if (fav) {
    toggleFav(fav.dataset.xpFav);
    return;
  }
  const det = t?.closest?.('[data-xp-detail]');
  if (det) {
    openDetail(det.dataset.xpDetail);
    return;
  }
  const today = t?.closest?.('[data-xp-today]');
  if (today) {
    logToday(today.dataset.xpToday);
  }
}

function onEqClick(e) {
  const chip = e.target?.closest?.('[data-xp-eq]');
  if (!chip) return;
  const code = chip.dataset.xpEq;
  if (!code) eqSel.clear();
  else if (eqSel.has(code)) eqSel.delete(code);
  else eqSel.add(code);
  paintChips();
  paint();
}

function onBack() {
  if (detailId) {
    detailId = '';
    if (detailOnly) {
      detailOnly = false;
      closeExercisePicker();
      return;
    }
  } else if (query.trim()) {
    query = '';
    if (els.search) els.search.value = '';
  } else {
    groupId = null;
  }
  paint();
}

function closeExercisePicker() {
  hideToast();
  if (els.overlay) els.overlay.hidden = true;
}

export function initExercisePicker(opts = {}) {
  deps = { ...deps, ...opts };
  els = {
    overlay: document.getElementById('muscle-picker-overlay'),
    title: document.getElementById('muscle-picker-title'),
    back: document.getElementById('muscle-picker-back'),
    search: document.getElementById('muscle-picker-search'),
    eq: document.getElementById('muscle-picker-eq'),
    body: document.getElementById('muscle-picker-body'),
    toast: document.getElementById('muscle-picker-toast'),
  };
  if (!els.overlay) return;
  els.body?.addEventListener('click', onBodyClick);
  els.eq?.addEventListener('click', onEqClick);
  els.back?.addEventListener('click', onBack);
  els.search?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = els.search.value;
      paint();
    }, 150);
  });
  els.search?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      els.search.blur();
    }
  });
  els.toast?.addEventListener('click', (e) => {
    if (!e.target?.closest?.('[data-xp-undo]') || !toastUndo) return;
    const undo = toastUndo;
    hideToast();
    undo();
    paint();
  });
  els.overlay.querySelectorAll('[data-close-overlay]').forEach((el) => {
    el.addEventListener('click', hideToast);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || els.overlay.hidden) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    closeExercisePicker();
  }, true);
}

/** Open straight to one move's photo + muscles (e.g. from a table row). */
export function openExerciseDetail(name) {
  const e = libraryExerciseByName(name);
  if (!els.overlay || !e?.id || !exById.has(e.id)) return false;
  groupId = null;
  query = '';
  if (els.search) els.search.value = '';
  detailId = e.id;
  detailOnly = true;
  hideToast();
  paintChips();
  paint();
  els.overlay.hidden = false;
  return true;
}

export function openExercisePicker({ groupId: gid } = {}) {
  if (!els.overlay) return;
  groupId = gid === FAV_GROUP || groupById(gid) ? gid : null;
  detailId = '';
  detailOnly = false;
  showExtras = false;
  eqSel.clear();
  query = '';
  if (els.search) els.search.value = '';
  hideToast();
  paintChips();
  paint();
  els.overlay.hidden = false;
}

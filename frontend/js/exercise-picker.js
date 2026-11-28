/**
 * Exercise picker sheet (+ ท่า): browse the library by beginner group, search, filter by
 * equipment, favorite moves, today's plan, and log a move as played.
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
} from './muscle-map.js?v=354';
import { regionRestMap } from './muscle-tree.js?v=354';
import {
  parseYoutubeVideoId,
  youtubeNocookieEmbedUrl,
} from './settings.js?v=354';

const FAV_GROUP = 'fav';
const SEARCH_LIMIT = 60;
const TOAST_MS = 8000;

let deps = {
  getTree: () => null,
  getTodayKey: () => '',
  onAdd: () => null,
  onPlanToday: () => null,
  getFavs: () => new Set(),
  setFav: () => {},
  getMedia: () => null,
  setMedia: () => ({ ok: false }),
  uploadMediaFile: async () => ({ ok: false, error: 'อัปโหลดยังไม่พร้อม' }),
  removeMediaItem: async () => ({ ok: false }),
  addMediaLink: () => ({ ok: false }),
  resolveMediaUrl: async () => '',
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
let cuesToken = 0;
let ytDraft = '';
let ytError = '';
let linkDraft = '';
let linkError = '';
let mediaBusy = false;
let mediaBusyText = '';
let mediaError = '';
let mediaToken = 0;
let embedMountSeq = 0;

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

function loadFavs() {
  try {
    return new Set(deps.getFavs?.() || []);
  } catch {
    return new Set();
  }
}

function mediaFor(id) {
  try {
    return deps.getMedia?.(id) || null;
  } catch {
    return null;
  }
}

function detailHtml(e, tree, favs) {
  const imgs = exerciseImages(e);
  const fav = favs.has(e.id);
  const names = (ids) => ids.map((id) => regionById(id)?.name).filter(Boolean).join(', ') || '–';
  const photo = imgs.length
    ? `<div class="xp-detail-photo${imgs.length > 1 ? ' is-anim' : ''}">${imgs.slice(0, 2).map((u, i) => `<img class="xp-frame xp-frame-${i}" src="${esc(u)}" alt="${esc(`${e.name} จังหวะที่ ${i + 1}`)}" decoding="async">`).join('')}</div>`
    : '<p class="xp-empty">ยังไม่มีรูปท่านี้</p>';
  const media = mediaFor(e.id) || {};
  const savedYt = String(media.yt || '');
  const draft = ytDraft !== '' || ytError ? ytDraft : savedYt;
  const videoId = parseYoutubeVideoId(savedYt);
  const embed = videoId ? youtubeNocookieEmbedUrl(videoId) : '';
  const embedBlock = embed
    ? `<div class="xp-yt-embed" data-xp-embed="${esc(videoId)}"><iframe src="${esc(embed)}" title="YouTube" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    : '';
  const items = Array.isArray(media.items) ? media.items : [];
  const itemsHtml = items.length
    ? `<ul class="xp-media-list">${items.map((it) => mediaItemHtml(it)).join('')}</ul>`
    : '';
  const linkVal = linkDraft !== '' || linkError ? linkDraft : '';
  const busyHidden = mediaBusy ? '' : ' hidden';
  const errHidden = mediaError ? '' : ' hidden';
  const ytErrHidden = ytError ? '' : ' hidden';
  const clearHidden = savedYt ? '' : ' hidden';
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
        <button type="button" class="btn btn-secondary" data-xp-plan="${esc(e.id)}" title="ใส่ในแผนวันนี้ · ไม่ติ๊กกล้าม">ใส่แผนวันนี้</button>
        <button type="button" class="btn btn-primary" data-xp-today="${esc(e.name)}" title="ติ๊กกล้ามหลัก/รองของท่านี้ว่าเล่นแล้ววันนี้">เล่นแล้ว</button>
      </div>
      <section class="xp-media" data-xp-media="${esc(e.id)}">
        <h4 class="xp-media-title">เพิ่มสื่อของฉัน</h4>
        <p class="xp-media-hint">แนบรูปหรือคลิปจากเครื่องหรือกล้อง (ภาพหน้าจอ หรือคลิปที่ถ่าย/อัดหน้าจอ)</p>
        <div class="xp-media-actions">
          <input id="xp-media-file" class="xp-media-file" type="file" accept="image/*,video/*" data-xp-media-file>
          <button type="button" class="btn btn-primary" data-xp-media-add ${mediaBusy ? 'disabled' : ''}>เพิ่มรูปหรือคลิป</button>
        </div>
        <p class="xp-media-busy" data-xp-media-busy aria-live="polite"${busyHidden}>${esc(mediaBusy ? (mediaBusyText || 'กำลังอัปโหลด…') : '')}</p>
        <p class="xp-media-err" data-xp-media-err role="alert"${errHidden}>${esc(mediaError || '')}</p>
        ${itemsHtml}
        <div class="xp-media-links">
          <p class="xp-media-links-label">ลิงก์ (ถ้ามี)</p>
          <label class="xp-yt-label" for="xp-yt-input">YouTube</label>
          <div class="xp-yt-row">
            <input id="xp-yt-input" class="xp-yt-input" type="url" inputmode="url" autocomplete="off" placeholder="https://youtu.be/…" value="${esc(draft)}" data-xp-yt-input>
            <button type="button" class="btn btn-secondary" data-xp-yt-save>บันทึก</button>
            <button type="button" class="btn btn-secondary" data-xp-yt-clear${clearHidden}>ลบ</button>
          </div>
          <p class="xp-yt-err" data-xp-yt-err role="alert"${ytErrHidden}>${esc(ytError || '')}</p>
          ${embedBlock}
          <label class="xp-yt-label" for="xp-link-input">ลิงก์อื่น (TikTok / IG / FB ฯลฯ)</label>
          <div class="xp-yt-row">
            <input id="xp-link-input" class="xp-yt-input" type="url" inputmode="url" autocomplete="off" placeholder="https://…" value="${esc(linkVal)}" data-xp-link-input>
            <button type="button" class="btn btn-secondary" data-xp-link-save>เพิ่ม</button>
          </div>
          <p class="xp-yt-err" data-xp-link-err role="alert"${linkError ? '' : ' hidden'}>${esc(linkError || '')}</p>
        </div>
      </section>
      <div class="xp-cues" data-xp-cues="${esc(e.id)}"><p class="xp-empty">กำลังโหลดวิธีเล่น…</p></div>
      <p class="xp-credit">รูป · วิธีเล่น: free-exercise-db (สาธารณสมบัติ)</p>
    </div>`;
}

function mediaItemHtml(it) {
  const id = esc(it.id);
  if (it.kind === 'link') {
    const href = esc(it.url || '#');
    const label = esc(it.name || it.url || 'ลิงก์');
    return `<li class="xp-media-item is-link" data-xp-media-item="${id}">
      <a class="xp-media-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>
      <button type="button" class="btn btn-secondary xp-media-del" data-xp-media-del="${id}">ลบ</button>
    </li>`;
  }
  if (it.kind === 'video') {
    return `<li class="xp-media-item is-video" data-xp-media-item="${id}">
      <video class="xp-media-video" controls playsinline preload="metadata" data-storage-path="${esc(it.storagePath || '')}"></video>
      <button type="button" class="btn btn-secondary xp-media-del" data-xp-media-del="${id}">ลบ</button>
    </li>`;
  }
  return `<li class="xp-media-item is-image" data-xp-media-item="${id}">
    <img class="xp-media-thumb" alt="" data-storage-path="${esc(it.storagePath || '')}">
    <button type="button" class="btn btn-secondary xp-media-del" data-xp-media-del="${id}">ลบ</button>
  </li>`;
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
    const areas = e.p.flatMap((id) => [regionById(id)?.name, ...(regionById(id)?.aka || []), ...BEGINNER_GROUPS.filter((g) => g.regions.includes(id)).map((g) => g.name)])
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
      <button type="button" class="btn btn-secondary xp-today" data-xp-today="${esc(e.name)}" title="ติ๊กกล้ามของท่านี้ว่าเล่นแล้ววันนี้">เล่นแล้ว</button>
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

function videoIdOf(e) {
  return parseYoutubeVideoId(String((mediaFor(e.id) || {}).yt || '')) || '';
}

/** Patch volatile detail bits in place so the YouTube iframe is never reparented. */
function patchDetailInPlace(e, favs) {
  const root = els.body;
  if (!root) return false;
  const favBtn = root.querySelector('[data-xp-fav]');
  const addBtn = root.querySelector('[data-xp-media-add]');
  const busyEl = root.querySelector('[data-xp-media-busy]');
  const errEl = root.querySelector('[data-xp-media-err]');
  const ytErrEl = root.querySelector('[data-xp-yt-err]');
  const ytInput = root.querySelector('[data-xp-yt-input]');
  const linkInput = root.querySelector('[data-xp-link-input]');
  const clearBtn = root.querySelector('[data-xp-yt-clear]');
  if (!favBtn || !addBtn || !busyEl || !errEl || !ytErrEl || !ytInput || !linkInput || !clearBtn) {
    return false;
  }
  const fav = favs.has(e.id);
  favBtn.classList.toggle('is-on', fav);
  favBtn.setAttribute('aria-pressed', String(fav));
  favBtn.textContent = fav ? '★' : '☆';
  favBtn.setAttribute('aria-label', fav ? 'เอาออกจากท่าโปรด' : 'เพิ่มเป็นท่าโปรด');

  const media = mediaFor(e.id) || {};
  const items = Array.isArray(media.items) ? media.items : [];
  let list = root.querySelector('.xp-media-list');
  const mediaSection = root.querySelector('[data-xp-media]');
  if (items.length) {
    if (!list && mediaSection) {
      list = document.createElement('ul');
      list.className = 'xp-media-list';
      const links = mediaSection.querySelector('.xp-media-links');
      if (links) mediaSection.insertBefore(list, links);
      else mediaSection.appendChild(list);
    }
    if (list) list.innerHTML = items.map((it) => mediaItemHtml(it)).join('');
  } else if (list) {
    list.remove();
  }
  void fillMediaSrcs();

  busyEl.textContent = mediaBusy ? (mediaBusyText || 'กำลังอัปโหลด…') : '';
  busyEl.hidden = !mediaBusy;
  errEl.textContent = mediaError || '';
  errEl.hidden = !mediaError;
  ytErrEl.textContent = ytError || '';
  ytErrEl.hidden = !ytError;
  const linkErrEl = root.querySelector('[data-xp-link-err]');
  if (linkErrEl) {
    linkErrEl.textContent = linkError || '';
    linkErrEl.hidden = !linkError;
  }

  const savedYt = String(media.yt || '');
  const draft = ytDraft !== '' || ytError ? ytDraft : savedYt;
  const linkVal = linkDraft !== '' || linkError ? linkDraft : '';
  if (document.activeElement !== ytInput) ytInput.value = draft;
  if (document.activeElement !== linkInput) linkInput.value = linkVal;
  clearBtn.hidden = !savedYt;
  addBtn.disabled = Boolean(mediaBusy);
  return true;
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
    const sig = JSON.stringify([
      detail.id, favs.has(detail.id), mediaFor(detail.id),
      ytDraft, ytError, linkDraft, linkError, mediaBusy, mediaBusyText, mediaError,
    ]);
    if (sig === lastDetailSig && els.body.dataset.view === `${groupId}|${query}|${detailId}`) {
      return; // nothing the detail renders from changed — never touch the DOM
    }
    lastDetailSig = sig;
  } else {
    lastDetailSig = '';
  }
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
  const sameVideo = detail
    && els.body.dataset.detailId === detail.id
    && (els.body.querySelector('[data-xp-embed]')?.dataset.xpEmbed || '') === (videoIdOf(detail) || '');
  if (sameVideo && patchDetailInPlace(detail, favs)) {
    if (els.title) els.title.textContent = 'ท่า';
    return;
  }
  els.body.innerHTML = html;
  els.body.dataset.view = view;
  els.body.dataset.detailId = detail ? detail.id : '';
  const emb = els.body.querySelector('.xp-yt-embed iframe');
  if (emb) emb.dataset.xpMount = String(++embedMountSeq);
  els.body.scrollTop = keepScroll ? top : listScroll.restore ? listScroll.top : 0;
  listScroll.restore = false;
  if (detail) {
    void loadCuesIntoDetail(detail);
    void fillMediaSrcs();
  }
}

async function fillMediaSrcs() {
  const token = ++mediaToken;
  const nodes = els.body?.querySelectorAll?.('[data-storage-path]') || [];
  for (const el of nodes) {
    if (token !== mediaToken) return;
    const path = el.getAttribute('data-storage-path') || '';
    if (!path) continue;
    try {
      const url = await deps.resolveMediaUrl?.(path);
      if (token !== mediaToken || !url) continue;
      if (el.tagName === 'VIDEO' || el.tagName === 'IMG') el.src = url;
    } catch {
      /* ignore */
    }
  }
}

const listScroll = { view: '', top: 0, restore: false };
let lastDetailSig = '';

/** free-exercise-db photo id used for cues JSON (library id may differ). */
function fedbIdOf(e) {
  if (!e) return '';
  if (typeof e.img === 'string' && e.img.trim()) return e.img.trim();
  const id = String(e.id || '');
  return id.startsWith('db-') ? id.slice(3) : id;
}

async function loadCuesIntoDetail(exercise) {
  const hostId = exercise?.id || '';
  const fedbId = fedbIdOf(exercise);
  const token = ++cuesToken;
  const host = els.body?.querySelector?.(`[data-xp-cues="${CSS.escape(hostId)}"]`);
  if (!host) return;
  if (!fedbId) {
    host.innerHTML = '';
    return;
  }
  try {
    const mod = await import(`./exercise-cues.js?v=354`);
    if (token !== cuesToken) return;
    const steps = await mod.loadExerciseInstructions(fedbId);
    if (token !== cuesToken) return;
    const cur = els.body?.querySelector?.(`[data-xp-cues="${CSS.escape(hostId)}"]`);
    if (!cur) return;
    if (!steps.length) {
      cur.innerHTML = '';
      return;
    }
    cur.innerHTML = `<h4 class="xp-cues-head">วิธีเล่น (English)</h4><ol class="xp-cues-list">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
  } catch {
    if (token !== cuesToken) return;
    const cur = els.body?.querySelector?.(`[data-xp-cues="${CSS.escape(hostId)}"]`);
    if (cur) cur.innerHTML = '';
  }
}

function openDetail(id) {
  listScroll.view = els.body?.dataset.view || '';
  listScroll.top = els.body?.scrollTop || 0;
  detailId = id;
  ytDraft = '';
  ytError = '';
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

function planToday(id) {
  const res = deps.onPlanToday?.(id);
  if (!res) return;
  if (res.full) {
    showToast('แผนวันนี้เต็มแล้ว (สูงสุด 30 ท่า)');
    return;
  }
  if (res.already) {
    showToast('อยู่ในแผนวันนี้แล้ว');
    return;
  }
  if (res.added) showToast(`ใส่ ${res.name || 'ท่า'} ในแผนวันนี้แล้ว`);
  paint();
}

function toggleFav(id) {
  const favs = loadFavs();
  const nextOn = !favs.has(id);
  deps.setFav?.(id, nextOn);
  if (groupId === FAV_GROUP && !nextOn && loadFavs().size === 0) groupId = null;
  paint();
}

function saveYtFromInput() {
  const input = els.body?.querySelector?.('[data-xp-yt-input]');
  const raw = String(input?.value || '').trim();
  ytDraft = raw;
  if (!raw) {
    ytError = '';
    deps.setMedia?.(detailId, null);
    paint();
    return;
  }
  const id = parseYoutubeVideoId(raw);
  if (!id) {
    ytError = 'ลิงก์ YouTube ไม่ถูกต้อง';
    paint();
    return;
  }
  const canonical = raw.includes('youtu.be/') || raw.includes('youtube.com/') || raw.includes('m.youtube.com/')
    ? raw
    : `https://youtu.be/${id}`;
  const res = deps.setMedia?.(detailId, canonical);
  if (res && res.ok === false) {
    ytError = res.error || 'บันทึกไม่ได้';
    paint();
    return;
  }
  ytDraft = '';
  ytError = '';
  paint();
}

function clearYt() {
  ytDraft = '';
  ytError = '';
  deps.setMedia?.(detailId, null);
  paint();
}

function saveLinkFromInput() {
  const input = els.body?.querySelector?.('[data-xp-link-input]');
  const raw = String(input?.value || '').trim();
  linkDraft = raw;
  if (!raw) {
    linkError = 'ใส่ลิงก์ก่อน';
    paint();
    return;
  }
  const res = deps.addMediaLink?.(detailId, raw);
  if (res && res.ok === false) {
    linkError = res.error || 'บันทึกไม่ได้';
    paint();
    return;
  }
  linkDraft = '';
  linkError = '';
  paint();
}

async function onMediaFilePicked(file) {
  if (!detailId || !file || mediaBusy) return;
  mediaBusy = true;
  mediaBusyText = 'กำลังอัปโหลด…';
  mediaError = '';
  paint();
  try {
    const res = await deps.uploadMediaFile?.(detailId, file, {
      onProgress: (pct) => {
        mediaBusyText = `กำลังอัปโหลด… ${pct}%`;
        const busy = els.body?.querySelector?.('.xp-media-busy');
        if (busy) busy.textContent = mediaBusyText;
      },
    });
    if (res && res.ok === false) {
      mediaError = res.error || 'อัปโหลดไม่สำเร็จ';
    }
  } catch (err) {
    console.warn('media upload failed', err);
    mediaError = 'อัปโหลดไม่สำเร็จ';
  } finally {
    mediaBusy = false;
    mediaBusyText = '';
    paint();
  }
}

async function onMediaDelete(itemId) {
  if (!detailId || !itemId || mediaBusy) return;
  mediaBusy = true;
  mediaBusyText = 'กำลังลบ…';
  mediaError = '';
  paint();
  try {
    const res = await deps.removeMediaItem?.(detailId, itemId);
    if (res && res.ok === false) {
      mediaError = res.error || 'ลบไม่ได้';
    }
  } catch (err) {
    console.warn('media delete failed', err);
    mediaError = 'ลบไม่ได้';
  } finally {
    mediaBusy = false;
    mediaBusyText = '';
    paint();
  }
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
  const plan = t?.closest?.('[data-xp-plan]');
  if (plan) {
    planToday(plan.dataset.xpPlan);
    return;
  }
  if (t?.closest?.('[data-xp-media-add]')) {
    els.body?.querySelector?.('[data-xp-media-file]')?.click();
    return;
  }
  const del = t?.closest?.('[data-xp-media-del]');
  if (del) {
    void onMediaDelete(del.dataset.xpMediaDel);
    return;
  }
  if (t?.closest?.('[data-xp-yt-save]')) {
    saveYtFromInput();
    return;
  }
  if (t?.closest?.('[data-xp-yt-clear]')) {
    clearYt();
    return;
  }
  if (t?.closest?.('[data-xp-link-save]')) {
    saveLinkFromInput();
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

function onBodyChange(e) {
  const input = e.target?.closest?.('[data-xp-media-file]');
  if (!input || input !== e.target) return;
  const file = input.files && input.files[0];
  input.value = '';
  if (file) void onMediaFilePicked(file);
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

function resetDetailDrafts() {
  ytDraft = '';
  ytError = '';
  linkDraft = '';
  linkError = '';
  mediaBusy = false;
  mediaBusyText = '';
  mediaError = '';
  mediaToken += 1;
  lastDetailSig = '';
}

function onBack() {
  if (detailId) {
    detailId = '';
    resetDetailDrafts();
    cuesToken += 1;
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
  cuesToken += 1;
  resetDetailDrafts();
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
  els.body?.addEventListener('change', onBodyChange);
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

/** Open straight to one move's photo + muscles (e.g. from a table row or plan chip). */
export function openExerciseDetail(nameOrId) {
  const key = String(nameOrId || '').trim();
  let e = exById.get(key) || null;
  if (!e) e = libraryExerciseByName(key);
  if (!els.overlay || !e?.id || !exById.has(e.id)) return false;
  groupId = null;
  query = '';
  if (els.search) els.search.value = '';
  detailId = e.id;
  detailOnly = true;
  resetDetailDrafts();
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
  resetDetailDrafts();
  if (els.search) els.search.value = '';
  hideToast();
  paintChips();
  paint();
  els.overlay.hidden = false;
}

/** Re-paint if the picker is open (e.g. after plan / fav sync). */
export function refreshExercisePicker() {
  if (!els.overlay || els.overlay.hidden) return;
  paint();
}

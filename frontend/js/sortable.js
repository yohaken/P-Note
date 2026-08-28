/**
 * Long-press drag reordering.
 * - Notes list: vertical reorder (manual/free sort)
 * - Home pin grid: 2-column card swap (แตะค้างลาก / แตะทีเดียว = tap)
 */
const LONG_PRESS_MS = 320;
const MOVE_CANCEL_PX = 10;

export function initListSortable(listEl, { onTap, onReorder, isEnabled }) {
  const enabled = () => (typeof isEnabled === 'function' ? isEnabled() : true);
  let card = null;
  let dragging = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let pressTimer = null;

  const clearTimer = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  const endDrag = () => {
    if (card) card.classList.remove('reordering');
    document.body.classList.remove('reordering-active');
    if (pointerId !== null) {
      try {
        listEl.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const beginDrag = () => {
    if (!card) return;
    dragging = true;
    card.classList.add('reordering');
    document.body.classList.add('reordering-active');
    try {
      listEl.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const reorderTo = (clientY) => {
    const others = Array.from(listEl.querySelectorAll('.note-card')).filter((c) => c !== card);
    let placedBefore = null;
    for (const c of others) {
      const rect = c.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        placedBefore = c;
        break;
      }
    }
    if (placedBefore) listEl.insertBefore(card, placedBefore);
    else listEl.appendChild(card);
  };

  const onDown = (event) => {
    if (!enabled()) return;
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest('.card-action')) return; // corner buttons
    card = event.target.closest('.note-card');
    if (!card) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    clearTimer();
    if (event.target.closest('.drag-hint')) {
      // Grabbing the grip starts the drag immediately (standard drag area).
      event.preventDefault();
      beginDrag();
    } else {
      // Anywhere else: long-press then drag.
      pressTimer = setTimeout(beginDrag, LONG_PRESS_MS);
    }
  };

  const onMove = (event) => {
    if (!card || event.pointerId !== pointerId) return;
    const dx = Math.abs(event.clientX - startX);
    const dy = Math.abs(event.clientY - startY);
    if (!dragging) {
      if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearTimer();
      return;
    }
    event.preventDefault();
    reorderTo(event.clientY);
  };

  const onUp = (event) => {
    if (!card || event.pointerId !== pointerId) return;
    clearTimer();
    const wasDragging = dragging;
    const tappedCard = card;
    endDrag();
    card = null;
    pointerId = null;
    dragging = false;

    if (wasDragging) {
      const ids = Array.from(listEl.querySelectorAll('.note-card')).map((c) => c.dataset.noteId);
      onReorder(ids);
    } else {
      const dx = Math.abs(event.clientX - startX);
      const dy = Math.abs(event.clientY - startY);
      if (
        event.target.closest?.(
          '.card-col-tags, .card-tag-name, .card-tag-inline, .card-hang-tag[data-tag-id], .card-action',
        )
      ) {
        /* tag filter / corner actions handle themselves */
      } else if (dx < MOVE_CANCEL_PX && dy < MOVE_CANCEL_PX && tappedCard?.dataset.noteId) {
        onTap(tappedCard.dataset.noteId);
      }
    }
  };

  listEl.addEventListener('pointerdown', onDown);
  listEl.addEventListener('pointermove', onMove, { passive: false });
  listEl.addEventListener('pointerup', onUp);
  listEl.addEventListener('pointercancel', () => {
    clearTimer();
    endDrag();
    card = null;
    pointerId = null;
    dragging = false;
  });
}

/**
 * Long-press drag reorder for a CSS grid of cards (e.g. home trend pins).
 * Short tap → onTap. Long-press + drag → swap DOM order → onReorder(ids).
 */
export function initGridSortable(containerEl, {
  gridSelector = '.cd-pin-grid',
  itemSelector = '[data-pin-id]',
  getItemId = (el) => el?.dataset?.pinId || '',
  onTap,
  onReorder,
  isEnabled,
  ignoreSelector = 'button, a, input, [data-cd-range-toggle], [data-cd-range], [data-calorie-action]',
} = {}) {
  if (!containerEl || containerEl.dataset.gridSortableBound === '1') return;
  containerEl.dataset.gridSortableBound = '1';

  const enabled = () => (typeof isEnabled === 'function' ? isEnabled() : true);
  let card = null;
  let grid = null;
  let dragging = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let pressTimer = null;

  const clearTimer = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  const endDrag = () => {
    if (card) card.classList.remove('reordering');
    document.body.classList.remove('reordering-active');
    if (pointerId !== null) {
      try {
        containerEl.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const beginDrag = () => {
    if (!card || !grid) return;
    dragging = true;
    card.classList.add('reordering');
    document.body.classList.add('reordering-active');
    try {
      containerEl.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
    if (navigator.vibrate) navigator.vibrate(12);
  };

  const reorderTo = (clientX, clientY) => {
    if (!grid || !card) return;
    const others = Array.from(grid.querySelectorAll(itemSelector)).filter((c) => c !== card);
    let placedBefore = null;
    for (const c of others) {
      const rect = c.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const midY = rect.top + rect.height / 2;
      // Row-major: above this card, or same row and to the left of center.
      if (clientY < midY - 2 || (clientY < rect.bottom && clientX < midX)) {
        placedBefore = c;
        break;
      }
    }
    if (placedBefore) grid.insertBefore(card, placedBefore);
    else grid.appendChild(card);
  };

  const onDown = (event) => {
    if (!enabled()) return;
    if (event.button !== undefined && event.button !== 0) return;
    if (ignoreSelector && event.target.closest?.(ignoreSelector)) return;
    grid = containerEl.querySelector(gridSelector);
    if (!grid) return;
    card = event.target.closest(itemSelector);
    if (!card || !grid.contains(card)) {
      card = null;
      return;
    }
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    clearTimer();
    pressTimer = setTimeout(beginDrag, LONG_PRESS_MS);
  };

  const onMove = (event) => {
    if (!card || event.pointerId !== pointerId) return;
    const dx = Math.abs(event.clientX - startX);
    const dy = Math.abs(event.clientY - startY);
    if (!dragging) {
      if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) clearTimer();
      return;
    }
    event.preventDefault();
    reorderTo(event.clientX, event.clientY);
  };

  const onUp = (event) => {
    if (!card || event.pointerId !== pointerId) return;
    clearTimer();
    const wasDragging = dragging;
    const tappedCard = card;
    const activeGrid = grid;
    endDrag();
    card = null;
    grid = null;
    pointerId = null;
    dragging = false;

    if (wasDragging && activeGrid) {
      const ids = Array.from(activeGrid.querySelectorAll(itemSelector))
        .map((c) => getItemId(c))
        .filter(Boolean);
      if (typeof onReorder === 'function') onReorder(ids);
      return;
    }

    const dx = Math.abs(event.clientX - startX);
    const dy = Math.abs(event.clientY - startY);
    const id = getItemId(tappedCard);
    if (dx < MOVE_CANCEL_PX && dy < MOVE_CANCEL_PX && id && typeof onTap === 'function') {
      onTap(id);
    }
  };

  containerEl.addEventListener('pointerdown', onDown);
  containerEl.addEventListener('pointermove', onMove, { passive: false });
  containerEl.addEventListener('pointerup', onUp);
  containerEl.addEventListener('pointercancel', () => {
    clearTimer();
    endDrag();
    card = null;
    grid = null;
    pointerId = null;
    dragging = false;
  });
}

/**
 * Long-press only — scroll passes through (pan-y on items). No short tap action.
 */
export function initLongPressTap(containerEl, {
  itemSelector = '[data-pin-id]',
  getItemId = (el) => el?.dataset?.pinId || '',
  onAction,
  isEnabled,
  ignoreSelector = 'button, a, input, textarea, select, [data-chs-range], [data-calorie-action]',
  longPressMs = LONG_PRESS_MS,
  moveCancelPx = MOVE_CANCEL_PX,
} = {}) {
  if (!containerEl || containerEl.dataset.longPressTapBound === '1') return;
  containerEl.dataset.longPressTapBound = '1';

  const enabled = () => (typeof isEnabled === 'function' ? isEnabled() : true);
  let card = null;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let pressTimer = null;
  let fired = false;

  const clearTimer = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  const onDown = (event) => {
    if (!enabled()) return;
    if (event.button !== undefined && event.button !== 0) return;
    if (ignoreSelector && event.target.closest?.(ignoreSelector)) return;
    card = event.target.closest(itemSelector);
    if (!card || !containerEl.contains(card)) {
      card = null;
      return;
    }
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    fired = false;
    clearTimer();
    pressTimer = setTimeout(() => {
      fired = true;
      const id = getItemId(card);
      if (id && typeof onAction === 'function') onAction(id, card);
      if (navigator.vibrate) navigator.vibrate(12);
    }, longPressMs);
  };

  const onMove = (event) => {
    if (!card || event.pointerId !== pointerId || fired) return;
    const dx = Math.abs(event.clientX - startX);
    const dy = Math.abs(event.clientY - startY);
    if (dx > moveCancelPx || dy > moveCancelPx) {
      clearTimer();
      card = null;
      pointerId = null;
    }
  };

  const onUp = (event) => {
    if (!card || event.pointerId !== pointerId) return;
    clearTimer();
    card = null;
    pointerId = null;
    fired = false;
  };

  containerEl.addEventListener('pointerdown', onDown);
  containerEl.addEventListener('pointermove', onMove, { passive: true });
  containerEl.addEventListener('pointerup', onUp);
  containerEl.addEventListener('pointercancel', () => {
    clearTimer();
    card = null;
    pointerId = null;
    fired = false;
  });
}

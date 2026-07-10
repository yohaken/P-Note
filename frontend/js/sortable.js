/**
 * Long-press drag reordering for the notes list (manual/free sort mode).
 * Base gesture = long-press then drag up/down. A short tap opens the note.
 * Done/trash actions live in small corner buttons (handled by the caller),
 * so they never clash with the drag gesture.
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
  };

  const beginDrag = () => {
    if (!card) return;
    dragging = true;
    card.classList.add('reordering');
    document.body.classList.add('reordering-active');
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
      if (dx < MOVE_CANCEL_PX && dy < MOVE_CANCEL_PX && tappedCard?.dataset.noteId) {
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

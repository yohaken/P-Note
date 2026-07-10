/** Compact long-press popup menu for note cards. */

const LONG_PRESS_MS = 480;
const MOVE_TOLERANCE_PX = 12;

export function attachNoteCardInteractions(card, handlers) {
  let timer = null;
  let startX = 0;
  let startY = 0;
  let longPressTriggered = false;
  let suppressClick = false;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const openMenu = (clientX, clientY) => {
    longPressTriggered = true;
    suppressClick = true;
    handlers.onLongPress({ clientX, clientY, noteId: handlers.noteId });
  };

  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    longPressTriggered = false;
    startX = event.clientX;
    startY = event.clientY;
    clearTimer();
    timer = setTimeout(() => openMenu(event.clientX, event.clientY), LONG_PRESS_MS);
  };

  const onPointerMove = (event) => {
    if (!timer) return;
    const dx = Math.abs(event.clientX - startX);
    const dy = Math.abs(event.clientY - startY);
    if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) {
      clearTimer();
    }
  };

  const onPointerUp = () => {
    clearTimer();
  };

  const onClick = (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
      return;
    }
    handlers.onTap();
  };

  card.addEventListener('pointerdown', onPointerDown);
  card.addEventListener('pointermove', onPointerMove);
  card.addEventListener('pointerup', onPointerUp);
  card.addEventListener('pointercancel', onPointerUp);
  card.addEventListener('pointerleave', onPointerUp);
  card.addEventListener('click', onClick);

  return () => {
    clearTimer();
    card.removeEventListener('pointerdown', onPointerDown);
    card.removeEventListener('pointermove', onPointerMove);
    card.removeEventListener('pointerup', onPointerUp);
    card.removeEventListener('pointercancel', onPointerUp);
    card.removeEventListener('pointerleave', onPointerUp);
    card.removeEventListener('click', onClick);
  };
}

/**
 * Show menu centered via CSS flex on the overlay.
 * Do NOT set left/top/transform here — that fights flex centering and shifts the menu.
 */
export function positionContextMenu(menuEl) {
  if (!menuEl) return;
  menuEl.hidden = false;
  menuEl.style.left = '';
  menuEl.style.top = '';
  menuEl.style.right = '';
  menuEl.style.bottom = '';
  menuEl.style.transform = '';
  menuEl.style.position = '';
}

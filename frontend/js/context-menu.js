/**
 * Compact long-press popup menu for note cards.
 *
 * iOS-safe pattern: arm on hold → open on release.
 * Opening under a still-down finger makes Safari select the menu labels
 * and show the system text UI on top of our popup.
 */

const LONG_PRESS_MS = 480;
const MOVE_TOLERANCE_PX = 12;

/** Clear any active text selection / callout residue (esp. iOS Safari). */
export function clearUiTextSelection() {
  try {
    const sel = window.getSelection?.();
    if (sel && sel.rangeCount) sel.removeAllRanges();
  } catch {
    /* ignore */
  }
  const active = document.activeElement;
  if (
    active &&
    active !== document.body &&
    typeof active.blur === 'function' &&
    !active.matches?.('input, textarea, select, [contenteditable="true"]')
  ) {
    try {
      active.blur();
    } catch {
      /* ignore */
    }
  }
}

export function attachNoteCardInteractions(card, handlers) {
  let timer = null;
  let startX = 0;
  let startY = 0;
  let armed = false;
  let cancelled = false;
  let suppressClick = false;
  let pointerId = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const resetGesture = () => {
    clearTimer();
    armed = false;
    cancelled = false;
    pointerId = null;
    card.classList.remove('is-longpress-armed');
  };

  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    resetGesture();
    startX = event.clientX;
    startY = event.clientY;
    pointerId = event.pointerId;
    timer = setTimeout(() => {
      if (cancelled) return;
      armed = true;
      card.classList.add('is-longpress-armed');
      try {
        if (navigator.vibrate) navigator.vibrate(10);
      } catch {
        /* ignore */
      }
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (event) => {
    if (pointerId != null && event.pointerId !== pointerId) return;
    if (!timer && !armed) return;
    const dx = Math.abs(event.clientX - startX);
    const dy = Math.abs(event.clientY - startY);
    if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) {
      cancelled = true;
      clearTimer();
      armed = false;
      card.classList.remove('is-longpress-armed');
    }
  };

  const onPointerUp = (event) => {
    if (pointerId != null && event.pointerId != null && event.pointerId !== pointerId) return;
    const shouldOpen = armed && !cancelled;
    clearTimer();
    card.classList.remove('is-longpress-armed');
    pointerId = null;
    armed = false;
    if (shouldOpen) {
      suppressClick = true;
      clearUiTextSelection();
      handlers.onLongPress({
        clientX: event.clientX ?? startX,
        clientY: event.clientY ?? startY,
        noteId: handlers.noteId,
      });
      // Second clear after paint — iOS sometimes re-selects as the menu mounts.
      requestAnimationFrame(() => {
        clearUiTextSelection();
        setTimeout(clearUiTextSelection, 40);
      });
    }
    cancelled = false;
  };

  const onClick = (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
      return;
    }
    // Left tag column has its own filter action.
    if (event.target.closest?.('.card-col-tags, .card-tag-name')) return;
    handlers.onTap();
  };

  const onContextMenu = (event) => {
    event.preventDefault();
  };

  card.addEventListener('pointerdown', onPointerDown);
  card.addEventListener('pointermove', onPointerMove);
  card.addEventListener('pointerup', onPointerUp);
  card.addEventListener('pointercancel', resetGesture);
  card.addEventListener('click', onClick);
  card.addEventListener('contextmenu', onContextMenu);

  return () => {
    resetGesture();
    card.removeEventListener('pointerdown', onPointerDown);
    card.removeEventListener('pointermove', onPointerMove);
    card.removeEventListener('pointerup', onPointerUp);
    card.removeEventListener('pointercancel', resetGesture);
    card.removeEventListener('click', onClick);
    card.removeEventListener('contextmenu', onContextMenu);
  };
}

/**
 * Show menu centered via CSS flex on the overlay.
 * Do NOT set left/top/transform here — that fights flex centering and shifts the menu.
 */
export function positionContextMenu(menuEl) {
  if (!menuEl) return;
  clearUiTextSelection();
  menuEl.hidden = false;
  menuEl.style.left = '';
  menuEl.style.top = '';
  menuEl.style.right = '';
  menuEl.style.bottom = '';
  menuEl.style.transform = '';
  menuEl.style.position = '';
  requestAnimationFrame(clearUiTextSelection);
}

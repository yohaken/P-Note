/**
 * Viewport helpers — calorie-tracker shell does not lock to visualViewport.
 * Kept as a thin resize hook for layout listeners only.
 */
export function syncViewportHeight() {
  /* no-op: body uses min-height/height 100dvh + padding-bottom safe-area */
}

export function initViewportLock(onChange) {
  const run = () => onChange?.();
  run();
  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', run);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', run);
  }
}

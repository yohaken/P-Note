/**
 * Viewport helpers. Shell uses full inset:0 now; bottom nav is position:fixed
 * to the real screen edge so we no longer shrink #app to visualViewport height
 * (that left a black band under the nav on iPhone).
 */
export function syncViewportHeight() {
  /* kept as no-op hook for resize listeners */
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

/**
 * Viewport helpers — calorie-tracker document shell (no visualViewport lock).
 */
export function syncViewportHeight() {}

export function initViewportLock(onChange) {
  const run = () => onChange?.();
  run();
  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', run);
}

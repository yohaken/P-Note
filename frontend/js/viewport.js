/**
 * Lock the app shell to the *visible* viewport.
 * On iPhone Safari/PWA, 100vh/100% can leave a black band below the UI;
 * visualViewport.height matches what the user actually sees.
 */
export function syncViewportHeight() {
  const vv = window.visualViewport;
  const height = Math.round(vv?.height ?? window.innerHeight);
  const top = Math.round(vv?.offsetTop ?? 0);
  const root = document.documentElement;
  root.style.setProperty('--app-height', `${height}px`);
  root.style.setProperty('--app-top', `${top}px`);
}

export function initViewportLock(onChange) {
  const run = () => {
    syncViewportHeight();
    onChange?.();
  };
  run();
  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', run);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', run);
    window.visualViewport.addEventListener('scroll', run);
  }
}

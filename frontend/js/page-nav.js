/**
 * Shared page navigation: swipe sideways + helpers.
 * Order: Calorie (home) → Note (more pages later).
 * Swipe right → next · Swipe left → previous.
 */
(function (global) {
  var PAGES = [
    { id: 'calorie', url: './index.html', label: 'Calorie', sub: 'แคลอรี่' },
    { id: 'note', url: './note.html', label: 'Note', sub: 'โน้ต' },
  ];

  var EDGE_IGNORE_MS = 450;
  var MIN_DX = 72;
  var MAX_DURATION_MS = 700;

  function findIndex(id) {
    for (var i = 0; i < PAGES.length; i++) {
      if (PAGES[i].id === id) return i;
    }
    return -1;
  }

  function goTo(id) {
    var page = null;
    for (var i = 0; i < PAGES.length; i++) {
      if (PAGES[i].id === id) {
        page = PAGES[i];
        break;
      }
    }
    if (!page) return;
    if (location.pathname.split('/').pop() === page.url.replace('./', '')) return;
    location.href = page.url;
  }

  function goNext(currentId) {
    var idx = findIndex(currentId);
    if (idx < 0 || idx >= PAGES.length - 1) return false;
    goTo(PAGES[idx + 1].id);
    return true;
  }

  function goPrev(currentId) {
    var idx = findIndex(currentId);
    if (idx <= 0) return false;
    goTo(PAGES[idx - 1].id);
    return true;
  }

  function isIgnoredTarget(el) {
    if (!el || !el.closest) return true;
    return !!el.closest(
      'input, textarea, select, [contenteditable="true"], .drag-handle, .fab-pages, .fab-action, .fab-stack, .pages-menu-overlay, .edit-overlay, .settings-overlay, .modal, .drawer, .confirm-pop-overlay, .topbar, .topbar-actions, .btn-mini, #manage-tags-btn, #settings-btn'
    );
  }

  /**
   * @param {{ current: string, canNavigate?: () => boolean }} opts
   */
  function initSwipe(opts) {
    var current = opts && opts.current;
    if (!current) return;
    var canNavigate = typeof opts.canNavigate === 'function' ? opts.canNavigate : function () { return true; };

    var startX = 0;
    var startY = 0;
    var startAt = 0;
    var tracking = false;

    document.addEventListener(
      'touchstart',
      function (event) {
        if (event.touches.length !== 1) {
          tracking = false;
          return;
        }
        if (!canNavigate() || isIgnoredTarget(event.target)) {
          tracking = false;
          return;
        }
        var t = event.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        startAt = Date.now();
        tracking = true;
      },
      { passive: true }
    );

    document.addEventListener(
      'touchend',
      function (event) {
        if (!tracking) return;
        tracking = false;
        if (!canNavigate()) return;
        var t = event.changedTouches[0];
        var dx = t.clientX - startX;
        var dy = Math.abs(t.clientY - startY);
        var dt = Date.now() - startAt;
        if (dt > MAX_DURATION_MS) return;
        if (Math.abs(dx) < MIN_DX) return;
        if (Math.abs(dx) < dy * 1.25) return;

        if (dx > 0) goNext(current);
        else goPrev(current);
      },
      { passive: true }
    );
  }

  global.PageNav = {
    PAGES: PAGES,
    goTo: goTo,
    goNext: goNext,
    goPrev: goPrev,
    initSwipe: initSwipe,
  };
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Shared page navigation: FAB switcher only (no swipe between pages).
 * Order: Note (home) → Calorie (more pages later).
 * FAB: short tap → cycle next · long-press → page list.
 */
(function (global) {
  var PAGES = [
    { id: 'note', url: './note.html', label: 'Note', sub: 'โน้ต', icon: '📝' },
    { id: 'calorie', url: './index.html', label: 'Calorie', sub: 'แคลอรี่', icon: '🔥' },
  ];

  var MIN_DX = 72;
  var MAX_DURATION_MS = 700;
  var FAB_LONG_MS = 420;

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
    var file = location.pathname.split('/').pop() || '';
    if (file === page.url.replace('./', '')) return;
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

  /** Cycle to next page (wraps when more than one page). */
  function goCycle(currentId) {
    if (PAGES.length < 2) return false;
    var idx = findIndex(currentId);
    if (idx < 0) return false;
    goTo(PAGES[(idx + 1) % PAGES.length].id);
    return true;
  }

  function isIgnoredTarget(el) {
    if (!el || !el.closest) return true;
    return !!el.closest(
      'input, textarea, select, [contenteditable="true"], .drag-handle, .fab-pages, .fab-action, .fab-stack, .filter-dock, .filter-dd-menu, .filter-dd-backdrop, .pages-menu-overlay, .edit-overlay, .settings-overlay, .modal, .drawer, .confirm-pop-overlay, .note-center-overlay, .topbar, .topbar-actions, .btn-mini, #manage-tags-btn, #settings-btn'
    );
  }

  /**
   * Page swipe disabled — kept as no-op so older callers do not break.
   */
  function initSwipe() {
    /* intentionally empty */
  }

  function fillPagesMenu(overlay, currentId) {
    if (!overlay) return;
    var menu = overlay.querySelector('.pages-menu');
    if (!menu) return;
    var titleText = 'แผ่นงาน';
    var oldTitle = menu.querySelector('.pages-menu-title');
    if (oldTitle) titleText = oldTitle.textContent || titleText;
    menu.innerHTML = '';
    var title = document.createElement('p');
    title.className = 'pages-menu-title';
    title.textContent = titleText;
    menu.appendChild(title);
    PAGES.forEach(function (page) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pages-menu-item';
      btn.dataset.page = page.id;
      btn.setAttribute('role', 'menuitem');
      if (page.id === currentId) btn.setAttribute('aria-current', 'page');
      btn.innerHTML =
        '<span class="pm-icon" aria-hidden="true">' +
        (page.icon || '•') +
        '</span><span>' +
        page.label +
        '</span><span class="pm-sub">' +
        (page.id === currentId ? 'หน้านี้' : page.sub || '') +
        '</span>';
      menu.appendChild(btn);
    });
  }

  /**
   * Short tap → cycle next page. Long-press → show page list.
   * @param {{ fab: HTMLElement, overlay: HTMLElement, current: string }} opts
   */
  function bindFab(opts) {
    var fab = opts && opts.fab;
    var overlay = opts && opts.overlay;
    var current = opts && opts.current;
    if (!fab || !current) return;

    var timer = null;
    var longPress = false;
    var startX = 0;
    var startY = 0;

    function openMenu() {
      fillPagesMenu(overlay, current);
      if (overlay) overlay.hidden = false;
    }

    function closeMenu() {
      if (overlay) overlay.hidden = true;
    }

    function stackGesture() {
      var stack = fab.closest('.fab-stack');
      return (stack && stack.dataset.fabGesture) || '';
    }

    fab.setAttribute('title', 'แตะ = ถัดไป · ค้าง = เลือกแผ่นงาน');
    fab.setAttribute('aria-label', 'สลับแผ่นงาน');

    fab.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      longPress = false;
      startX = e.clientX;
      startY = e.clientY;
      clearTimeout(timer);
      timer = setTimeout(function () {
        longPress = true;
      }, FAB_LONG_MS);
    });

    function clearPress() {
      clearTimeout(timer);
      timer = null;
    }

    fab.addEventListener('pointerup', function (e) {
      clearPress();
      var gest = stackGesture();
      if (gest === 'drag') {
        longPress = false;
        return;
      }
      // Long-press without drag → page list (fab-drag may set gest=long/armed)
      if (longPress || gest === 'long' || gest === 'armed') {
        longPress = false;
        openMenu();
        return;
      }
      if (Math.abs(e.clientX - startX) > 14 || Math.abs(e.clientY - startY) > 14) return;
      goCycle(current);
    });

    fab.addEventListener('pointercancel', function () {
      clearPress();
      longPress = false;
    });

    fab.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse') clearPress();
    });

    fab.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });

    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          closeMenu();
          return;
        }
        var item = e.target.closest('.pages-menu-item');
        if (!item) return;
        closeMenu();
        if (item.dataset.page && item.dataset.page !== current) goTo(item.dataset.page);
      });
    }

    return { openMenu: openMenu, closeMenu: closeMenu };
  }

  global.PageNav = {
    PAGES: PAGES,
    goTo: goTo,
    goNext: goNext,
    goPrev: goPrev,
    goCycle: goCycle,
    initSwipe: initSwipe,
    bindFab: bindFab,
  };
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Long-press + drag to reposition .fab-stack; persist left/top + direction in localStorage.
 * Shared across Note + Calorie pages.
 */
(function (global) {
  var KEY = 'pnote_fab_pos';
  var DIR_KEY = 'pnote_fab_dir';
  var LONG_MS = 420;
  var MOVE_PX = 10;
  var PAD = 8;
  var DIR_VERTICAL = 'vertical';
  var DIR_HORIZONTAL = 'horizontal';

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (typeof p.left === 'number' && typeof p.top === 'number') return p;
    } catch (e) {}
    return null;
  }

  function save(left, top) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ left: left, top: top }));
    } catch (e) {}
  }

  function getDirection() {
    try {
      var d = localStorage.getItem(DIR_KEY);
      if (d === DIR_HORIZONTAL) return DIR_HORIZONTAL;
    } catch (e) {}
    return DIR_VERTICAL;
  }

  function saveDirection(dir) {
    try {
      localStorage.setItem(DIR_KEY, dir === DIR_HORIZONTAL ? DIR_HORIZONTAL : DIR_VERTICAL);
    } catch (e) {}
  }

  function clamp(stack, left, top) {
    var r = stack.getBoundingClientRect();
    var w = r.width || 48;
    var h = r.height || 48;
    var maxL = Math.max(PAD, window.innerWidth - w - PAD);
    var maxT = Math.max(PAD, window.innerHeight - h - PAD);
    return {
      left: Math.min(maxL, Math.max(PAD, left)),
      top: Math.min(maxT, Math.max(PAD, top)),
    };
  }

  function apply(stack, left, top) {
    var c = clamp(stack, left, top);
    stack.style.left = c.left + 'px';
    stack.style.top = c.top + 'px';
    stack.style.right = 'auto';
    stack.style.bottom = 'auto';
    return c;
  }

  function reclampSaved(stack) {
    var pos = load();
    if (!pos) return;
    requestAnimationFrame(function () {
      apply(stack, pos.left, pos.top);
    });
  }

  function applyDirection(stack, dir) {
    if (!stack) return getDirection();
    var d = dir === DIR_HORIZONTAL ? DIR_HORIZONTAL : DIR_VERTICAL;
    stack.classList.toggle('fab-dir-horizontal', d === DIR_HORIZONTAL);
    stack.classList.toggle('fab-dir-vertical', d === DIR_VERTICAL);
    stack.dataset.fabDir = d;
    return d;
  }

  function setDirection(dir, stack) {
    var d = dir === DIR_HORIZONTAL ? DIR_HORIZONTAL : DIR_VERTICAL;
    saveDirection(d);
    var el = stack || document.getElementById('fabStack');
    if (el) {
      applyDirection(el, d);
      reclampSaved(el);
    }
    try {
      window.dispatchEvent(new CustomEvent('pnote-fab-dir', { detail: { dir: d } }));
    } catch (e) {}
    return d;
  }

  function setGesture(stack, v) {
    if (v) stack.dataset.fabGesture = v;
    else delete stack.dataset.fabGesture;
  }

  function init(stack) {
    if (!stack || stack.dataset.fabDragInit === '1') return;
    stack.dataset.fabDragInit = '1';

    applyDirection(stack, getDirection());

    var saved = load();
    if (saved) {
      requestAnimationFrame(function () {
        apply(stack, saved.left, saved.top);
      });
    }

    var timer = null;
    var armed = false;
    var dragging = false;
    var startX = 0;
    var startY = 0;
    var originLeft = 0;
    var originTop = 0;
    var pointerId = null;

    function clearTimer() {
      clearTimeout(timer);
      timer = null;
    }

    function suppressClick() {
      stack.dataset.fabSuppressClick = '1';
      setTimeout(function () {
        delete stack.dataset.fabSuppressClick;
      }, 80);
    }

    stack.addEventListener(
      'pointerdown',
      function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (!e.target.closest('.fab-pages, .fab-action')) return;

        armed = false;
        dragging = false;
        startX = e.clientX;
        startY = e.clientY;
        pointerId = e.pointerId;
        setGesture(stack, '');
        clearTimer();
        timer = setTimeout(function () {
          armed = true;
          setGesture(stack, 'armed');
          stack.classList.add('is-fab-armed');
          try {
            if (navigator.vibrate) navigator.vibrate(12);
          } catch (err) {}
        }, LONG_MS);
      },
      true
    );

    stack.addEventListener(
      'pointermove',
      function (e) {
        if (pointerId == null || e.pointerId !== pointerId) return;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        var dist = Math.hypot(dx, dy);

        if (!armed && !dragging) {
          if (dist > MOVE_PX) clearTimer();
          return;
        }

        if (armed && !dragging) {
          if (dist <= MOVE_PX) return;
          dragging = true;
          setGesture(stack, 'drag');
          stack.classList.add('is-fab-dragging');
          stack.classList.remove('is-fab-armed');
          var rect = stack.getBoundingClientRect();
          originLeft = rect.left;
          originTop = rect.top;
          try {
            stack.setPointerCapture(e.pointerId);
          } catch (err) {}
        }

        if (dragging) {
          e.preventDefault();
          apply(stack, originLeft + dx, originTop + dy);
        }
      },
      true
    );

    function end(e) {
      if (pointerId == null) return;
      if (e && e.pointerId != null && e.pointerId !== pointerId) return;

      clearTimer();
      stack.classList.remove('is-fab-armed', 'is-fab-dragging');

      var gest = '';
      if (dragging) {
        gest = 'drag';
        var rect = stack.getBoundingClientRect();
        var c = apply(stack, rect.left, rect.top);
        save(c.left, c.top);
        suppressClick();
      } else if (armed) {
        gest = 'long';
        suppressClick();
      }

      setGesture(stack, gest);
      setTimeout(function () {
        setGesture(stack, '');
      }, 60);

      armed = false;
      dragging = false;
      pointerId = null;
    }

    stack.addEventListener('pointerup', end, true);
    stack.addEventListener('pointercancel', end, true);

    stack.addEventListener(
      'click',
      function (e) {
        if (stack.dataset.fabSuppressClick) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );

    stack.addEventListener('contextmenu', function (e) {
      if (e.target.closest('.fab-pages, .fab-action')) e.preventDefault();
    });

    window.addEventListener('resize', function () {
      var pos = load();
      if (!pos) return;
      apply(stack, pos.left, pos.top);
    });

    window.addEventListener('storage', function (e) {
      if (e.key === DIR_KEY) {
        applyDirection(stack, getDirection());
        reclampSaved(stack);
      } else if (e.key === KEY && e.newValue) {
        try {
          var p = JSON.parse(e.newValue);
          if (typeof p.left === 'number' && typeof p.top === 'number') {
            apply(stack, p.left, p.top);
          }
        } catch (err) {}
      }
    });
  }

  function autoInit() {
    var stack = document.getElementById('fabStack');
    if (stack) init(stack);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  global.FabDrag = {
    init: init,
    KEY: KEY,
    DIR_KEY: DIR_KEY,
    getDirection: getDirection,
    setDirection: setDirection,
    applyDirection: applyDirection,
  };
})(typeof window !== 'undefined' ? window : globalThis);

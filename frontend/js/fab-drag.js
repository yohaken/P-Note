/**
 * Long-press + drag to reposition .fab-stack; persist left/top in localStorage.
 * Shared across Note + Calorie pages.
 */
(function (global) {
  var KEY = 'pnote_fab_pos';
  var LONG_MS = 420;
  var MOVE_PX = 10;
  var PAD = 8;

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

  function setGesture(stack, v) {
    if (v) stack.dataset.fabGesture = v;
    else delete stack.dataset.fabGesture;
  }

  function init(stack) {
    if (!stack || stack.dataset.fabDragInit === '1') return;
    stack.dataset.fabDragInit = '1';

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

  global.FabDrag = { init: init, KEY: KEY };
})(typeof window !== 'undefined' ? window : globalThis);

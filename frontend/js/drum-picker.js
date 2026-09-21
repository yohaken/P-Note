/**
 * Vertical drum / reel picker — tap-drag with momentum + snap.
 * Fast flicks get velocity boost so wide ranges stay usable.
 */

const ITEM_H = 40;

/**
 * @param {HTMLElement} root
 * @param {{
 *   min: number,
 *   max: number,
 *   step: number,
 *   value?: number,
 *   unit?: string,
 *   ariaLabel?: string,
 *   flickGain?: number,
 *   onChange?: (value: number) => void,
 * }} opts
 */
export function mountDrumPicker(root, opts) {
  const min = Number(opts.min);
  const max = Number(opts.max);
  const step = Number(opts.step) || 1;
  const unit = String(opts.unit || '');
  const flickGain = Number(opts.flickGain) > 0 ? Number(opts.flickGain) : 1.6;
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : null;

  const values = [];
  for (let v = min; v <= max; v += step) values.push(v);
  if (!values.length) values.push(min);

  let index = nearestIndex(opts.value ?? values[0]);
  let offset = -index * ITEM_H; // list translateY
  let dragging = false;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0; // px/ms
  let raf = 0;
  let pointerId = null;

  root.classList.add('drum-picker');
  root.innerHTML = `
    <div class="drum-window" tabindex="0" role="listbox" aria-label="${escapeAttr(opts.ariaLabel || 'ตัวเลือก')}">
      <div class="drum-fade drum-fade-top" aria-hidden="true"></div>
      <div class="drum-highlight" aria-hidden="true"></div>
      <div class="drum-fade drum-fade-bot" aria-hidden="true"></div>
      <ul class="drum-list">
        ${values.map((v, i) =>
          `<li class="drum-item" data-i="${i}" data-v="${v}" role="option">${v}${unit ? `<span class="drum-unit">${escapeHtml(unit)}</span>` : ''}</li>`).join('')}
      </ul>
    </div>
  `;

  const win = root.querySelector('.drum-window');
  const list = root.querySelector('.drum-list');

  function nearestIndex(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    let best = 0;
    let bestDist = Infinity;
    values.forEach((v, i) => {
      const d = Math.abs(v - n);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  function clampOffset(y) {
    const minO = -(values.length - 1) * ITEM_H;
    return Math.max(minO, Math.min(0, y));
  }

  function indexFromOffset(y) {
    const i = Math.round(-y / ITEM_H);
    return Math.max(0, Math.min(values.length - 1, i));
  }

  function paint(selectedOnly = false) {
    list.style.transform = `translate3d(0, ${offset}px, 0)`;
    if (selectedOnly) return;
    const i = indexFromOffset(offset);
    list.querySelectorAll('.drum-item').forEach((el, j) => {
      el.classList.toggle('is-selected', j === i);
      const dist = Math.abs(j - i);
      el.style.opacity = dist === 0 ? '1' : dist === 1 ? '0.45' : dist === 2 ? '0.22' : '0.1';
    });
  }

  function emit() {
    const i = indexFromOffset(offset);
    index = i;
    if (onChange) onChange(values[i]);
  }

  function snapTo(i, animate = true) {
    const target = -i * ITEM_H;
    cancelAnimationFrame(raf);
    if (!animate) {
      offset = target;
      index = i;
      paint();
      emit();
      return;
    }
    const start = offset;
    const dist = target - start;
    if (Math.abs(dist) < 0.5) {
      offset = target;
      paint();
      emit();
      return;
    }
    const t0 = performance.now();
    const dur = Math.min(280, 120 + Math.abs(dist) * 0.35);
    const stepAnim = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const ease = 1 - (1 - t) ** 3;
      offset = start + dist * ease;
      paint();
      if (t < 1) raf = requestAnimationFrame(stepAnim);
      else {
        offset = target;
        index = i;
        paint();
        emit();
      }
    };
    raf = requestAnimationFrame(stepAnim);
  }

  function coast() {
    cancelAnimationFrame(raf);
    let v = velocity;
    // Fast flick → amplify so 1–1000 / 1–500 stay reachable quickly.
    if (Math.abs(v) > 0.55) v *= flickGain;
    if (Math.abs(v) > 1.1) v *= 1.25;
    const t0 = performance.now();
    let prev = t0;
    const tick = (now) => {
      const dt = Math.min(32, now - prev);
      prev = now;
      offset = clampOffset(offset + v * dt);
      // friction
      v *= Math.pow(0.965, dt / 16);
      paint();
      if (Math.abs(v) < 0.04 || now - t0 > 1400) {
        snapTo(indexFromOffset(offset), true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function onDown(e) {
    if (e.button != null && e.button !== 0) return;
    cancelAnimationFrame(raf);
    dragging = true;
    pointerId = e.pointerId;
    lastY = e.clientY;
    lastT = performance.now();
    velocity = 0;
    try { win.setPointerCapture(pointerId); } catch { /* ignore */ }
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging || (pointerId != null && e.pointerId !== pointerId)) return;
    const y = e.clientY;
    const now = performance.now();
    const dy = y - lastY;
    const dt = Math.max(1, now - lastT);
    offset = clampOffset(offset + dy);
    velocity = dy / dt;
    lastY = y;
    lastT = now;
    paint();
    e.preventDefault();
  }

  function onUp(e) {
    if (!dragging || (pointerId != null && e.pointerId !== pointerId)) return;
    dragging = false;
    pointerId = null;
    coast();
  }

  function onWheel(e) {
    e.preventDefault();
    cancelAnimationFrame(raf);
    const dir = e.deltaY > 0 ? 1 : -1;
    const boost = Math.abs(e.deltaY) > 40 ? 3 : 1;
    const next = Math.max(0, Math.min(values.length - 1, indexFromOffset(offset) + dir * boost));
    snapTo(next, true);
  }

  win.addEventListener('pointerdown', onDown);
  win.addEventListener('pointermove', onMove);
  win.addEventListener('pointerup', onUp);
  win.addEventListener('pointercancel', onUp);
  win.addEventListener('wheel', onWheel, { passive: false });

  // Center padding via CSS; initial paint
  offset = -index * ITEM_H;
  paint();
  emit();

  return {
    getValue() {
      return values[indexFromOffset(offset)];
    },
    setValue(v, { animate = false } = {}) {
      snapTo(nearestIndex(v), animate);
    },
    destroy() {
      cancelAnimationFrame(raf);
      win.removeEventListener('pointerdown', onDown);
      win.removeEventListener('pointermove', onMove);
      win.removeEventListener('pointerup', onUp);
      win.removeEventListener('pointercancel', onUp);
      win.removeEventListener('wheel', onWheel);
      root.innerHTML = '';
      root.classList.remove('drum-picker');
    },
  };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

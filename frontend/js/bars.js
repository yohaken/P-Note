/**
 * Draggable layout bars (sort / tag / priority filter).
 * Each bar lives in either the top zone (under the header) or the bottom dock.
 * The user drags the ⠿ grip up/down to move a whole bar between zones; the
 * chosen layout is persisted so it survives app updates.
 */

const BAR_IDS = ['sort', 'tag', 'priority', 'recurrence'];

export const DEFAULT_BAR_LAYOUT = [
  { bar: 'sort', zone: 'top' },
  { bar: 'priority', zone: 'bottom' },
  { bar: 'recurrence', zone: 'bottom' },
  { bar: 'tag', zone: 'bottom' },
];

export function normalizeLayout(layout) {
  const valid = Array.isArray(layout)
    ? layout.filter(
        (x) => x && BAR_IDS.includes(x.bar) && (x.zone === 'top' || x.zone === 'bottom'),
      )
    : [];
  const out = [];
  const seen = new Set();
  valid.forEach((x) => {
    if (!seen.has(x.bar)) {
      seen.add(x.bar);
      out.push({ bar: x.bar, zone: x.zone });
    }
  });
  DEFAULT_BAR_LAYOUT.forEach((d) => {
    if (!seen.has(d.bar)) {
      seen.add(d.bar);
      out.push({ ...d });
    }
  });
  return out;
}

function wrapperFor(bar) {
  return document.querySelector(`.movable-bar[data-bar="${bar}"]`);
}

export function applyBarLayout(layout, topZone, bottomZone) {
  normalizeLayout(layout).forEach(({ bar, zone }) => {
    const el = wrapperFor(bar);
    if (!el) return;
    (zone === 'top' ? topZone : bottomZone).appendChild(el);
  });
}

function layoutFromDom(topZone, bottomZone) {
  const read = (zone, zoneName) =>
    Array.from(zone.querySelectorAll('.movable-bar')).map((el) => ({
      bar: el.dataset.bar,
      zone: zoneName,
    }));
  return [...read(topZone, 'top'), ...read(bottomZone, 'bottom')];
}

export function initBarDrag({ topZone, bottomZone, onChange }) {
  let dragEl = null;
  let startY = 0;
  let pointerId = null;

  const cleanup = () => {
    if (dragEl) {
      dragEl.classList.remove('dragging');
      dragEl.style.transform = '';
    }
    document.body.classList.remove('bars-dragging');
    topZone.classList.remove('drop-target');
    bottomZone.classList.remove('drop-target');
    dragEl = null;
    pointerId = null;
  };

  const targetZoneFor = (clientY) =>
    clientY < window.innerHeight / 2 ? topZone : bottomZone;

  const insertByY = (zone, clientY) => {
    const siblings = Array.from(zone.querySelectorAll('.movable-bar')).filter(
      (el) => el !== dragEl,
    );
    for (const sib of siblings) {
      const rect = sib.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        zone.insertBefore(dragEl, sib);
        return;
      }
    }
    zone.appendChild(dragEl);
  };

  const onMove = (event) => {
    if (!dragEl || event.pointerId !== pointerId) return;
    event.preventDefault();
    const dy = event.clientY - startY;
    dragEl.style.transform = `translateY(${dy}px)`;
    const target = targetZoneFor(event.clientY);
    topZone.classList.toggle('drop-target', target === topZone);
    bottomZone.classList.toggle('drop-target', target === bottomZone);
  };

  const onUp = (event) => {
    if (!dragEl || event.pointerId !== pointerId) return;
    const target = targetZoneFor(event.clientY);
    dragEl.style.transform = '';
    insertByY(target, event.clientY);
    const layout = layoutFromDom(topZone, bottomZone);
    cleanup();
    onChange(layout);
  };

  document.querySelectorAll('.bar-grip').forEach((grip) => {
    grip.addEventListener('pointerdown', (event) => {
      if (dragEl) return;
      dragEl = grip.closest('.movable-bar');
      if (!dragEl) return;
      pointerId = event.pointerId;
      startY = event.clientY;
      event.preventDefault();
      grip.setPointerCapture(pointerId);
      dragEl.classList.add('dragging');
      document.body.classList.add('bars-dragging');
    });
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
    grip.addEventListener('pointercancel', cleanup);
  });
}

/**
 * Muscle zones for the add-exercise flow (step 1).
 * Labels follow the reference "ท่าบริหาร" grouping; shortLabel is used when prefilling the burn sheet.
 */

/** @typedef {{ id: string, label: string, shortLabel: string, keywords: string[], accent: string }} MuscleZone */

/** @type {MuscleZone[]} */
export const MUSCLE_ZONES = [
  {
    id: 'chest',
    label: 'หน้าอก',
    shortLabel: 'อก',
    keywords: ['อก', 'chest', 'pec', 'bench'],
    accent: '#e07a5f',
  },
  {
    id: 'back',
    label: 'แผ่นหลัง',
    shortLabel: 'หลัง',
    keywords: ['หลัง', 'back', 'lat', 'row'],
    accent: '#e07a5f',
  },
  {
    id: 'legs',
    label: 'ขา',
    shortLabel: 'ขา',
    keywords: ['ขา', 'leg', 'quad', 'squat', 'hamstring'],
    accent: '#e07a5f',
  },
  {
    id: 'glutes',
    label: 'กล้ามเนื้อ Gluteus',
    shortLabel: 'ก้น',
    keywords: ['ก้น', 'glute', 'hip'],
    accent: '#e07a5f',
  },
  {
    id: 'deltoid',
    label: 'กล้ามเนื้อ Deltoid',
    shortLabel: 'ไหล่',
    keywords: ['ไหล่', 'ไหล', 'deltoid', 'shoulder', 'press'],
    accent: '#e07a5f',
  },
  {
    id: 'bicep',
    label: 'กล้ามเนื้อ Bicep',
    shortLabel: 'ไบเซป',
    keywords: ['ไบเซป', 'bicep', 'curl'],
    accent: '#e07a5f',
  },
  {
    id: 'tricep',
    label: 'กล้ามเนื้อ Tricep',
    shortLabel: 'ไตรเซป',
    keywords: ['ไตรเซป', 'tricep', 'extension'],
    accent: '#e07a5f',
  },
  {
    id: 'forearms',
    label: 'แขนช่วงล่าง',
    shortLabel: 'แขนล่าง',
    keywords: ['แขนล่าง', 'forearm', 'grip'],
    accent: '#e07a5f',
  },
  {
    id: 'abs',
    label: 'กล้ามเนื้อหน้าท้อง',
    shortLabel: 'ท้อง',
    keywords: ['ท้อง', 'abs', 'core', 'crunch'],
    accent: '#e07a5f',
  },
  {
    id: 'functional',
    label: 'การออกกำลังกายแบบ Functional',
    shortLabel: 'ฟังก์ชัน',
    keywords: ['functional', 'ฟังก์', 'kettle', 'คอมพาวด์'],
    accent: '#f2a65a',
  },
  {
    id: 'cardio',
    label: 'การออกกำลังกายแบบคาร์ดิโอ',
    shortLabel: 'คาร์ดิโอ',
    keywords: ['คาร์ดิโอ', 'cardio', 'วิ่ง', 'run', 'bike', 'เดิน'],
    accent: '#ef6b6b',
  },
  {
    id: 'stretch',
    label: 'การยืด',
    shortLabel: 'ยืด',
    keywords: ['ยืด', 'stretch', 'mobility', 'โยคะ'],
    accent: '#7eb8da',
  },
];

export function getMuscleZone(id) {
  return MUSCLE_ZONES.find((z) => z.id === id) || null;
}

export function filterMuscleZones(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return MUSCLE_ZONES.slice();
  return MUSCLE_ZONES.filter((z) => {
    const labelCore = String(z.label || '')
      .toLowerCase()
      .replace(/^กล้ามเนื้อ\s*/u, '')
      .replace(/^การออกกำลังกายแบบ\s*/u, '')
      .replace(/^แบบ/u, '');
    const parts = [labelCore, z.shortLabel, z.id, ...(z.keywords || [])]
      .map((x) => String(x || '').toLowerCase());
    return parts.some((part) => part.includes(q));
  });
}

/** Compact body silhouette with a highlighted region (original SVG, not from third-party apps). */
function zoneArt(highlightPaths, { view = '0 0 120 140' } = {}) {
  const base = `
    <ellipse cx="60" cy="18" rx="12" ry="14" fill="currentColor" opacity="0.22"/>
    <path fill="currentColor" opacity="0.18" d="M42 34c4-8 32-8 36 0l8 22c2 6 0 14-4 18l-6 48H44l-6-48c-4-4-6-12-4-18z"/>
    <path fill="currentColor" opacity="0.14" d="M38 78l-10 52h16l8-40zm44 0l10 52H76l-8-40z"/>
  `;
  const hi = (highlightPaths || [])
    .map((d) => `<path fill="var(--zone-accent, #e07a5f)" d="${d}"/>`)
    .join('');
  return `<svg class="mz-art" viewBox="${view}" aria-hidden="true" focusable="false">${base}${hi}</svg>`;
}

const ZONE_ART = {
  chest: zoneArt([
    'M48 48c4-10 20-10 24 0 3 8 2 16-2 20-4 4-12 4-16 0-4-4-5-12-2-20z',
  ]),
  back: zoneArt([
    'M46 46c6-8 22-8 28 0 4 10 2 28-4 40H50c-6-12-8-30-4-40z',
  ]),
  legs: zoneArt([
    'M44 88h14l6 44H48zm18 0h14l-6 44H56z',
  ]),
  glutes: zoneArt([
    'M44 78c6-6 26-6 32 0 4 6 2 16-4 20H48c-6-4-8-14-4-20z',
  ]),
  deltoid: zoneArt([
    'M34 42c8-4 14 2 16 10-6 2-12 4-18 2-2-4 0-10 2-12zm52 0c-8-4-14 2-16 10 6 2 12 4 18 2 2-4 0-10-2-12z',
  ]),
  bicep: zoneArt([
    'M28 48c8-2 14 6 12 16-2 8-8 12-14 10-4-10 0-24 2-26zm52 0c-8-2-14 6-12 16 2 8 8 12 14 10 4-10 0-24-2-26z',
  ]),
  tricep: zoneArt([
    'M30 50c6 0 10 8 8 16-2 6-8 10-12 8 0-10 2-22 4-24zm48 0c-6 0-10 8-8 16 2 6 8 10 12 8 0-10-2-22-4-24z',
  ]),
  forearms: zoneArt([
    'M24 70c6 0 10 10 8 22-8 2-14-4-12-14 0-4 2-8 4-8zm72 0c-6 0-10 10-8 22 8 2 14-4 12-14 0-4-2-8-4-8z',
  ]),
  abs: zoneArt([
    'M52 52h16v8H52zm0 10h16v8H52zm0 10h16v8H52zm0 10h16v8H52z',
  ]),
  functional: zoneArt([
    'M48 48c4-10 20-10 24 0 3 8 2 16-2 20-4 4-12 4-16 0-4-4-5-12-2-20z',
    'M52 78h16v18H52z',
  ]),
  cardio: `
    <svg class="mz-art" viewBox="0 0 120 140" aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="18" rx="12" ry="14" fill="currentColor" opacity="0.22"/>
      <path fill="currentColor" opacity="0.18" d="M42 34c4-8 32-8 36 0l8 22c2 6 0 14-4 18l-6 48H44l-6-48c-4-4-6-12-4-18z"/>
      <path fill="var(--zone-accent, #ef6b6b)" d="M60 58c-8-10-24-2-24 12 0 14 18 28 24 32 6-4 24-18 24-32 0-14-16-22-24-12z"/>
      <path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
        d="M38 72h10l4-10 6 18 4-8h20" opacity="0.9"/>
    </svg>`,
  stretch: zoneArt([
    'M40 100c8-18 32-18 40 0-6 8-14 12-20 12s-14-4-20-12z',
    'M48 48c4-10 20-10 24 0v20H48z',
  ]),
};

export function muscleZoneArtHtml(zoneId) {
  return ZONE_ART[zoneId] || zoneArt([]);
}

export function renderMuscleZoneCardsHtml(zones = MUSCLE_ZONES) {
  if (!zones.length) {
    return '<p class="mz-empty">ไม่พบโซนที่ตรงกับคำค้น</p>';
  }
  return zones
    .map((z) => {
      const accent = z.accent || '#e07a5f';
      return `<button type="button" class="mz-card" data-zone-id="${z.id}" style="--zone-accent:${accent}">
        <span class="mz-card-label">${escapeHtml(z.label)}</span>
        <span class="mz-card-art">${muscleZoneArtHtml(z.id)}</span>
      </button>`;
    })
    .join('');
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

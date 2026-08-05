/**
 * Line-icon catalog for tags + priority (Soft UI leading icons).
 * Paths are 24×24 stroke outlines (currentColor).
 */

const P = (d) => d;

/** @type {Record<string, { id: string, label: string, path: string, keywords: string[] }>} */
export const ICON_CATALOG = {
  land: {
    id: 'land',
    label: 'ที่ดิน',
    path: P('M3 20h18M5 20V10l7-5 7 5v10M9 20v-5h6v5'),
    keywords: ['ที่ดิน', 'แปลง', 'โฉนด', 'รังวัด', 'peerland', 'peer', 'land', 'plot', 'deed'],
  },
  map: {
    id: 'map',
    label: 'แผนที่',
    path: P('M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2-6-2zm0 0v14m6-12v14'),
    keywords: ['แผนที่', 'map', 'survey', 'รังวัด', 'gis'],
  },
  pin: {
    id: 'pin',
    label: 'หมุด',
    path: P('M12 21s7-5.3 7-11a7 7 0 10-14 0c0 5.7 7 11 7 11zm0-8.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z'),
    keywords: ['หมุด', 'ที่ตั้ง', 'pin', 'location', 'สถานที่'],
  },
  home: {
    id: 'home',
    label: 'บ้าน',
    path: P('M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9z'),
    keywords: ['บ้าน', 'home', 'house', 'ที่พัก'],
  },
  shop: {
    id: 'shop',
    label: 'ร้าน',
    path: P('M4 9l1.5-5h13L20 9M4 9v11h16V9M9 20v-6h6v6'),
    keywords: ['ร้าน', 'shop', 'store', 'ขาย', 'หน้าร้าน'],
  },
  coffee: {
    id: 'coffee',
    label: 'เครื่องดื่ม',
    path: P('M6 8h10v7a4 4 0 01-4 4H10a4 4 0 01-4-4V8zm10 1h2.5a2.5 2.5 0 010 5H16M8 3v3M12 3v3M16 3v3'),
    keywords: ['ชา', 'กาแฟ', 'tea', 'coffee', 'drink', 'telltea', 'tell'],
  },
  fork: {
    id: 'fork',
    label: 'อาหาร',
    path: P('M8 3v7a2 2 0 002 2h0a2 2 0 002-2V3M10 12v9M16 3v6a2 2 0 01-2 2h0M14 11v10'),
    keywords: ['อาหาร', 'เมนู', 'menu', 'food', 'ครัว'],
  },
  box: {
    id: 'box',
    label: 'กล่อง',
    path: P('M3 8l9-4 9 4-9 4-9-4zm0 0v8l9 4 9-4V8'),
    keywords: ['กล่อง', 'สต็อก', 'stock', 'box', 'คลัง', 'วัตถุดิบ', 'warehouse'],
  },
  users: {
    id: 'users',
    label: 'ทีม',
    path: P('M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75'),
    keywords: ['ทีม', 'พนักงาน', 'staff', 'team', 'คน', 'users', 'คนงาน'],
  },
  person: {
    id: 'person',
    label: 'บุคคล',
    path: P('M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0'),
    keywords: ['บุคคล', 'person', 'เจ้าของ', 'owner', 'ลูกค้า'],
  },
  doc: {
    id: 'doc',
    label: 'เอกสาร',
    path: P('M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h5M9 13h6M9 17h6'),
    keywords: ['เอกสาร', 'doc', 'file', 'โน้ต', 'note', 'จด'],
  },
  book: {
    id: 'book',
    label: 'บัญชี',
    path: P('M5 4h11a2 2 0 012 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 012-2zm3 5h7M8 12h7'),
    keywords: ['บัญชี', 'account', 'ledger', 'book', 'บัญชีเจ้าของ'],
  },
  chart: {
    id: 'chart',
    label: 'สรุป',
    path: P('M4 19h16M7 16V10M12 16V6M17 16v-4'),
    keywords: ['สรุป', 'รายงาน', 'chart', 'report', 'pnl', 'กำไร'],
  },
  money: {
    id: 'money',
    label: 'เงิน',
    path: P('M4 8h16v8H4V8zm4 4h.01M12 10.5a2 2 0 110 3 2 2 0 010-3zM16 12h.01'),
    keywords: ['เงิน', 'ขาย', 'pos', 'vat', 'money', 'cash', 'รายรับ'],
  },
  calendar: {
    id: 'calendar',
    label: 'ปฏิทิน',
    path: P('M5 6h14v14H5V6zm0 4h14M9 3v4M15 3v4M9 14h2M13 14h2M9 17h2'),
    keywords: ['ปฏิทิน', 'นัด', 'calendar', 'schedule', 'กำหนด'],
  },
  clock: {
    id: 'clock',
    label: 'เวลา',
    path: P('M12 21a9 9 0 100-18 9 9 0 000 18zm0-14v5l3 2'),
    keywords: ['เวลา', 'clock', 'ด่วน', 'deadline'],
  },
  wrench: {
    id: 'wrench',
    label: 'เครื่องมือ',
    path: P('M14.7 6.3a4 4 0 015 5L15 16l-3-1-1-3 4.7-5.7zM3 21l6.5-6.5'),
    keywords: ['เครื่องมือ', 'tool', 'ซ่อม', 'utility', 'ยูทิล'],
  },
  gear: {
    id: 'gear',
    label: 'ตั้งค่า',
    path: P('M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9c.3.6.9 1 1.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z'),
    keywords: ['ตั้งค่า', 'settings', 'gear', 'โมดูล'],
  },
  leaf: {
    id: 'leaf',
    label: 'ธรรมชาติ',
    path: P('M5 19c8 0 12-6 14-14-8 2-14 6-14 14zm0 0c2-4 6-7 11-9'),
    keywords: ['ต้นไม้', 'สวน', 'leaf', 'green', 'เกษตร'],
  },
  car: {
    id: 'car',
    label: 'รถ',
    path: P('M4 13l2-5h12l2 5M4 13v5h2v-2h12v2h2v-5M7.5 16a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z'),
    keywords: ['รถ', 'car', 'ขนส่ง', 'delivery'],
  },
  phone: {
    id: 'phone',
    label: 'โทร',
    path: P('M7 3h4l1 4-2 2a12 12 0 006 6l2-2 4 1v4a2 2 0 01-2 2A16 16 0 015 5a2 2 0 012-2z'),
    keywords: ['โทร', 'phone', 'ติดต่อ', 'call'],
  },
  chat: {
    id: 'chat',
    label: 'แชท',
    path: P('M5 5h14v10H9l-4 3V5z'),
    keywords: ['แชท', 'chat', 'ข้อความ', 'คุย'],
  },
  star: {
    id: 'star',
    label: 'ดาว',
    path: P('M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.1l1-5.8L3.5 9.2l5.9-.9L12 3z'),
    keywords: ['ดาว', 'star', 'สำคัญ', 'favorite'],
  },
  spark: {
    id: 'spark',
    label: 'ประกาย',
    path: P('M12 2l1.2 5.2L18 8.5l-4.2 2.1L12 16l-1.8-5.4L6 8.5l4.8-1.3L12 2zm6 9l.7 2.8L22 14.5l-2.8 1.2L18 18.5l-.7-2.8L14.5 14.5l2.8-1.2L18 11z'),
    keywords: ['ประกาย', 'spark', 'เร่งด่วน', 'critical', 'ยูทิล'],
  },
  flag: {
    id: 'flag',
    label: 'ธง',
    path: P('M6 3v18M6 4h10l-2 4 2 4H6'),
    keywords: ['ธง', 'flag', 'สำคัญ', 'important'],
  },
  bolt: {
    id: 'bolt',
    label: 'สายฟ้า',
    path: P('M13 2L4 14h7l-1 8 9-12h-7l1-8z'),
    keywords: ['สายฟ้า', 'bolt', 'เร่ง', 'urgent', 'ด่วน'],
  },
  flame: {
    id: 'flame',
    label: 'ไฟ',
    path: P('M12 3c2 4-2 5-2 8a4 4 0 008 0c0-4-2-6-3-8 3 2 5 5 5 8a6 6 0 11-12 0c0-3 2-6 4-8z'),
    keywords: ['ไฟ', 'flame', 'hot', 'ด่วนมาก'],
  },
  check: {
    id: 'check',
    label: 'ติ๊ก',
    path: P('M5 12.5l4.5 4.5L19 7'),
    keywords: ['ติ๊ก', 'check', 'ทำแล้ว', 'done'],
  },
  circle: {
    id: 'circle',
    label: 'วงกลม',
    path: P('M12 20a8 8 0 100-16 8 8 0 000 16z'),
    keywords: ['ทั่วไป', 'normal', 'circle', 'ทั่วไป'],
  },
  dot: {
    id: 'dot',
    label: 'จุด',
    path: P('M12 16a4 4 0 100-8 4 4 0 000 8z'),
    keywords: ['จุด', 'dot', 'ทั่วไป'],
  },
  download: {
    id: 'download',
    label: 'ส่งออก',
    path: P('M12 4v10m0 0l-4-4m4 4l4-4M5 19h14'),
    keywords: ['ส่งออก', 'export', 'download', 'excel'],
  },
};

export const ICON_IDS = Object.keys(ICON_CATALOG);

export const DEFAULT_PRIORITY_ICONS = {
  critical: 'spark',
  important: 'flag',
  urgent: 'bolt',
  normal: 'circle',
};

export function normalizeIconId(value, fallback = 'doc') {
  const id = String(value || '').trim();
  return ICON_CATALOG[id] ? id : fallback;
}

export function normalizePriorityIcons(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    critical: normalizeIconId(src.critical, DEFAULT_PRIORITY_ICONS.critical),
    important: normalizeIconId(src.important, DEFAULT_PRIORITY_ICONS.important),
    urgent: normalizeIconId(src.urgent, DEFAULT_PRIORITY_ICONS.urgent),
    normal: normalizeIconId(src.normal, DEFAULT_PRIORITY_ICONS.normal),
  };
}

/** SVG markup (no outer sizing — set via CSS / attributes). */
export function iconSvg(iconId, { size = 18, className = 'pnote-icon' } = {}) {
  const icon = ICON_CATALOG[normalizeIconId(iconId)];
  const cls = className ? ` class="${className}"` : '';
  return `<svg${cls} viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="${icon.path}"/></svg>`;
}

function scoreIcon(icon, hay) {
  let score = 0;
  for (const kw of icon.keywords) {
    const k = kw.toLowerCase();
    if (!k) continue;
    if (hay === k) score += 12;
    else if (hay.includes(k)) score += 8;
    else if (k.includes(hay) && hay.length >= 3) score += 4;
  }
  if (hay && icon.id.includes(hay)) score += 3;
  if (hay && icon.label.toLowerCase().includes(hay)) score += 2;
  return score;
}

/**
 * Suggest icons for a tag/label name. Returns catalog entries, best first.
 * Always includes a few general icons as fallbacks.
 */
export function suggestIconsForLabel(label, { limit = 8 } = {}) {
  const hay = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const scored = ICON_IDS.map((id) => {
    const icon = ICON_CATALOG[id];
    return { icon, score: hay ? scoreIcon(icon, hay) : 0 };
  }).sort((a, b) => b.score - a.score || a.icon.label.localeCompare(b.icon.label, 'th'));

  const out = [];
  const seen = new Set();
  const push = (icon) => {
    if (!icon || seen.has(icon.id)) return;
    seen.add(icon.id);
    out.push(icon);
  };

  scored.filter((s) => s.score > 0).forEach((s) => push(s.icon));
  // Fallbacks useful for business tags
  ['doc', 'pin', 'shop', 'box', 'users', 'calendar', 'star', 'circle'].forEach((id) =>
    push(ICON_CATALOG[id]),
  );
  ICON_IDS.forEach((id) => push(ICON_CATALOG[id]));
  return out.slice(0, limit);
}

export function bestIconForLabel(label) {
  return suggestIconsForLabel(label, { limit: 1 })[0]?.id || 'doc';
}

export function allIcons() {
  return ICON_IDS.map((id) => ICON_CATALOG[id]);
}

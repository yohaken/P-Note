/** Selectable PWA / in-app brand icons (10 options). */

export const DEFAULT_APP_ICON_ID = 'leaf';

export const APP_ICON_OPTIONS = [
  { id: 'leaf', label: 'ใบ' },
  { id: 'apple', label: 'แอปเปิล' },
  { id: 'flame', label: 'ไฟ' },
  { id: 'heart', label: 'หัวใจ' },
  { id: 'drop', label: 'หยดน้ำ' },
  { id: 'sun', label: 'อาทิตย์' },
  { id: 'bowl', label: 'ชาม' },
  { id: 'scale', label: 'ตาชั่ง' },
  { id: 'sprout', label: 'ต้นอ่อน' },
  { id: 'cal', label: 'C' },
];

const APP_ICON_IDS = new Set(APP_ICON_OPTIONS.map((o) => o.id));

/** Cache-bust for icon assets — bump with pnote-build when icons change. */
const ICON_ASSET_V = '251';

export function normalizeAppIconId(value) {
  const id = String(value || '').trim();
  return APP_ICON_IDS.has(id) ? id : DEFAULT_APP_ICON_ID;
}

export function appIconSrc(id, size = 192) {
  const safe = normalizeAppIconId(id);
  const dim = size === 512 ? 512 : 192;
  return `icons/app/${safe}-${dim}.png?v=${ICON_ASSET_V}`;
}

export function appManifestHref(id) {
  const safe = normalizeAppIconId(id);
  return `manifests/${safe}.json?v=${ICON_ASSET_V}`;
}

function upsertLink(rel, href, attrs = {}) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => {
    if (v == null) el.removeAttribute(k);
    else el.setAttribute(k, v);
  });
  el.setAttribute('href', href);
  return el;
}

function updateManifestForIcon(iconId) {
  const id = normalizeAppIconId(iconId);
  // Same-origin static JSON — Chrome install / "Open in app" ignores blob: manifests.
  upsertLink('manifest', appManifestHref(id));
}

/**
 * Apply selected brand icon to logos, favicon, apple-touch-icon, and install manifest.
 * Already-installed PWAs keep Chrome's cached icon until uninstall + reinstall.
 */
export function applyAppIcon(iconId) {
  const id = normalizeAppIconId(iconId);
  const src192 = appIconSrc(id, 192);

  document.querySelectorAll('img.app-logo').forEach((img) => {
    if (img.getAttribute('src') !== src192) img.setAttribute('src', src192);
  });

  upsertLink('icon', src192, { type: 'image/png' });
  document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => {
    link.setAttribute('href', src192);
    link.setAttribute('type', 'image/png');
  });
  upsertLink('apple-touch-icon', src192);

  updateManifestForIcon(id);
  return id;
}

/** Read appIconId from localStorage before modules load (also used by inline boot). */
export function peekStoredAppIconId() {
  try {
    const raw = localStorage.getItem('pnote_settings');
    if (!raw) return DEFAULT_APP_ICON_ID;
    const parsed = JSON.parse(raw);
    return normalizeAppIconId(parsed?.appIconId);
  } catch {
    return DEFAULT_APP_ICON_ID;
  }
}

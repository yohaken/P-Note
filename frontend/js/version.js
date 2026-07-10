/** App build id — primary source is <meta name="pnote-build"> in index.html. */
export function getAppBuild() {
  return document.querySelector('meta[name="pnote-build"]')?.content || '0';
}

/** ISO timestamp from <meta name="pnote-built"> — set when bumping the build. */
export function getAppBuiltAt() {
  return document.querySelector('meta[name="pnote-built"]')?.content || '';
}

export function formatAppBuiltAt(iso = getAppBuiltAt()) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function cacheName() {
  return `pnote-v${getAppBuild()}`;
}

/** App build id — primary source is <meta name="pnote-build"> in index.html. */
export function getAppBuild() {
  return document.querySelector('meta[name="pnote-build"]')?.content || '0';
}

export function cacheName() {
  return `pnote-${getAppBuild()}`;
}

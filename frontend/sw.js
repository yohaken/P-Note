const CACHE_NAME = 'pnote-v40';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './data/notes-import.json',
  './js/cache-bootstrap.js',
  './js/version.js',
  './js/cache.js',
  './js/update.js',
  './js/import-data.js',
  './js/remote.js',
  './js/text-input.js',
  './js/bars.js',
  './js/viewport.js',
  './js/sortable.js',
  './js/config.js',
  './js/local.js',
  './js/sync.js',
  './js/notes.js',
  './js/schedule.js',
  './js/settings.js',
  './js/context-menu.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin.includes('googleapis.com') || url.origin.includes('accounts.google.com')) {
    return;
  }

  const isDocument = event.request.mode === 'navigate'
    || event.request.destination === 'document'
    || url.pathname.endsWith('/index.html')
    || url.pathname === '/' || url.pathname.endsWith('/');

  if (isDocument) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }),
    ),
  );
});

// Sab Wells PT — Service Worker
//
// Strategy: always try the network first (so a new upload on GitHub is
// picked up immediately), and only fall back to the cache when the network
// request fails (i.e. offline). On every activation it wipes any caches
// from a previous version and takes control of open tabs straight away,
// which — combined with the registration code in index.html — makes the
// app reload itself automatically the moment a new version is found.
//
// You do NOT need to bump CACHE_VERSION for normal updates — this worker
// already clears out old caches on every activate. Only bump it if you
// ever want to force a clean slate for some other reason.
const CACHE_VERSION = 'sabwells-cache-v1';

const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './logo.webp',
];

self.addEventListener('install', (event) => {
  // Take over from any previous worker as soon as this one finishes
  // installing, rather than waiting for all tabs to close.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // don't let a flaky network block install
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Remove every cache that isn't this version's.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      );
      // Start controlling any already-open tabs immediately, instead of
      // only on their next navigation.
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        // Keep the cache fresh with whatever the network just returned.
        const cache = await caches.open(CACHE_VERSION);
        cache.put(event.request, response.clone());
        return response;
      } catch (err) {
        // Offline (or the network failed) — serve the last cached copy.
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw err;
      }
    })()
  );
});

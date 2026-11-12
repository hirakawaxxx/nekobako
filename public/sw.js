// PRECACHE_REVISION is derived from the precached files; `node scripts/sw-revision.mjs`
// rewrites it, and test/pwa.test.js fails while it is stale. Changing it changes this
// file's bytes, which is what makes browsers install the new worker after a deploy.
const PRECACHE_REVISION = 'a98bd3fb1c01';
const CACHE_PREFIX = 'nekobako-';
const CACHE_NAME = `${CACHE_PREFIX}${PRECACHE_REVISION}`;
const OFFLINE_FALLBACK_URL = '/';

// Only URLs that the host serves without a redirect ("/", not "/index.html").
const PRECACHE_URLS = [
  '/',
  '/fonts.css',
  '/tokens.css',
  '/components.css',
  '/style.css',
  '/fonts/zen-maru-gothic-500.woff2',
  '/fonts/zen-maru-gothic-700.woff2',
  '/game.js',
  '/register-sw.js',
  '/js/cats.js',
  '/js/queue.js',
  '/js/game-over.js',
  '/js/config.js',
  '/js/sprites.js',
  '/js/stats.js',
  '/js/world-height.js',
  '/js/sprite-cache.js',
  '/js/cat-art.js',
  '/js/audio.js',
  '/js/storage.js',
  '/vendor/matter.min.js',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

const DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const IS_DEV = DEV_HOSTNAMES.has(self.location.hostname);

// Safari fails navigations answered with a redirected response, so never store one.
const isCacheable = (response) =>
  response.ok && !response.redirected && response.type === 'basic';

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(PRECACHE_URLS.map(async (url) => {
    const response = await fetch(new Request(url, { cache: 'reload' }));
    if (!isCacheable(response)) {
      throw new Error(`Precache failed for ${url}: ${response.status}`);
    }
    await cache.put(url, response);
  }));
}

async function deleteOldCaches() {
  const names = await caches.keys();
  await Promise.all(names
    .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
    .map((name) => caches.delete(name)));
}

async function putInCache(request, response) {
  if (isCacheable(response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
  }
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    await putInCache(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true })
      ?? (fallbackUrl ? await caches.match(fallbackUrl) : undefined);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

function staleWhileRevalidate(event) {
  const { request } = event;
  const refreshed = fetch(request).then(async (response) => {
    await putInCache(request, response.clone());
    return response;
  });
  event.waitUntil(refreshed.catch(() => undefined));
  return caches.match(request).then((cached) => cached ?? refreshed);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteOldCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/sw.js') {
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, OFFLINE_FALLBACK_URL));
    return;
  }
  // On localhost, always prefer fresh files so edits show up on the next reload.
  event.respondWith(IS_DEV ? networkFirst(request) : staleWhileRevalidate(event));
});

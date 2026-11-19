// Service Worker for Dental Smart Booking & Clinic Admin Mobile Notifications
const CACHE_NAME = 'dental-smart-static-v4';
const API_CACHE_NAME = 'dental-smart-api-v1';

const PRECACHE_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/icon.svg',
];

importScripts('/sw-push.js');

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null))
        )
      )
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('dental-smart-') && key !== CACHE_NAME && key !== API_CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windowClients) {
        try {
          client.postMessage({ type: 'SW_CACHE_READY', cacheName: CACHE_NAME });
        } catch {}
      }
    })()
  );
});

function isPriorityStaticAsset(url) {
  const path = url.pathname;
  return (
    path.startsWith('/assets/') ||
    /\.(?:js|mjs|css|woff2?|ttf|eot|svg|png|jpe?g|webp|ico)$/i.test(path)
  );
}

function isCacheablePublicApi(url) {
  return /^\/api\/public\/(services|providers|clinic-info|clinic-settings|availability)/i.test(url.pathname);
}

async function cacheFirstPriorityStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok && (response.type === 'basic' || response.type === 'cors')) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Refresh in background for non-hashed/dev JS & CSS without blocking offline/fast startup
    networkFetchPromise.catch(() => {});
    return cached;
  }

  const fresh = await networkFetchPromise;
  if (fresh) return fresh;

  return new Response('', { status: 504, statusText: 'Offline asset unavailable' });
}

async function networkFirstWithTimeout(request, cacheName, timeoutMs = 4000) {
  const cache = await caches.open(cacheName);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    clearTimeout(timeoutId);
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const staticCache = await caches.open(CACHE_NAME);
      const fallbackShell = (await staticCache.match('/index.html')) || (await staticCache.match('/'));
      if (fallbackShell) return fallbackShell;
    }
    return new Response(JSON.stringify({ success: false, offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept SSE streams, auth callbacks, health probes, or SW scripts
  if (
    url.pathname === '/sw.js' ||
    url.pathname === '/sw-push.js' ||
    url.pathname.startsWith('/api/public/events') ||
    url.pathname.startsWith('/api/events') ||
    url.pathname === '/api/health'
  ) {
    return;
  }

  if (isPriorityStaticAsset(url)) {
    event.respondWith(cacheFirstPriorityStatic(req));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstWithTimeout(req, CACHE_NAME, 4500));
    return;
  }

  if (isCacheablePublicApi(url)) {
    event.respondWith(networkFirstWithTimeout(req, API_CACHE_NAME, 4000));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-bookings') {
    event.waitUntil(
      (async () => {
        const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windowClients) {
          try {
            client.postMessage({ type: 'SYNC_PENDING_BOOKINGS' });
          } catch {}
        }
      })()
    );
  }
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'GET_SW_STATUS') {
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          const keys = await cache.keys();
          const port = event.ports && event.ports[0];
          const replyPayload = {
            type: 'SW_STATUS',
            ready: true,
            cacheName: CACHE_NAME,
            cachedAssets: keys.length,
          };
          if (port) {
            port.postMessage(replyPayload);
          } else if (event.source && 'postMessage' in event.source) {
            event.source.postMessage(replyPayload);
          }
        } catch {}
      })()
    );
  } else if (data.type === 'TRIGGER_QUEUE_SYNC') {
    event.waitUntil(
      (async () => {
        const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windowClients) {
          try {
            client.postMessage({ type: 'SYNC_PENDING_BOOKINGS' });
          } catch {}
        }
      })()
    );
  }
});

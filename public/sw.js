const CACHE_NAME = 'nexus-chat-v4';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/logo.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {}));
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request).catch(() => undefined)
          if (cachedPage) return cachedPage
          const appShell = await caches.match('/index.html').catch(() => undefined)
          return appShell || new Response('Nexus Chat is temporarily unavailable offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .catch(() => undefined)
      .then((cached) => cached || fetch(request))
      .catch(() => new Response('This resource is temporarily unavailable.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }))
  );
});

const CACHE_NAME = 'mcrm-static-v3';

// On install: only pre-cache small static icons — skip the app shell
// to avoid blocking the install phase with large fetches.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(['/favicon.png', '/icon-192.png', '/icon-512.png', '/manifest.json']))
      .then(() => self.skipWaiting())
  );
});

// On activate: delete old caches so stale JS/CSS is never served.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => n !== CACHE_NAME ? caches.delete(n) : null)))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Static assets (hashed JS/CSS/fonts/images in /assets/): cache-first (immutable, safe).
// - Everything else (HTML, API calls): network-only — never intercept, pass straight through.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Static hashed assets — cache forever (Vite gives them content-hash filenames)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Icons / manifest — cache-first (rarely change)
  if (['/favicon.png', '/icon-192.png', '/icon-512.png', '/manifest.json'].includes(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => cached || fetch(event.request))
      )
    );
    return;
  }

  // HTML navigation and all API calls: network-only (no caching, no interception)
  // Do NOT call event.respondWith — let the browser handle it natively.
});

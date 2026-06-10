// Orynthia – minimaler Service Worker.
// Navigationen (HTML) network-first, gehashte Assets cache-first,
// /api immer network-only.
const VERSION = 'v2';
const STATIC_CACHE = `orynthia-static-${VERSION}`;
// Nur unveränderliche Dateien vorab cachen – index.html ändert sich bei jedem
// Deploy und würde cache-first auf gelöschte Asset-Hashes zeigen (weiße Seite).
const STATIC_ASSETS = ['/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('orynthia-') && k !== STATIC_CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API & gleichgelagerte dynamische Pfade: network-only, kein Cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  // Navigationen: network-first, Cache nur als Offline-Fallback. So bekommt
  // jeder Reload nach einem Deploy sofort das neue index.html.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        try {
          const res = await fetch(req);
          if (res && res.status === 200) cache.put('/index.html', res.clone());
          return res;
        } catch {
          const cached = await cache.match('/index.html');
          return cached || Response.error();
        }
      }),
    );
    return;
  }

  // Statische Assets (gehashte Dateinamen): cache-first mit Hintergrund-Refresh.
  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    }),
  );
});

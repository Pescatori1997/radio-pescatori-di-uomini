/* Pescatori di Uomini - Service Worker (PWA)
 * Strategy:
 *  - Only handles SAME-ORIGIN GET requests. Cross-origin requests
 *    (backend API, AzuraCast stream, YouTube, Stripe, etc.) are never
 *    intercepted, so live streaming / auth / payments always hit the network.
 *  - Navigations: network-first with offline fallback to the cached app shell.
 *  - Static assets (JS/CSS/fonts/images/icons): stale-while-revalidate.
 *  - VERSION is stamped uniquely at build time (scripts/inject-pwa.js replaces
 *    __BUILD_ID__), so every deploy ships a byte-different sw.js -> the browser
 *    detects the update, installs the new worker, purges the old caches on
 *    activate and takes control immediately (skipWaiting + clients.claim).
 */
const VERSION = "pdu-__BUILD_ID__";
const APP_SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL).then((cache) => cache.addAll([OFFLINE_URL]).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  return /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|webp|svg|ico|json)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never touch cross-origin (API/backend, AzuraCast stream, YouTube, Stripe...).
  if (url.origin !== self.location.origin) return;

  // Never cache the service worker or the manifest (must always revalidate to
  // pick up new deploys). Let the browser handle these directly.
  if (url.pathname === "/sw.js" || url.pathname === "/manifest.json") return;

  // App navigations -> network first, fall back to cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(APP_SHELL);
          cache.put(OFFLINE_URL, fresh.clone());
          return fresh;
        } catch (e) {
          const cache = await caches.open(APP_SHELL);
          const cached = await cache.match(OFFLINE_URL);
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets -> stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })()
    );
  }
});

// Allow the page to trigger an immediate activation after an update.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

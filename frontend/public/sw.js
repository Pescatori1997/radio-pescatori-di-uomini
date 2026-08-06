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

  // App navigations -> network-first WITH A TIMEOUT, fall back to the cached
  // shell. Without the timeout an iOS standalone PWA cold-start (where the
  // network request can hang indefinitely) would leave the user stuck on a
  // blank screen forever, because the offline fallback only fires on a network
  // *rejection*, not on a hang.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_SHELL);
        try {
          const fresh = await Promise.race([
            fetch(req),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000)),
          ]);
          // Only cache successful full responses as the offline shell.
          if (fresh && fresh.ok) cache.put(OFFLINE_URL, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await cache.match(OFFLINE_URL);
          // If we have no shell yet, keep waiting on the network (last resort)
          // rather than returning an error page.
          return cached || fetch(req);
        }
      })()
    );
    return;
  }

  // Optimized content images (/api/img/...) -> cache-first. The URL carries a
  // content hash (?v=...), so a changed image always yields a NEW URL; serving
  // the cached bytes is always correct and never stale. This restores fast
  // repeat opens even though Cloudflare strips the Cache-Control header.
  if (url.pathname.startsWith("/api/img/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        } catch (e) {
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

// ---- Web Push (PWA notifications) ----
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Pescatori di Uomini", message: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Pescatori di Uomini";
  const options = {
    body: data.message || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.action_url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          try { await c.navigate(url); } catch (e) {}
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })()
  );
});

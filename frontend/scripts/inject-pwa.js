#!/usr/bin/env node
/* Post-build step for the web (PWA) export.
 * Expo's SPA output (web.output = "single") ships a minimal index.html and
 * ignores app/+html.tsx, so we inject the PWA <head> tags + service-worker
 * registration into the exported dist/index.html here.
 * Runs on Vercel right after `expo export -p web`. Native build is untouched.
 */
const fs = require("fs");
const path = require("path");

const dist = path.join(process.cwd(), "dist");
const indexPath = path.join(dist, "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("[inject-pwa] dist/index.html not found — did `expo export -p web` run?");
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf8");

const HEAD_TAGS = `
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0A1128" />
    <meta name="description" content="Radio Evangelica Cristiana - dirette, podcast, meditazioni, notizie e molto altro." />
    <meta name="application-name" content="Pescatori di Uomini" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Pescatori" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').then(function (reg) {
            // Poll for a newer service worker so open PWAs update without a manual relaunch.
            setInterval(function () { reg.update().catch(function () {}); }, 60000);
            reg.addEventListener('updatefound', function () {
              var nw = reg.installing;
              if (!nw) return;
              nw.addEventListener('statechange', function () {
                if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                  nw.postMessage('SKIP_WAITING');
                }
              });
            });
          }).catch(function () {});
          // When the new worker takes control, reload once to load the fresh assets.
          var refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', function () {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });
        });
      }
    </script>
`;

// Localise + set a proper title.
html = html.replace('<html lang="en">', '<html lang="it">');
html = html.replace(/<title>[^<]*<\/title>/, "<title>Pescatori di Uomini - Radio Evangelica Cristiana</title>");

// Avoid double-injection on repeat builds.
if (!html.includes('rel="manifest"')) {
  html = html.replace("</head>", `${HEAD_TAGS}</head>`);
}

fs.writeFileSync(indexPath, html, "utf8");
console.log("[inject-pwa] PWA tags + service worker injected into dist/index.html");

// Stamp a unique build id into the exported service worker so every deploy ships
// a byte-different sw.js. This makes the browser detect the update, install the
// new worker, purge the previous version's caches and take control immediately.
const swPath = path.join(dist, "sw.js");
if (fs.existsSync(swPath)) {
  const buildId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let sw = fs.readFileSync(swPath, "utf8");
  sw = sw.split("__BUILD_ID__").join(buildId);
  fs.writeFileSync(swPath, sw, "utf8");
  console.log(`[inject-pwa] Service worker version stamped: pdu-${buildId}`);
} else {
  console.warn("[inject-pwa] dist/sw.js not found — service worker versioning skipped.");
}

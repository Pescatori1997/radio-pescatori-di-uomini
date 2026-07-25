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
          navigator.serviceWorker.register('/sw.js').catch(function () {});
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

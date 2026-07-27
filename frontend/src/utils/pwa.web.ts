// Web-only PWA bootstrap.
// Expo's SPA output ("single") ships a minimal index.html and ignores
// app/+html.tsx, so we inject the PWA <head> tags and register the service
// worker at runtime. Idempotent: if the production build already injected the
// tags (scripts/inject-pwa.js), we skip re-adding them.
export function setupPWA(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const head = document.head;
  const ensure = (selector: string, create: () => HTMLElement) => {
    if (!document.querySelector(selector)) head.appendChild(create());
  };
  const meta = (name: string, content: string) => {
    const m = document.createElement("meta");
    m.setAttribute("name", name);
    m.setAttribute("content", content);
    return m;
  };

  document.documentElement.lang = "it";

  ensure('link[rel="manifest"]', () => {
    const l = document.createElement("link");
    l.rel = "manifest";
    l.href = "/manifest.json";
    return l;
  });
  ensure('meta[name="theme-color"]', () => meta("theme-color", "#0A1128"));
  ensure('meta[name="description"]', () =>
    meta("description", "Radio Evangelica Cristiana - dirette, podcast, meditazioni, notizie e molto altro.")
  );
  ensure('meta[name="application-name"]', () => meta("application-name", "Pescatori di Uomini"));
  ensure('meta[name="mobile-web-app-capable"]', () => meta("mobile-web-app-capable", "yes"));
  ensure('meta[name="apple-mobile-web-app-capable"]', () => meta("apple-mobile-web-app-capable", "yes"));
  ensure('meta[name="apple-mobile-web-app-status-bar-style"]', () =>
    meta("apple-mobile-web-app-status-bar-style", "black-translucent")
  );
  ensure('meta[name="apple-mobile-web-app-title"]', () => meta("apple-mobile-web-app-title", "Pescatori"));
  ensure('link[rel="apple-touch-icon"]', () => {
    const l = document.createElement("link");
    l.rel = "apple-touch-icon";
    l.href = "/icons/apple-touch-icon.png";
    return l;
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          setInterval(() => reg.update().catch(() => {}), 60000);
          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", () => {
              if (nw.state === "installed" && navigator.serviceWorker.controller) {
                nw.postMessage("SKIP_WAITING");
              }
            });
          });
        })
        .catch(() => {});
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }
}

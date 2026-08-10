// Configurable, provider-agnostic Live Player model + helpers.
// The <LivePlayer> component picks a renderer based on `provider`, so new
// providers can be added here WITHOUT touching the UI component.

export type LiveProviderKey = "youtube" | "twitch" | "embed" | "audio" | "none";

export type LivePlayerConfig = {
  provider?: LiveProviderKey;
  source_id?: string;      // YouTube video/live/channel id, Twitch channel, ...
  url?: string;            // full embed URL / audio stream / source URL
  title?: string;
  subtitle?: string;
  cover?: string;          // cover image (base64 or URL)
  external_url?: string;   // "Guarda sulla piattaforma" link
  external_label?: string; // e.g. "Guarda su YouTube"
  next_at?: string;        // ISO datetime of the next scheduled live
  next_title?: string;
  next_cover?: string;
};

export const LIVE_PROVIDERS: { key: LiveProviderKey; label: string; icon: string; color: string; hint: string }[] = [
  { key: "youtube", label: "YouTube", icon: "logo-youtube", color: "#FF0000", hint: "ID video/live oppure URL YouTube" },
  { key: "twitch", label: "Twitch", icon: "logo-twitch", color: "#9146FF", hint: "Nome del canale oppure URL Twitch" },
  { key: "embed", label: "Player personalizzato / Embed URL", icon: "code-slash-outline", color: "#0EA5E9", hint: "URL embed da incorporare (iframe)" },
  { key: "audio", label: "Audio / Radio", icon: "radio-outline", color: "#22C55E", hint: "URL stream audio (mp3/aac)" },
  { key: "none", label: "Nessuna sorgente", icon: "remove-circle-outline", color: "#94A3B8", hint: "Nessun player mostrato" },
];

/** The host domain used as the `parent` for embeds that require it (Twitch). */
export function getEmbedHost(): string {
  try {
    // @ts-ignore — web only
    if (typeof window !== "undefined" && window.location && window.location.hostname) {
      // @ts-ignore
      return window.location.hostname;
    }
  } catch { /* ignore */ }
  try {
    const base = process.env.EXPO_PUBLIC_BACKEND_URL || "";
    const m = base.match(/^https?:\/\/([^/]+)/i);
    if (m) return m[1];
  } catch { /* ignore */ }
  return "localhost";
}

export function extractYouTubeId(input?: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  // Plain 11-char id
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/live\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) { const m = s.match(p); if (m) return m[1]; }
  return null;
}

/** Detect a YouTube channel id (UC...) so we can use the live_stream embed. */
export function extractYouTubeChannel(input?: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(s)) return s;
  const m = s.match(/\/channel\/(UC[A-Za-z0-9_-]{20,})/);
  return m ? m[1] : null;
}

export function extractTwitchChannel(input?: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  const m = s.match(/twitch\.tv\/([A-Za-z0-9_]+)/i);
  if (m) return m[1];
  if (/^[A-Za-z0-9_]{2,}$/.test(s)) return s;
  return null;
}

/** Returns the URL to load inside the iframe/WebView, or null if not embeddable. */
export function buildLiveEmbedUrl(cfg?: LivePlayerConfig | null, host?: string): string | null {
  if (!cfg) return null;
  const h = host || getEmbedHost();
  const provider = cfg.provider || "none";
  const raw = (cfg.source_id || cfg.url || "").trim();

  if (provider === "youtube") {
    const channel = extractYouTubeChannel(raw);
    if (channel) return `https://www.youtube.com/embed/live_stream?channel=${channel}&autoplay=1&playsinline=1&rel=0`;
    const id = extractYouTubeId(raw);
    if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
    return null;
  }
  if (provider === "twitch") {
    const ch = extractTwitchChannel(raw);
    if (!ch) return null;
    return `https://player.twitch.tv/?channel=${ch}&parent=${h}&parent=localhost&autoplay=true&muted=true`;
  }
  if (provider === "embed") {
    return (cfg.url || cfg.source_id || "").trim() || null;
  }
  return null; // audio + none handled separately
}

export function liveIsEmbeddable(cfg?: LivePlayerConfig | null): boolean {
  if (!cfg) return false;
  if (cfg.provider === "audio") return !!(cfg.url && cfg.url.trim());
  return !!buildLiveEmbedUrl(cfg);
}

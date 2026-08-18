// Build an in-app embed URL for public video/audio providers.
export function embedSrc(url: string, provider?: string | null): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if ((provider === "youtube" || (!provider && yt)) && yt)
    return `https://www.youtube.com/embed/${yt[1]}?rel=0&playsinline=1`;
  if (provider === "vimeo") {
    const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  }
  if (provider === "spotify") {
    const sp = url.match(/open\.spotify\.com\/(episode|track|show|playlist|album)\/([A-Za-z0-9]+)/);
    if (sp) return `https://open.spotify.com/embed/${sp[1]}/${sp[2]}`;
  }
  if (provider === "tiktok") {
    const tk = url.match(/\/video\/(\d+)/);
    if (tk) return `https://www.tiktok.com/embed/v2/${tk[1]}`;
  }
  if (provider === "instagram") {
    const ig = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (ig) return `https://www.instagram.com/p/${ig[1]}/embed`;
  }
  if (provider === "facebook") {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  }
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&playsinline=1`;
  return null;
}

export function detectProvider(url: string): string | null {
  const u = (url || "").toLowerCase();
  if (!u) return null;
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("vimeo.com")) return "vimeo";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "facebook";
  if (u.includes("spotify.com")) return "spotify";
  return null;
}

/**
 * Build an embed URL for a LIVE/scheduled stream with autoplay (muted, so
 * browsers/mobile allow autostart; the viewer taps to unmute). When
 * `startSeconds` > 0 the video starts at that offset (time-synced replay).
 * Returns null if not embeddable.
 */
export function liveEmbedSrc(url: string, provider?: string | null, startSeconds = 0): string | null {
  const base = embedSrc(url, provider || detectProvider(url));
  if (!base) return null;
  const start = Math.max(0, Math.floor(startSeconds || 0));
  if (base.includes("youtube.com/embed")) {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}autoplay=1&mute=1${start > 0 ? `&start=${start}` : ""}`;
  }
  if (base.includes("player.vimeo.com")) {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}autoplay=1&muted=1${start > 0 ? `#t=${start}s` : ""}`;
  }
  return base;
}

export const PROVIDER_LABEL: Record<string, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  spotify: "Spotify",
  upload: "File caricato",
};

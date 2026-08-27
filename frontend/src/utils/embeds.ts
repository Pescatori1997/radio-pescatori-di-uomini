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
  if (provider === "twitch") {
    // Twitch requires a `parent` param matching the host of the embedding page.
    // Include the known app hosts + the ACTUAL runtime hostname (web), so it
    // works whatever domain currently serves the app. On native, EmbedFrame
    // wraps the player in an HTML page whose baseUrl host is the first one below.
    const hosts = ["evangelic-stream.emergent.host", "evangelic-stream.preview.emergentagent.com", "localhost"];
    try {
      // @ts-ignore - web only
      const h = typeof window !== "undefined" && window.location && window.location.hostname;
      if (h && !hosts.includes(h)) hosts.push(h);
    } catch {}
    const parents = hosts.map((h) => `parent=${h}`).join("&");
    const vid = url.match(/twitch\.tv\/videos\/(\d+)/);
    if (vid) return `https://player.twitch.tv/?video=${vid[1]}&${parents}&autoplay=true&muted=true`;
    const clip = url.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/) || url.match(/twitch\.tv\/\w+\/clip\/([A-Za-z0-9_-]+)/);
    if (clip) return `https://clips.twitch.tv/embed?clip=${clip[1]}&${parents}&autoplay=true&muted=true`;
    const ch = url.match(/twitch\.tv\/([A-Za-z0-9_]{2,25})/);
    if (ch) return `https://player.twitch.tv/?channel=${ch[1]}&${parents}&autoplay=true&muted=true`;
  }
  if (provider === "restream") {
    // Restream embed player (from Restream "Embed" feature) is already an
    // iframe-ready URL (e.g. https://player.restream.io?token=...): pass through.
    return url;
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
  if (u.includes("twitch.tv")) return "twitch";
  if (u.includes("restream.io")) return "restream";
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
    // Keep the standard controls so viewers can unmute and go fullscreen.
    // On a LIVE stream there is no forward-seek by nature (everyone stays synced).
    return `${base}${sep}autoplay=1&mute=1&modestbranding=1&iv_load_policy=3${start > 0 ? `&start=${start}` : ""}`;
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
  twitch: "Twitch",
  restream: "Restream",
  spotify: "Spotify",
  upload: "File caricato",
};

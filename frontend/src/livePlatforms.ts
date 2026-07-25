// Shared definition of the live-streaming platforms (order matters for display).
export type LivePlatform = {
  key: string;
  label: string;
  icon: string; // Ionicons name
  color: string;
  placeholder: string;
};

export const LIVE_PLATFORMS: LivePlatform[] = [
  { key: "youtube", label: "YouTube", icon: "logo-youtube", color: "#FF0000", placeholder: "https://youtube.com/@canale/live" },
  { key: "facebook", label: "Facebook Live", icon: "logo-facebook", color: "#1877F2", placeholder: "https://facebook.com/.../live" },
  { key: "tiktok", label: "TikTok Live", icon: "logo-tiktok", color: "#000000", placeholder: "https://tiktok.com/@utente/live" },
  { key: "instagram", label: "Instagram Live", icon: "logo-instagram", color: "#E4405F", placeholder: "https://instagram.com/utente/live" },
  { key: "website", label: "Sito Web", icon: "globe-outline", color: "#0EA5E9", placeholder: "https://www.tuosito.it/diretta" },
  { key: "custom", label: "Altro / Custom", icon: "link-outline", color: "#7C3AED", placeholder: "https://..." },
];

// Returns the platforms that currently have a configured (non-empty) URL, in display order.
export function configuredPlatforms(links?: Record<string, string> | null) {
  const l = links || {};
  return LIVE_PLATFORMS
    .map((p) => ({ ...p, url: (l[p.key] || "").trim() }))
    .filter((p) => p.url.length > 0);
}

import React from "react";
import { mediaUrl } from "@/src/api";
import { embedSrc } from "@/src/utils/embeds";
import MeditationVideo from "@/src/components/meditations/MeditationVideo";

// Web renderer: real DOM elements so the user never leaves the app.
export default function MeditationPlayer({
  m, active = true, autoplay = false, fill = false,
}: { m: any; active?: boolean; autoplay?: boolean; fill?: boolean }) {
  const fillStyle: any = { width: "100%", height: "100%", border: 0, backgroundColor: "#000", display: "block" };

  // Fullscreen (TikTok-style) direct video: muted autoplay, no manual play tap.
  if (fill && autoplay) {
    let directUri: string | null = null;
    if (m?.media_id && m?.media_type === "video") directUri = mediaUrl(m.media_id);
    else if (m?.video_url && !embedSrc(m.video_url, m?.provider)) directUri = m.video_url;
    if (directUri) return <MeditationVideo uri={directUri} active={active} poster={m?.thumbnail} />;

    const embed = embedSrc(m?.video_url || "", m?.provider);
    if (embed) {
      const sep = embed.includes("?") ? "&" : "?";
      return (
        <iframe
          data-testid="med-player"
          title={m?.title || "video"}
          src={`${embed}${sep}autoplay=1&mute=1&muted=1&playsinline=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 } as any}
        />
      );
    }
  }

  if (m?.media_id && m?.media_type === "video") {
    return <video data-testid="med-player" src={mediaUrl(m.media_id)} poster={m.thumbnail || undefined} controls playsInline style={fillStyle} />;
  }
  if (m?.media_id && m?.media_type === "audio") {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A1128" }}>
        <audio data-testid="med-player" src={mediaUrl(m.media_id)} controls style={{ width: "90%" }} />
      </div>
    );
  }
  if (m?.media_id && m?.media_type === "pdf") {
    return <iframe data-testid="med-player" title="PDF" src={mediaUrl(m.media_id)} style={fillStyle} />;
  }
  const src = embedSrc(m?.video_url || "", m?.provider);
  if (src) {
    return (
      <iframe
        data-testid="med-player"
        title={m?.title || "video"}
        src={src}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={fillStyle}
      />
    );
  }
  if (m?.video_url) {
    return <video data-testid="med-player" src={m.video_url} poster={m.thumbnail || undefined} controls playsInline style={fillStyle} />;
  }
  return <div style={{ ...fillStyle, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>Contenuto non disponibile</div>;
}

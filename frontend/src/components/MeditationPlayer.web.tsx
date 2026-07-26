import React from "react";
import { mediaUrl } from "@/src/api";
import { embedSrc } from "@/src/utils/embeds";

// Web renderer: real DOM elements so the user never leaves the app.
export default function MeditationPlayer({ m }: { m: any }) {
  const fill: any = { width: "100%", height: "100%", border: 0, backgroundColor: "#000", display: "block" };

  if (m?.media_id && m?.media_type === "video") {
    return <video data-testid="med-player" src={mediaUrl(m.media_id)} poster={m.thumbnail || undefined} controls playsInline style={fill} />;
  }
  if (m?.media_id && m?.media_type === "audio") {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A1128" }}>
        <audio data-testid="med-player" src={mediaUrl(m.media_id)} controls style={{ width: "90%" }} />
      </div>
    );
  }
  if (m?.media_id && m?.media_type === "pdf") {
    return <iframe data-testid="med-player" title="PDF" src={mediaUrl(m.media_id)} style={fill} />;
  }
  const src = embedSrc(m?.video_url || "", m?.provider);
  if (src) {
    return (
      <iframe
        data-testid="med-player"
        src={src}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={fill}
      />
    );
  }
  if (m?.video_url) {
    return <video data-testid="med-player" src={m.video_url} poster={m.thumbnail || undefined} controls playsInline style={fill} />;
  }
  return <div style={{ ...fill, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>Contenuto non disponibile</div>;
}

import React from "react";

/** Web embed player: renders a real DOM iframe with the ready embed URL. */
export default function EmbedFrame({ url, style, testID }: { url: string; style?: any; testID?: string }) {
  return (
    <iframe
      data-testid={testID}
      src={url}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      style={{ width: "100%", height: "100%", border: 0, backgroundColor: "#000", ...(style || {}) }}
    />
  );
}

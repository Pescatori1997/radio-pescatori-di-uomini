import React from "react";

function youtubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// Web (react-native-web) fallback: render a real DOM iframe / video element.
export default function VideoEmbed({ url, testID }: { url: string; testID?: string }) {
  const yt = youtubeId(url);
  const style: any = { width: "100%", height: "100%", border: 0, backgroundColor: "#000" };
  if (yt) {
    return (
      <iframe
        data-testid={testID}
        src={`https://www.youtube.com/embed/${yt}?rel=0&playsinline=1`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={style}
      />
    );
  }
  return <video data-testid={testID} src={url} controls playsInline style={style} />;
}

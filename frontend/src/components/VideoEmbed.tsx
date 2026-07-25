import React from "react";
import { StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";

function youtubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function playerHtml(url: string): string {
  const yt = youtubeId(url);
  const inner = yt
    ? `<iframe src="https://www.youtube.com/embed/${yt}?playsinline=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    : `<video src="${url}" controls playsinline style="width:100%;height:100%"></video>`;
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:#000;height:100%}.w{position:relative;width:100%;height:100%}iframe,video{position:absolute;inset:0;width:100%;height:100%}</style></head><body><div class="w">${inner}</div></body></html>`;
}

export default function VideoEmbed({ url, testID }: { url: string; testID?: string }) {
  return (
    <WebView
      testID={testID}
      source={{ html: playerHtml(url) }}
      style={styles.webview}
      allowsFullscreenVideo
      javaScriptEnabled
      domStorageEnabled
      mediaPlaybackRequiresUserAction={Platform.OS !== "web"}
      originWhitelist={["*"]}
    />
  );
}

const styles = StyleSheet.create({ webview: { flex: 1, backgroundColor: "#000" } });

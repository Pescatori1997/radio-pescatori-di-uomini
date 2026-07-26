import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { WebView } from "react-native-webview";
import { mediaUrl } from "@/src/api";
import { embedSrc } from "@/src/utils/embeds";

function pageHtml(inner: string) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:#000;height:100%;width:100%}.w{position:relative;width:100%;height:100%}iframe,video,audio{position:absolute;inset:0;width:100%;height:100%;border:0}audio{position:static;width:90%;margin:12px auto;display:block}</style></head><body><div class="w">${inner}</div></body></html>`;
}

// Native renderer: everything plays inside a WebView so the user never leaves the app.
export default function MeditationPlayer({ m }: { m: any }) {
  let html: string | null = null;
  let uri: string | null = null;

  if (m?.media_id && m?.media_type === "video") {
    html = pageHtml(`<video src="${mediaUrl(m.media_id)}" ${m.thumbnail ? `poster="${m.thumbnail}"` : ""} controls playsinline webkit-playsinline></video>`);
  } else if (m?.media_id && m?.media_type === "audio") {
    html = pageHtml(`<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#0A1128"><audio src="${mediaUrl(m.media_id)}" controls></audio></div>`);
  } else if (m?.media_id && m?.media_type === "pdf") {
    // Google's viewer renders PDFs reliably inside Android/iOS WebViews.
    uri = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(mediaUrl(m.media_id))}`;
  } else {
    const src = embedSrc(m?.video_url || "", m?.provider);
    if (src) uri = src;
    else if (m?.video_url) html = pageHtml(`<video src="${m.video_url}" controls playsinline webkit-playsinline></video>`);
  }

  if (!html && !uri) {
    return <View style={styles.empty}><Text style={styles.emptyText}>Contenuto non disponibile</Text></View>;
  }

  return (
    <WebView
      testID="med-player"
      source={html ? { html } : { uri: uri! }}
      style={styles.webview}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      javaScriptEnabled
      domStorageEnabled
      mediaPlaybackRequiresUserAction={false}
      originWhitelist={["*"]}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: "#000" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  emptyText: { color: "#94A3B8", fontSize: 13 },
});

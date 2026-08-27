import React from "react";
import { StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";

/** Native embed player: loads a ready embed URL (YouTube/Vimeo/Facebook/...) in a WebView. */
export default function EmbedFrame({ url, style, testID }: { url: string; style?: any; testID?: string }) {
  // Twitch validates its `parent` param against the host of the embedding page.
  // On NATIVE the player URL has no valid parent, so we wrap it in an HTML page
  // whose baseUrl host matches one of the `parent` values. On WEB the page host
  // is already whitelisted, so the direct URL works.
  const isTwitch = url.includes("twitch.tv");
  if (isTwitch && Platform.OS !== "web") {
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${url}" allowfullscreen allow="autoplay; fullscreen"></iframe></body></html>`;
    return (
      <WebView
        testID={testID}
        source={{ html, baseUrl: "https://evangelic-stream.emergent.host" }}
        style={[styles.webview, style]}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
      />
    );
  }
  return (
    <WebView
      testID={testID}
      source={{ uri: url }}
      style={[styles.webview, style]}
      allowsFullscreenVideo
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      originWhitelist={["*"]}
    />
  );
}

const styles = StyleSheet.create({ webview: { flex: 1, backgroundColor: "#000" } });

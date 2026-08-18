import React from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

/** Native embed player: loads a ready embed URL (YouTube/Vimeo/Facebook/...) in a WebView. */
export default function EmbedFrame({ url, style, testID }: { url: string; style?: any; testID?: string }) {
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

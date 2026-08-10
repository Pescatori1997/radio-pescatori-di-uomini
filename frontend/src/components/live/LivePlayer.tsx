import React from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import FishingNetFrame from "@/src/components/live/FishingNetFrame";
import { LivePlayerConfig, buildLiveEmbedUrl } from "@/src/livePlayer";

/**
 * Native renderer for the configurable Live Player. Uses a WebView to host the
 * embeddable providers (YouTube/Twitch/custom embed) and an HTML <audio> for the
 * audio provider. Always wrapped in the fishing-net frame.
 */
export default function LivePlayer({ config, host }: { config: LivePlayerConfig; host?: string }) {
  const provider = config.provider || "none";

  if (provider === "audio" && (config.url || "").trim()) {
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;height:100%;background:#0A1128;display:flex;align-items:center;justify-content:center}audio{width:92%}</style></head><body><audio src="${config.url}" controls autoplay></audio></body></html>`;
    return (
      <FishingNetFrame aspectRatio={16 / 6}>
        <WebView source={{ html }} style={styles.web} mediaPlaybackRequiresUserAction={false} allowsInlineMediaPlayback javaScriptEnabled />
      </FishingNetFrame>
    );
  }

  const src = buildLiveEmbedUrl(config, host);
  if (!src) return <NoSource cover={config.cover} />;

  return (
    <FishingNetFrame>
      <WebView
        source={{ uri: src }}
        style={styles.web}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
      />
    </FishingNetFrame>
  );
}

function NoSource({ cover }: { cover?: string }) {
  return (
    <FishingNetFrame>
      <View style={styles.noSrc}>
        {cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Ionicons name="fish-outline" size={46} color="rgba(255,255,255,0.35)" />
        )}
      </View>
    </FishingNetFrame>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "#000" },
  noSrc: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A1128" },
});

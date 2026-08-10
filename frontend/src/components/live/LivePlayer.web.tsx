import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import FishingNetFrame from "@/src/components/live/FishingNetFrame";
import { LivePlayerConfig, buildLiveEmbedUrl } from "@/src/livePlayer";

/**
 * Web renderer for the configurable Live Player. Uses a native DOM <iframe> for
 * embeddable providers (YouTube/Twitch/custom embed) and a DOM <audio> element
 * for the audio provider. Always wrapped in the fishing-net frame.
 */
export default function LivePlayer({ config, host }: { config: LivePlayerConfig; host?: string }) {
  const provider = config.provider || "none";

  if (provider === "audio" && (config.url || "").trim()) {
    return (
      <FishingNetFrame aspectRatio={16 / 6}>
        <View style={styles.audioWrap}>
          <Ionicons name="radio" size={40} color="#7DD3FC" style={{ marginBottom: 10 }} />
          {React.createElement("audio" as any, {
            src: config.url,
            controls: true,
            autoPlay: true,
            style: { width: "92%" },
          })}
        </View>
      </FishingNetFrame>
    );
  }

  const src = buildLiveEmbedUrl(config, host);
  if (!src) return <NoSource cover={config.cover} />;

  return (
    <FishingNetFrame>
      {React.createElement("iframe" as any, {
        src,
        title: config.title || "Live",
        frameBorder: "0",
        allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
        allowFullScreen: true,
        style: { width: "100%", height: "100%", border: "0", display: "block", background: "#000" },
      })}
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
  audioWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A1128" },
  noSrc: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A1128" },
});

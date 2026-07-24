import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePlayer } from "@/src/context/PlayerContext";
import { colors, spacing, radius } from "@/src/theme";

export default function MiniPlayer({ bottom }: { bottom: number }) {
  const { track, isPlaying, isBuffering, togglePlay } = usePlayer();
  const router = useRouter();
  if (!track) return null;

  return (
    <Pressable
      testID="mini-player"
      onPress={() => router.push("/player")}
      style={[styles.wrapper, { bottom }]}
    >
      <BlurView intensity={80} tint="dark" style={styles.blur}>
        <View style={styles.inner}>
          <Image source={{ uri: track.artwork }} style={styles.art} contentFit="cover" />
          <View style={styles.meta}>
            <View style={styles.titleRow}>
              {track.isLive && (
                <View style={styles.liveDot} />
              )}
              <Text numberOfLines={1} style={styles.title}>
                {track.title}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.artist}>
              {track.artist}
            </Text>
          </View>
          <Pressable testID="mini-player-toggle" onPress={togglePlay} hitSlop={12} style={styles.playBtn}>
            {isBuffering ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name={isPlaying ? "pause" : "play"} size={22} color={colors.white} />
            )}
          </Pressable>
        </View>
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    borderRadius: radius.lg,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  blur: { backgroundColor: "rgba(10,17,40,0.85)" },
  inner: { flexDirection: "row", alignItems: "center", padding: spacing.sm, gap: spacing.md },
  art: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.navyCard },
  meta: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  title: { color: colors.white, fontWeight: "700", fontSize: 14, flexShrink: 1 },
  artist: { color: colors.muted, fontSize: 12, marginTop: 2 },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
});

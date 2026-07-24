import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Share, ScrollView } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer } from "@/src/context/PlayerContext";
import { colors, spacing, radius } from "@/src/theme";

function fmt(s: number) {
  if (!s || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function TouchBar({ value, onSeek, filled }: { value: number; onSeek: (v: number) => void; filled: string }) {
  const [width, setWidth] = useState(1);
  return (
    <Pressable
      testID="touch-bar"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPress={(e) => onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / width)))}
      style={barStyles.track}
    >
      <View style={[barStyles.fill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: filled }]} />
      <View style={[barStyles.thumb, { left: `${Math.max(0, Math.min(1, value)) * 100}%` }]} />
    </Pressable>
  );
}

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { track, isPlaying, isBuffering, togglePlay, volume, setVolume, position, duration, seekTo } = usePlayer();

  if (!track) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>Nessun contenuto in riproduzione</Text>
        <Pressable style={styles.closeEmpty} onPress={() => router.back()}><Text style={styles.closeEmptyText}>Chiudi</Text></Pressable>
      </View>
    );
  }

  const onShare = () => {
    Share.share({ message: `Sto ascoltando "${track.title}" su Pescatori di Uomini 📻` }).catch(() => {});
  };

  const progress = duration > 0 ? position / duration : 0;

  return (
    <View style={styles.container}>
      <Image source={{ uri: track.artwork }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
      <LinearGradient colors={["rgba(10,17,40,0.6)", "rgba(10,17,40,0.98)"]} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.xl }} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable testID="player-close" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-down" size={28} color={colors.white} />
          </Pressable>
          <Text style={styles.topLabel}>{track.isLive ? "DIRETTA RADIO" : "PODCAST"}</Text>
          <Pressable testID="player-share" onPress={onShare} hitSlop={12}>
            <Ionicons name="share-outline" size={24} color={colors.white} />
          </Pressable>
        </View>

        <Image source={{ uri: track.artwork }} style={styles.bigArt} contentFit="cover" />

        <View style={styles.titleRow}>
          {track.isLive && <View style={styles.liveDot} />}
          <Text style={styles.title} numberOfLines={2}>{track.title}</Text>
        </View>
        <Text style={styles.artist}>{track.artist}</Text>

        {track.isLive ? (
          <View style={styles.liveTag}><View style={styles.liveDotSm} /><Text style={styles.liveTagText}>IN DIRETTA</Text></View>
        ) : (
          <View style={styles.progressWrap}>
            <TouchBar value={progress} filled={colors.brandPrimary} onSeek={(v) => seekTo(v * duration)} />
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{fmt(position)}</Text>
              <Text style={styles.timeText}>{fmt(duration)}</Text>
            </View>
          </View>
        )}

        <View style={styles.controls}>
          <Pressable testID="player-main-toggle" style={styles.mainBtn} onPress={togglePlay}>
            <Ionicons name={isBuffering ? "hourglass" : isPlaying ? "pause" : "play"} size={34} color={colors.navy} />
          </Pressable>
        </View>

        <View style={styles.volumeRow}>
          <Ionicons name="volume-low" size={20} color={colors.white} />
          <View style={{ flex: 1 }}>
            <TouchBar value={volume} filled={colors.white} onSeek={setVolume} />
          </View>
          <Ionicons name="volume-high" size={20} color={colors.white} />
        </View>
      </ScrollView>
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: { height: 20, justifyContent: "center" },
  fill: { position: "absolute", left: 0, height: 5, borderRadius: 3, top: 7.5 },
  thumb: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFF", marginLeft: -7, top: 3 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  center: { alignItems: "center", justifyContent: "center" },
  emptyText: { color: colors.white, fontSize: 16 },
  closeEmpty: { marginTop: spacing.lg, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill },
  closeEmptyText: { color: colors.white, fontWeight: "700" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xl },
  topLabel: { color: colors.brandSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  bigArt: { width: "100%", aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.navyCard, alignSelf: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xl },
  liveDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success },
  title: { color: colors.white, fontSize: 26, fontWeight: "800", flex: 1 },
  artist: { color: colors.muted, fontSize: 16, marginTop: spacing.xs },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(16,185,129,0.15)", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, marginTop: spacing.xl },
  liveDotSm: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveTagText: { color: colors.success, fontSize: 12, fontWeight: "700" },
  progressWrap: { marginTop: spacing.xl },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  timeText: { color: colors.muted, fontSize: 12 },
  controls: { alignItems: "center", marginTop: spacing["2xl"] },
  mainBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  volumeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing["2xl"] },
});

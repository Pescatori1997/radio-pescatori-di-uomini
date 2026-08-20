import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Share, ScrollView, PanResponder } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer } from "@/src/context/PlayerContext";
import { useSiteText } from "@/src/context/SiteTextsContext";
import PressableScale from "@/src/components/PressableScale";
import LiveListeners from "@/src/components/community/LiveListeners";
import { colors, spacing, radius } from "@/src/theme";

function fmt(s: number) {
  if (!s || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Format a unix (seconds) timestamp to a local HH:MM string. */
function playedTime(ts?: number) {
  if (!ts) return "";
  try {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function TouchBar({ value, onSeek, filled }: { value: number; onSeek: (v: number) => void; filled: string }) {
  const widthRef = useRef(1);
  const [, force] = useState(0);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const seekAt = (x: number) => onSeek(clamp(x / widthRef.current));

  // PanResponder so the bar responds to a tap AND to dragging (grab the thumb
  // and slide) on both web and native — the previous tap-only bar felt "fake".
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => seekAt(e.nativeEvent.locationX),
      onPanResponderMove: (e) => seekAt(e.nativeEvent.locationX),
    })
  ).current;

  const pct = clamp(value) * 100;
  return (
    <View
      testID="touch-bar"
      onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width || 1; force((n) => n + 1); }}
      style={[barStyles.track, { cursor: "pointer" } as any]}
      {...pan.panHandlers}
    >
      <View style={barStyles.rail} />
      <View style={[barStyles.fill, { width: `${pct}%`, backgroundColor: filled }]} />
      <View style={[barStyles.thumb, { left: `${pct}%` }]} />
    </View>
  );
}

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { track, isPlaying, isBuffering, togglePlay, volume, setVolume, position, duration, seekTo, liveInfo, connection } = usePlayer();

  const { st } = useSiteText();

  if (!track) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>{st("player", "empty")}</Text>
        <Pressable style={styles.closeEmpty} onPress={() => router.back()}><Text style={styles.closeEmptyText}>{st("player", "close")}</Text></Pressable>
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
          <Text style={styles.topLabel}>{track.isLive ? st("player", "top_label_live") : st("player", "top_label_podcast")}</Text>
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
          <View>
            <View style={[styles.liveTag, connection === "reconnecting" ? styles.tagWarn : connection === "offline" ? styles.tagErr : null]}>
              <View style={[styles.liveDotSm, connection === "reconnecting" ? { backgroundColor: colors.warning } : connection === "offline" ? { backgroundColor: colors.error } : null]} />
              <Text style={[styles.liveTagText, connection === "reconnecting" ? { color: colors.warning } : connection === "offline" ? { color: colors.error } : null]}>
                {connection === "reconnecting" ? st("player", "tag_reconnecting") : connection === "offline" ? st("player", "tag_offline") : st("player", "tag_live")}
              </Text>
            </View>
            {typeof liveInfo?.listeners === "number" && liveInfo.listeners > 0 && (
              <View style={styles.listenersRow}>
                <Ionicons name="people" size={15} color={colors.brandSecondary} />
                <Text style={styles.listenersText}>{liveInfo.listeners} in ascolto</Text>
              </View>
            )}
            {isPlaying && <LiveListeners />}
          </View>
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
          <PressableScale testID="player-main-toggle" style={styles.mainBtn} onPress={togglePlay}>
            <Ionicons name={isBuffering ? "hourglass" : isPlaying ? "pause" : "play"} size={34} color={colors.navy} />
          </PressableScale>
        </View>

        <View style={styles.volumeRow}>
          <Ionicons name="volume-low" size={20} color={colors.white} />
          <View style={{ flex: 1 }}>
            <TouchBar value={volume} filled={colors.white} onSeek={setVolume} />
          </View>
          <Ionicons name="volume-high" size={20} color={colors.white} />
        </View>

        {track.isLive && (
          <View style={styles.liveExtra}>
            {/* In onda adesso */}
            {!!liveInfo?.current_program && (
              <View style={styles.infoCard}>
                <View style={styles.infoHead}>
                  <Ionicons name="radio" size={15} color={colors.brandSecondary} />
                  <Text style={styles.infoLabel}>{st("player", "on_air_now")}</Text>
                </View>
                <Text style={styles.infoTitle} numberOfLines={1}>{liveInfo.current_program.title}</Text>
                {!!liveInfo.current_program.host && (
                  <Text style={styles.infoSub} numberOfLines={1}>{liveInfo.current_program.host}</Text>
                )}
                {!!liveInfo.current_program.start_time && (
                  <Text style={styles.infoTime}>{liveInfo.current_program.start_time} – {liveInfo.current_program.end_time}</Text>
                )}
              </View>
            )}

            {/* In onda dopo — prefer the queued track, else the next scheduled program */}
            <View style={styles.infoCard}>
              <View style={styles.infoHead}>
                <Ionicons name="play-forward" size={15} color={colors.brandSecondary} />
                <Text style={styles.infoLabel}>{st("player", "on_air_next")}</Text>
              </View>
              {liveInfo?.playing_next?.title || liveInfo?.playing_next?.artist ? (
                <>
                  <Text style={styles.infoTitle} numberOfLines={1}>{liveInfo.playing_next.title || "Brano"}</Text>
                  {!!liveInfo.playing_next.artist && <Text style={styles.infoSub} numberOfLines={1}>{liveInfo.playing_next.artist}</Text>}
                </>
              ) : liveInfo?.next_program ? (
                <>
                  <Text style={styles.infoTitle} numberOfLines={1}>{liveInfo.next_program.title}</Text>
                  {!!liveInfo.next_program.host && <Text style={styles.infoSub} numberOfLines={1}>{liveInfo.next_program.host}</Text>}
                  {!!liveInfo.next_program.start_time && (
                    <Text style={styles.infoTime}>
                      {(liveInfo.next_program.weekdays?.[0] ? liveInfo.next_program.weekdays[0] + " · " : "")}{liveInfo.next_program.start_time}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.infoEmpty}>{st("player", "no_data")}</Text>
              )}
            </View>

            {/* Cronologia brani recenti */}
            <View style={styles.historyWrap}>
              <View style={styles.infoHead}>
                <Ionicons name="time-outline" size={16} color={colors.brandSecondary} />
                <Text style={styles.infoLabel}>{st("player", "recent_songs")}</Text>
              </View>
              {liveInfo?.song_history && liveInfo.song_history.length > 0 ? (
                liveInfo.song_history.map((h, i) => (
                  <View key={i} style={styles.histRow}>
                    <View style={styles.histIcon}>
                      <Ionicons name="musical-note" size={16} color={colors.brandSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.histTitle} numberOfLines={1}>{h.title || "Brano"}</Text>
                      {!!h.artist && <Text style={styles.histArtist} numberOfLines={1}>{h.artist}</Text>}
                    </View>
                    {!!playedTime(h.played_at) && <Text style={styles.histTime}>{playedTime(h.played_at)}</Text>}
                  </View>
                ))
              ) : (
                <View style={styles.emptyBox}>
                  <Ionicons name="musical-notes-outline" size={22} color={colors.muted} />
                  <Text style={styles.infoEmpty}>{st("player", "no_data")}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: { height: 28, justifyContent: "center" },
  rail: { position: "absolute", left: 0, right: 0, height: 5, borderRadius: 3, top: 11.5, backgroundColor: "rgba(255,255,255,0.25)" },
  fill: { position: "absolute", left: 0, height: 5, borderRadius: 3, top: 11.5 },
  thumb: { position: "absolute", width: 16, height: 16, borderRadius: 8, backgroundColor: "#FFF", marginLeft: -8, top: 6 },
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
  tagWarn: { backgroundColor: "rgba(245,158,11,0.15)" },
  tagErr: { backgroundColor: "rgba(239,68,68,0.15)" },
  liveDotSm: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveTagText: { color: colors.success, fontSize: 12, fontWeight: "700" },
  listenersRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  listenersText: { color: colors.brandSecondary, fontSize: 13, fontWeight: "600" },
  progressWrap: { marginTop: spacing.xl },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  timeText: { color: colors.muted, fontSize: 12 },
  controls: { alignItems: "center", marginTop: spacing["2xl"] },
  mainBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  volumeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing["2xl"] },
  liveExtra: { marginTop: spacing["2xl"], gap: spacing.md },
  infoCard: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.12)" },
  infoHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  infoLabel: { color: colors.brandSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  infoTitle: { color: colors.white, fontSize: 16, fontWeight: "700" },
  infoSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  infoTime: { color: colors.brandSecondary, fontSize: 12, fontWeight: "600", marginTop: 4 },
  infoEmpty: { color: colors.muted, fontSize: 13, fontStyle: "italic" },
  historyWrap: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.12)" },
  histRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.08)" },
  histIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  histTitle: { color: colors.white, fontSize: 14, fontWeight: "600" },
  histArtist: { color: colors.muted, fontSize: 12, marginTop: 1 },
  histTime: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  emptyBox: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.lg, gap: 6 },
});

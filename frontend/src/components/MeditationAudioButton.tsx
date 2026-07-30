import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

/** Minimal "Ascolta la meditazione" player. Only rendered when audio is available. */
export default function MeditationAudioButton({ audioUrl }: { audioUrl: string }) {
  const player = useAudioPlayer({ uri: audioUrl });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    return () => {
      try { player.pause(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (status?.didJustFinish) {
      try { player.seekTo(0); player.pause(); } catch {}
    }
  }, [status?.didJustFinish]);

  const playing = !!status?.playing;
  const duration = status?.duration || 0;
  const current = status?.currentTime || 0;
  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  const toggle = () => {
    if (playing) player.pause();
    else player.play();
  };

  return (
    <PressableScale testID="meditation-audio" style={styles.wrap} onPress={toggle}>
      <View style={styles.playBtn}>
        <Ionicons name={playing ? "pause" : "play"} size={20} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>Ascolta la meditazione</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>
      <Ionicons name="volume-medium" size={18} color={colors.brandPrimary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  playBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  label: { color: colors.onBrandTertiary, fontSize: 14, fontWeight: "800" },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 8, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.brandPrimary },
});

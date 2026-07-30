import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { api } from "@/src/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FishingNet, SeaWaves, SunriseGlow, LightRays, Bubbles } from "@/src/components/marine";
import ShareVerseSheet from "@/src/components/ShareVerseSheet";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function VerseOfDayCard() {
  const router = useRouter();
  const [verse, setVerse] = useState<any>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    api.verseToday()
      .then((v: any) => { setVerse(v); AsyncStorage.setItem("votd_cache", JSON.stringify(v)).catch(() => {}); })
      .catch(async () => {
        const c = await AsyncStorage.getItem("votd_cache").catch(() => null);
        if (c) setVerse(JSON.parse(c));
      });
  }, []);

  // Slow shimmer on the card border.
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const borderStyle = useAnimatedStyle(() => ({ opacity: interpolate(glow.value, [0, 1], [0.25, 0.7]) }));

  if (!verse) return null;

  const openContext = () => {
    router.push({ pathname: "/bibbia", params: { verseId: verse.id } } as any);
  };

  return (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.wrap}>
      <View style={styles.card} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <LinearGradient colors={["#0B2A4A", "#0A1B3A", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {size.w > 0 && (
          <>
            <SunriseGlow width={size.w} height={size.h} />
            <LightRays width={size.w} height={size.h} />
            <FishingNet width={size.w} height={size.h} gap={26} opacity={0.06} />
            <SeaWaves width={size.w} height={Math.min(90, size.h * 0.4)} />
            <Bubbles height={size.h} count={7} />
          </>
        )}
        {/* animated glowing border */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glowBorder, borderStyle]} />

        <View style={styles.content}>
          <View style={styles.labelRow}>
            <View style={styles.iconBadge}><Text style={styles.iconEmoji}>📖</Text></View>
            <Text style={styles.label}>Versetto del Giorno</Text>
            <PressableScale testID="verse-share" style={styles.shareIcon} onPress={() => setShareOpen(true)}>
              <Ionicons name="share-social-outline" size={18} color={colors.white} />
            </PressableScale>
          </View>

          <Text style={styles.verseText}>“{verse.text}”</Text>

          <View style={styles.refRow}>
            <View style={styles.refLine} />
            <Text style={styles.reference}>{verse.reference}</Text>
          </View>

          <PressableScale testID="verse-read-context" style={styles.btn} onPress={openContext}>
            <Ionicons name="book-outline" size={18} color={colors.navy} />
            <Text style={styles.btnText}>Leggi il contesto</Text>
          </PressableScale>
        </View>
      </View>
      <ShareVerseSheet verse={verse} visible={shareOpen} onClose={() => setShareOpen(false)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing["2xl"],
    borderRadius: radius.lg,
    shadowColor: colors.navy,
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 9,
  },
  card: { borderRadius: radius.lg, overflow: "hidden", minHeight: 220 },
  glowBorder: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brandSecondary },
  content: { padding: spacing.xl },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  shareIcon: { marginLeft: "auto", width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  iconBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(251,191,36,0.18)", borderWidth: 1, borderColor: "rgba(251,191,36,0.4)", alignItems: "center", justifyContent: "center" },
  iconEmoji: { fontSize: 16 },
  label: { color: "#FDE68A", fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  verseText: { color: colors.white, fontSize: 20, fontWeight: "700", fontStyle: "italic", lineHeight: 30, marginTop: spacing.lg, letterSpacing: 0.2 },
  refRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  refLine: { width: 24, height: 2, borderRadius: 1, backgroundColor: colors.brandSecondary },
  reference: { color: colors.brandSecondary, fontSize: 14, fontWeight: "800" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.white, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.xl },
  btnText: { color: colors.navy, fontSize: 15, fontWeight: "800" },
});

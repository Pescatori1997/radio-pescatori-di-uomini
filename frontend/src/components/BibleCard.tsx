import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
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
import { FishingNet, SeaWaves, SunriseGlow, Bubbles } from "@/src/components/marine";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const LOGO = require("@/assets/images/logo.png");

/**
 * Dedicated, high-visibility Home card that presents Bible reading as a primary
 * feature of the app. Coordinated with the "Pescatori di Uomini" marine theme:
 * sea waves, transparent fishing net, radio logo watermark and an open Bible.
 */
export default function BibleCard({ inGrid = false }: { inGrid?: boolean }) {
  const router = useRouter();
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Gentle glow shimmer on the card border.
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const borderStyle = useAnimatedStyle(() => ({ opacity: interpolate(glow.value, [0, 1], [0.2, 0.6]) }));

  return (
    <Animated.View entering={FadeInDown.duration(500)} style={[styles.wrap, inGrid && styles.wrapGrid]}>
      <View
        style={[styles.card, inGrid && styles.cardGrid]}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <LinearGradient
          colors={["#0B2A4A", "#0A1B3A", "#0A1128"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {size.w > 0 && (
          <>
            <SunriseGlow width={size.w} height={size.h} />
            <FishingNet width={size.w} height={size.h} gap={26} opacity={0.06} />
            <SeaWaves width={size.w} height={Math.min(90, size.h * 0.45)} />
            <Bubbles height={size.h} count={6} />
          </>
        )}

        {/* Radio logo watermark (bottom-right, very subtle). */}
        <Image source={LOGO} style={styles.watermark} contentFit="contain" />

        {/* Animated glowing border. */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glowBorder, borderStyle]} />

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.bookBadge}>
              <Ionicons name="book" size={26} color={colors.navy} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>📚 Leggi la Bibbia</Text>
              <Text style={styles.subtitle}>La Parola di Dio, sempre con te.</Text>
            </View>
          </View>

          <PressableScale testID="home-open-bible" style={styles.btn} onPress={() => router.push("/lettore")}>
            <Text style={styles.btnText}>📖 Apri la Bibbia</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.navy} />
          </PressableScale>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    shadowColor: colors.navy,
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 9,
  },
  card: { borderRadius: radius.lg, overflow: "hidden", minHeight: 180 },
  wrapGrid: { flex: 1, marginHorizontal: 0, marginTop: 0 },
  cardGrid: { flex: 1 },
  glowBorder: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brandSecondary },
  watermark: { position: "absolute", right: -18, bottom: -12, width: 130, height: 130, opacity: 0.09 },
  content: { padding: spacing.xl },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bookBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#FDE68A",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: { color: colors.white, fontSize: 21, fontWeight: "800", letterSpacing: 0.2 },
  subtitle: { color: colors.brandTertiary, fontSize: 14, fontWeight: "600", marginTop: 4 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    marginTop: spacing.xl,
  },
  btnText: { color: colors.navy, fontSize: 16, fontWeight: "800" },
});

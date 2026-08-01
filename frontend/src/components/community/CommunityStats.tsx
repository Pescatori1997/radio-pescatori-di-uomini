import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, AccessibilityInfo, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

/**
 * Count-up animation, brief & elegant, honoring prefers-reduced-motion.
 * JS/rAF driven (works on web + native) and cheap (updates one Text node).
 */
export function AnimatedCounter({ value, duration = 1100, style }: { value: number; duration?: number; style?: any }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    let start: number | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced || value <= 0) { setDisplay(value); return; }
      const step = (ts: number) => {
        if (start === null) start = ts;
        const p = Math.min(1, (ts - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(Math.round(eased * value));
        if (p < 1 && !cancelled) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    });
    return () => { cancelled = true; if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, duration]);
  return <Text style={style}>{display.toLocaleString("it-IT")}</Text>;
}

/**
 * Home community social-proof band. All numbers are REAL and aggregated
 * (members / active today / new this week). Hidden until data loads — never
 * shows placeholder/invented values.
 */
export default function CommunityStats() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<{ members: number; active_today: number; new_this_week: number } | null>(null);

  useEffect(() => {
    api.communityStats().then(setStats).catch(() => {});
  }, []);

  if (!stats || stats.members <= 0) return null;

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Una comunità che cresce insieme</Text>
        <Ionicons name="heart" size={16} color={colors.error} />
      </View>
      <View style={styles.row}>
        <View style={styles.stat}>
          <AnimatedCounter value={stats.members} style={styles.big} />
          <Text style={styles.label}>membri</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <View style={styles.activeRow}>
            <View style={styles.pulseDot} />
            <AnimatedCounter value={stats.active_today} style={styles.big} />
          </View>
          <Text style={styles.label}>attivi oggi</Text>
        </View>
      </View>
      {stats.new_this_week > 0 && (
        <Text style={styles.newLine}>🔥 +{stats.new_this_week} nuovi membri questa settimana</Text>
      )}
      {!user && (
        <Pressable testID="community-join" onPress={() => router.push("/login?mode=register")} hitSlop={4} style={styles.cta}>
          <Text style={styles.ctaText}>Fai parte della community</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.brandPrimary} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    backgroundColor: colors.brandTertiary, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: "rgba(14,165,233,0.25)",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  title: { color: colors.onBrandTertiary, fontSize: 14, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, alignItems: "center" },
  divider: { width: 1, height: 40, backgroundColor: "rgba(2,132,199,0.2)" },
  big: { color: colors.navy, fontSize: 28, fontWeight: "800", letterSpacing: 0.3 },
  label: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600", marginTop: 2 },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  newLine: { color: colors.onBrandTertiary, fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: spacing.md },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.md },
  ctaText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800" },
});

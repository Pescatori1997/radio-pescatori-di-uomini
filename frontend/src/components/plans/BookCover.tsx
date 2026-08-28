import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import PressableScale from "@/src/components/PressableScale";
import { colors, radius } from "@/src/theme";

const serif = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, 'Times New Roman', serif" });

// Warm fallback covers (used when a plan has no cover image), varied by title.
const FALLBACKS: [string, string][] = [
  ["#2A3B52", "#0E1A2C"],
  ["#4A3B2A", "#241A0F"],
  ["#3A2F45", "#1A1226"],
  ["#2A4540", "#0F211D"],
  ["#4A2E2E", "#241111"],
  ["#2E3A4A", "#12202E"],
];
const pick = (s: string) => FALLBACKS[[...(s || "x")].reduce((a, c) => a + c.charCodeAt(0), 0) % FALLBACKS.length];

type Props = {
  plan: any;
  width?: number;
  onPress: () => void;
  enrolled?: boolean;
  percent?: number;
  completed?: boolean;
  testID?: string;
  style?: any;
};

export default function BookCover({ plan, width = 128, onPress, enrolled, percent = 0, completed, testID, style }: Props) {
  const height = Math.round(width * 1.34);
  const [c1, c2] = pick(plan.title);
  return (
    <PressableScale testID={testID} onPress={onPress} style={[styles.wrap, { width, height }, style]}>
      <View style={styles.book}>
        {plan.cover ? (
          <>
            <Image source={{ uri: plan.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.55)"]} style={styles.bottomFade} />
            <Text style={styles.days}>{plan.duration_days} GIORNI</Text>
          </>
        ) : (
          <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
            <View style={styles.fallbackInner}>
              <Text numberOfLines={4} style={styles.fbTitle}>{plan.title}</Text>
              <View style={styles.fbRule} />
              <Text style={styles.fbDays}>{plan.duration_days} GIORNI</Text>
            </View>
          </LinearGradient>
        )}
        {/* Spine highlight (3D book) */}
        <LinearGradient colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.spine} pointerEvents="none" />
        <View style={styles.spineDark} pointerEvents="none" />
        {enrolled && (
          <View style={[styles.badge, completed && styles.badgeDone]}>
            {completed ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={styles.badgeText}>{percent}%</Text>}
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { marginRight: 16 },
  book: {
    flex: 1, borderRadius: 6, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, overflow: "hidden", backgroundColor: colors.navy,
    ...Platform.select({ web: { boxShadow: "6px 10px 18px rgba(0,0,0,0.5)" } as any, default: { shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 4, height: 8 }, elevation: 8 } }),
  },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 10 },
  spineDark: { position: "absolute", left: 0, top: 0, bottom: 0, width: 2, backgroundColor: "rgba(0,0,0,0.35)" },
  bottomFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 44 },
  days: { position: "absolute", bottom: 7, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.9)", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  fallbackInner: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingLeft: 14 },
  fbTitle: { color: "#F3E7CE", fontSize: 15, fontWeight: "800", textAlign: "center", fontFamily: serif, lineHeight: 19 },
  fbRule: { width: 26, height: 1, backgroundColor: "rgba(243,231,206,0.5)", marginTop: 8 },
  fbDays: { position: "absolute", bottom: 8, color: "rgba(243,231,206,0.75)", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  badge: { position: "absolute", top: 6, right: 6, minWidth: 26, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  badgeDone: { backgroundColor: "#22A559" },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },
});

import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions, AccessibilityInfo } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, interpolate, Extrapolation, useReducedMotion,
} from "react-native-reanimated";
import { tierStyle } from "./wood";
import type { Achievement } from "./Medal";

const LOGO = require("@/assets/images/logo-badge.png");

function formatDate(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  } catch { return ""; }
}

/**
 * Fullscreen in-tree overlay (NOT a native Modal — avoids the iOS background
 * freeze issue). The tapped medal detaches, floats to the foreground and
 * rotates in 3D to reveal its back with the earned stats. Tap to flip; tap the
 * backdrop or X to close.
 */
export default function MedalDetailOverlay({ a, onClose }: { a: Achievement; onClose: () => void }) {
  const reduce = useReducedMotion();
  const flip = useSharedValue(0); // 0 = front, 1 = back
  const enter = useSharedValue(0);
  const t = tierStyle(a.tier);
  const W = Math.min(Dimensions.get("window").width - 64, 300);

  useEffect(() => {
    let reduced = reduce;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      reduced = reduced || r;
      enter.value = reduced ? 1 : withSpring(1, { damping: 14, stiffness: 120 });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => { flip.value = withTiming(flip.value > 0.5 ? 0 : 1, { duration: reduce ? 0 : 520 }); };

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: interpolate(enter.value, [0, 1], [0.6, 1], Extrapolation.CLAMP) }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    opacity: flip.value < 0.5 ? 1 : 0,
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    opacity: flip.value >= 0.5 ? 1 : 0,
  }));

  const inner = Math.round(W * 0.5);
  const earned = a.earned;

  const Face = ({ children }: { children: React.ReactNode }) => (
    <View style={[styles.card, { width: W, minHeight: W * 1.28 }]}>
      <LinearGradient colors={["#FFFFFF", "#F1F5F9"]} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <View style={styles.backdrop} />
      </Pressable>

      <Animated.View style={[enterStyle, { width: W }]} pointerEvents="box-none">
        <Pressable onPress={toggle}>
          <View style={{ width: W, minHeight: W * 1.28 }}>
            {/* FRONT */}
            <Animated.View style={[styles.faceWrap, frontStyle]}>
              <Face>
                <View style={[styles.catPill, { backgroundColor: t.edge }]}><Text style={styles.catPillText}>{a.category}</Text></View>
                <View style={{ alignItems: "center", marginTop: 10 }}>
                  {earned && <View style={[styles.bigGlow, { backgroundColor: t.glow, width: W * 0.72, height: W * 0.72, borderRadius: W * 0.36 }]} />}
                  <View style={[styles.bigRing, { width: W * 0.62, height: W * 0.62, borderRadius: W * 0.31, borderColor: earned ? t.edge : "#9CA3AF" }]}>
                    <LinearGradient colors={earned ? t.ring : ["#B6BDC8", "#6B7280"]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: W * 0.31 }]} />
                    <View style={[styles.bigDisc, { width: inner, height: inner, borderRadius: inner / 2 }]}>
                      {a.image ? (
                        <Image source={{ uri: a.image }} style={{ width: inner * 0.9, height: inner * 0.9, borderRadius: (inner * 0.9) / 2 }} contentFit="cover" />
                      ) : (
                        <Image source={LOGO} style={{ width: inner * 0.82, height: inner * 0.82 }} contentFit="contain" />
                      )}
                    </View>
                    {!earned && <View style={[StyleSheet.absoluteFill, styles.lockBig, { borderRadius: W * 0.31 }]}><Ionicons name="lock-closed" size={W * 0.16} color="rgba(255,255,255,0.92)" /></View>}
                  </View>
                </View>
                <Text style={styles.title}>{a.title}</Text>
                <View style={[styles.tierChip, { backgroundColor: t.ring[1] }]}><Text style={styles.tierChipText}>{t.label}</Text></View>
                <View style={styles.flipHint}><Ionicons name="sync" size={14} color="#64748B" /><Text style={styles.flipHintText}>Tocca per girare</Text></View>
              </Face>
            </Animated.View>

            {/* BACK */}
            <Animated.View style={[styles.faceWrap, styles.faceAbsolute, backStyle]}>
              <Face>
                <View style={[styles.catPill, { backgroundColor: t.edge }]}><Text style={styles.catPillText}>{a.category}</Text></View>
                <Text style={styles.backTitle}>{a.title}</Text>
                <View style={styles.statBox}>
                  <Text style={[styles.statNum, { color: t.edge }]}>{a.count}</Text>
                  <Text style={styles.statLabel}>{a.back_label || "Progresso"}</Text>
                </View>
                {!!a.description && <Text style={styles.desc}>{a.description}</Text>}
                {earned ? (
                  <View style={styles.earnedRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={styles.earnedText}>Ottenuto{a.earned_at ? ` il ${formatDate(a.earned_at)}` : ""}</Text>
                  </View>
                ) : a.metric !== "manual" ? (
                  <View style={{ marginTop: 16, width: "100%" }}>
                    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${a.progress}%`, backgroundColor: t.ring[1] }]} /></View>
                    <Text style={styles.progressText}>{a.count} / {a.threshold} — {a.progress}%</Text>
                  </View>
                ) : (
                  <View style={styles.earnedRow}><Ionicons name="time-outline" size={16} color="#64748B" /><Text style={styles.lockedText}>Non ancora ottenuto</Text></View>
                )}
                <View style={styles.flipHint}><Ionicons name="sync" size={14} color="#64748B" /><Text style={styles.flipHintText}>Tocca per girare</Text></View>
              </Face>
            </Animated.View>
          </View>
        </Pressable>

        <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} testID="medal-close">
          <Ionicons name="close" size={22} color="#0A1128" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 200, padding: 32 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,10,24,0.82)" },
  faceWrap: { backfaceVisibility: "hidden" },
  faceAbsolute: { position: "absolute", top: 0, left: 0, right: 0 },
  card: {
    borderRadius: 24, padding: 22, alignItems: "center", overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 14 },
  },
  catPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  catPillText: { color: "#FFF9EC", fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  bigGlow: { position: "absolute", top: 6 },
  bigRing: { alignItems: "center", justifyContent: "center", borderWidth: 4, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  bigDisc: { backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(0,0,0,0.1)" },
  lockBig: { backgroundColor: "rgba(20,20,25,0.4)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 21, fontWeight: "800", color: "#0A1128", textAlign: "center", marginTop: 16 },
  tierChip: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999 },
  tierChipText: { color: "#3A2510", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  flipHint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 18 },
  flipHintText: { color: "#64748B", fontSize: 12, fontWeight: "600" },
  backTitle: { fontSize: 18, fontWeight: "800", color: "#0A1128", textAlign: "center", marginTop: 14 },
  statBox: { alignItems: "center", marginTop: 16 },
  statNum: { fontSize: 52, fontWeight: "900", letterSpacing: -1 },
  statLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginTop: -2 },
  desc: { fontSize: 14.5, lineHeight: 21, color: "#334155", textAlign: "center", marginTop: 14 },
  earnedRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 16 },
  earnedText: { color: "#0F766E", fontSize: 13.5, fontWeight: "700" },
  lockedText: { color: "#64748B", fontSize: 13.5, fontWeight: "600" },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: "#E2E8F0", overflow: "hidden" },
  progressFill: { height: 10, borderRadius: 5 },
  progressText: { color: "#475569", fontSize: 12.5, fontWeight: "700", textAlign: "center", marginTop: 8 },
  closeBtn: { position: "absolute", top: -14, right: -6, width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
});

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import PressableScale from "@/src/components/PressableScale";
import { tierStyle } from "./wood";

const LOGO = require("@/assets/images/logo-badge.png");

export type Achievement = {
  id: string;
  title: string;
  description?: string;
  category: string;
  tier: string;
  emoji?: string;
  image?: string | null;
  earned: boolean;
  earned_at?: string | null;
  count: number;
  threshold?: number;
  progress: number;
  metric?: string;
  back_label?: string;
};

/**
 * A single medal hanging from a small brass hook by a tier-coloured ribbon.
 * Earned medals glow softly and show the logo emblem; locked ones are dimmed
 * with a subtle progress hint, encouraging the walk without a game-y feel.
 */
export default function Medal({
  a,
  size = 84,
  onPress,
}: {
  a: Achievement;
  size?: number;
  onPress?: () => void;
}) {
  const t = tierStyle(a.tier);
  const earned = a.earned;
  const ribbonColor = earned ? t.ring[1] : "#6B7280";
  const inner = Math.round(size * 0.62);

  return (
    <PressableScale style={[styles.slot, { width: size + 20 }]} onPress={onPress} testID={`medal-${a.id}`}>
      {/* brass hook peg */}
      <View style={styles.peg}>
        <View style={styles.pegBar} />
        <View style={styles.pegHole} />
      </View>
      {/* ribbon */}
      <View style={[styles.ribbon, { backgroundColor: ribbonColor, opacity: earned ? 1 : 0.5 }]} />
      <View style={[styles.ribbonNotchWrap]}>
        <View style={[styles.ribbonNotch, { borderTopColor: ribbonColor, opacity: earned ? 1 : 0.5 }]} />
      </View>

      {/* medal disc */}
      <View style={{ width: size + 14, height: size + 14, alignItems: "center", justifyContent: "center" }}>
        {earned && <View style={[styles.glow, StyleSheet.absoluteFillObject, { borderRadius: (size + 14) / 2, backgroundColor: t.glow }]} />}
        <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: earned ? t.edge : "#4B5563" }]}>
          <LinearGradient
            colors={earned ? t.ring : ["#9AA3AF", "#5B6472"]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          />
          {/* notches around the rim for a coin feel */}
          <View style={[styles.disc, { width: inner, height: inner, borderRadius: inner / 2 }]}>
            {a.image ? (
              <Image source={{ uri: a.image }} style={{ width: inner * 0.9, height: inner * 0.9, borderRadius: (inner * 0.9) / 2 }} contentFit="cover" />
            ) : (
              <Image source={LOGO} style={{ width: inner * 0.82, height: inner * 0.82 }} contentFit="contain" />
            )}
          </View>
          {!earned && (
            <View style={[StyleSheet.absoluteFill, styles.lockOverlay, { borderRadius: size / 2 }]}>
              <Ionicons name="lock-closed" size={size * 0.26} color="rgba(255,255,255,0.9)" />
            </View>
          )}
        </View>
      </View>

      {/* tier plaque under the medal */}
      <View style={[styles.tierTag, { backgroundColor: earned ? t.edge : "rgba(0,0,0,0.3)" }]}>
        <Text style={styles.tierText}>{earned ? t.label.toUpperCase() : (a.metric === "manual" ? "DA OTTENERE" : `${a.count}/${a.threshold}`)}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: "center", paddingTop: 2 },
  peg: { alignItems: "center", marginBottom: -2, zIndex: 3 },
  pegBar: { width: 22, height: 7, borderRadius: 4, backgroundColor: "#C9A25E", borderWidth: 1, borderColor: "#7A5B22" },
  pegHole: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.5)", marginTop: -5.5 },
  ribbon: { width: 12, height: 16, marginTop: 1 },
  ribbonNotchWrap: { height: 0 },
  ribbonNotch: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 7, borderLeftColor: "transparent", borderRightColor: "transparent", marginTop: -1 },
  glow: { position: "absolute" },
  ring: {
    alignItems: "center", justifyContent: "center", borderWidth: 3, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 5 },
  },
  disc: {
    backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(0,0,0,0.12)",
  },
  lockOverlay: { backgroundColor: "rgba(20,20,25,0.45)", alignItems: "center", justifyContent: "center" },
  tierTag: { marginTop: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tierText: { color: "#FFF9EC", fontSize: 9.5, fontWeight: "800", letterSpacing: 0.6 },
});

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { useLabel } from "@/src/utils/labels";
import { colors, spacing, radius } from "@/src/theme";

/**
 * Compact Home entry for "Traguardi del Cammino" — a warm, wood-toned card that
 * leads to the personal medal cabinet. Shows the earned count for logged-in
 * users, a gentle invite otherwise. Kept small to blend with the Home feed.
 */
export default function BachecaCard({ inGrid = false }: { inGrid?: boolean }) {
  const router = useRouter();
  const t = useLabel();
  const { user } = useAuth();
  const [earned, setEarned] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  // Fetch once per mount (not on every tab focus) to avoid repeated network
  // calls on the Home feed — the count doesn't need to be perfectly live here.
  useEffect(() => {
    if (!user) { setEarned(null); return; }
    api.myAchievements()
      .then((d: any) => { setEarned(d.earned_count ?? 0); setTotal((d.achievements || []).length); })
      .catch(() => {});
  }, [user?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PressableScale testID="home-bacheca" style={[styles.wrap, inGrid && styles.wrapGrid]} onPress={() => router.push("/traguardi")}>
      <View style={[styles.card, inGrid && styles.cardGrid]}>
        <LinearGradient colors={["#4E2F1B", "#301C10", "#1C0F09"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.medalBadge}>
          <LinearGradient colors={["#FCE49A", "#E0B23C"]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.medalRing}>
            <Ionicons name="ribbon" size={22} color="#8A6B22" />
          </LinearGradient>
        </View>
        <View style={styles.info}>
          <View style={styles.kickerRow}>
            <Ionicons name="footsteps" size={13} color="#E0B23C" />
            <Text style={styles.kicker}>{t("home_traguardi").toUpperCase()}</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>La tua Bacheca del Cammino</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {earned !== null && total !== null
              ? `${earned} ${earned === 1 ? "traguardo" : "traguardi"} su ${total}`
              : "Non è una gara. È un cammino."}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radius.lg, shadowColor: "#301C10", shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  wrapGrid: { flex: 1, marginHorizontal: 0, marginTop: 0 },
  cardGrid: { flex: 1 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.lg, overflow: "hidden", padding: spacing.lg, borderWidth: 1, borderColor: "rgba(224,178,60,0.3)" },
  medalBadge: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  medalRing: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#A9801E" },
  info: { flex: 1 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  kicker: { color: "#E0B23C", fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6 },
  title: { color: colors.white, fontSize: 16.5, fontWeight: "800", marginTop: 3 },
  sub: { color: "#E8D5B5", fontSize: 12.5, fontWeight: "600", marginTop: 2 },
});

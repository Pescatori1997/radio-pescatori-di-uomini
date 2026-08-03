import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

/**
 * Dedicated Home entry for Bible Reading Plans ("Piani di Lettura"), separate
 * from the Bible reader card so users can jump straight to the plans list.
 * Shows a small preview (cover + count) of the available plans when present.
 */
export default function ReadingPlansCard() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    api.readingPlans().then((d: any[]) => setPlans(Array.isArray(d) ? d : [])).catch(() => setPlans([]));
  }, []);

  const featured = plans.find((p) => p.cover) || plans[0];

  return (
    <PressableScale testID="home-reading-plans" style={styles.wrap} onPress={() => router.push("/lettore/piani")}>
      <View style={styles.card}>
        <LinearGradient colors={["#123A2E", "#0E2C34", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.row}>
          {featured?.cover ? (
            <Image source={{ uri: featured.cover }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, styles.coverEmpty]}><Ionicons name="calendar" size={26} color={colors.brandSecondary} /></View>
          )}
          <View style={styles.info}>
            <View style={styles.kickerRow}>
              <Ionicons name="ribbon" size={14} color={colors.brandSecondary} />
              <Text style={styles.kicker}>PIANI DI LETTURA</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {plans.length ? "Percorsi guidati nella Parola" : "Inizia un percorso nella Parola"}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {plans.length ? `${plans.length} ${plans.length === 1 ? "piano disponibile" : "piani disponibili"}` : "Giorno per giorno, con costanza"}
            </Text>
          </View>
        </View>
        <View style={styles.btn}>
          <Text style={styles.btnText}>Sfoglia i piani</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.navy} />
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radius.lg, shadowColor: colors.navy, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  card: { borderRadius: radius.lg, overflow: "hidden", padding: spacing.lg, borderWidth: 1, borderColor: "rgba(52,211,153,0.25)" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cover: { width: 68, height: 68, borderRadius: radius.md, backgroundColor: colors.navy },
  coverEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  info: { flex: 1 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  kicker: { color: colors.brandSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  title: { color: colors.white, fontSize: 17, fontWeight: "800", marginTop: 3 },
  sub: { color: colors.brandTertiary, fontSize: 13, fontWeight: "600", marginTop: 3 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.white, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.lg },
  btnText: { color: colors.navy, fontSize: 15, fontWeight: "800" },
});

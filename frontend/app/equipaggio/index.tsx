import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { crewPortrait } from "@/src/crewAssets";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function Equipaggio() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [crew, setCrew] = useState<any[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      Promise.all([api.crew(), api.crewRanks().catch(() => [])])
        .then(([c, r]) => { setCrew(c); setRanks(r || []); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  // Group members by rank (ranks ordered by level; members without a rank go last).
  const sortedRanks = [...ranks].sort((a, b) => (a.level || 0) - (b.level || 0));
  const rankIds = new Set(sortedRanks.map((r) => r.id));
  const groups: { key: string; title: string; members: any[] }[] = [];
  sortedRanks.forEach((r) => {
    const members = crew.filter((m) => m.rank_id === r.id);
    if (members.length) groups.push({ key: r.id, title: r.name, members });
  });
  const others = crew.filter((m) => !m.rank_id || !rankIds.has(m.rank_id));
  if (others.length) groups.push({ key: "__others", title: sortedRanks.length ? "Equipaggio" : "", members: others });

  const renderMember = (m: any, i: number) => (
    <Animated.View key={m.id} entering={FadeInDown.duration(400).delay(i * 40)} style={styles.tileWrap}>
      <PressableScale testID={`crew-card-${m.id}`} scaleTo={0.94} style={styles.tile} onPress={() => router.push(`/equipaggio/${m.id}`)}>
        <Image source={crewPortrait(m)} style={styles.tileImg} contentFit="contain" />
      </PressableScale>
      <Text style={styles.tileName} numberOfLines={1}>{m.name}</Text>
      {!!m.role && <Text style={styles.tileRole} numberOfLines={1}>{m.role}</Text>}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="equipaggio-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </PressableScale>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="anchor" size={20} color={colors.brandSecondary} />
          <Text style={styles.headerTitle}>{"L'Equipaggio"}</Text>
        </View>
        <View style={{ width: 120 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>Le persone che servono in Pescatori di Uomini. Tocca un volto per scoprire chi è.</Text>

          {groups.map((g) => (
            <View key={g.key} style={{ marginBottom: spacing.lg }}>
              {!!g.title && (
                <View style={styles.rankHeader}>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.brandPrimary} />
                  <Text style={styles.rankTitle}>{g.title}</Text>
                  <View style={styles.rankLine} />
                </View>
              )}
              <View style={styles.grid}>{g.members.map((m, i) => renderMember(m, i))}</View>
            </View>
          ))}

          {/* Join the team */}
          <LinearGradient colors={[colors.brandPrimary, "#0369A1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.joinCard}>
            <MaterialCommunityIcons name="anchor" size={26} color={colors.white} />
            <Text style={styles.joinTitle}>{"Entra nell'Equipaggio"}</Text>
            <Text style={styles.joinSub}>Dio può usare anche te per annunciare il Vangelo.</Text>
            <PressableScale testID="join-crew-button" style={styles.joinBtn} onPress={() => router.push("/join")}>
              <Text style={styles.joinBtnText}>Collabora con noi</Text>
            </PressableScale>
          </LinearGradient>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: spacing.lg },
  rankHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  rankTitle: { color: colors.white, fontSize: 15, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  rankLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginLeft: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tileWrap: { width: "31%", marginBottom: spacing.md },
  tile: { width: "100%", aspectRatio: 0.78, borderRadius: radius.md, overflow: "hidden", backgroundColor: "#0A1128", borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  tileImg: { width: "100%", height: "100%" },
  tileName: { color: colors.white, fontSize: 12, fontWeight: "800", marginTop: 5, textAlign: "center" },
  tileRole: { color: colors.brandSecondary, fontSize: 10, fontWeight: "600", marginTop: 1, textAlign: "center" },
  joinCard: { borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", marginTop: spacing.sm, shadowColor: colors.brandPrimary, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  joinTitle: { color: colors.white, fontSize: 18, fontWeight: "800", marginTop: spacing.sm, textAlign: "center" },
  joinSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, textAlign: "center", marginTop: 4, lineHeight: 18 },
  joinBtn: { backgroundColor: colors.white, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill, marginTop: spacing.md },
  joinBtnText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800" },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { FishingNet, SeaWaves, SunriseGlow } from "@/src/components/marine";
import PressableScale from "@/src/components/PressableScale";
import SharePlanSheet from "@/src/components/SharePlanSheet";
import { colors, spacing, radius } from "@/src/theme";

export default function ReadingPlans() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharePlan, setSharePlan] = useState<any>(null);
  const [w, setW] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.readingPlans().catch(() => []),
      user ? api.myReadingPlans().catch(() => []) : Promise.resolve([]),
    ]).then(([all, my]) => { setPlans(all); setMine(my); }).finally(() => setLoading(false));
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mineIds = new Set(mine.map((m) => m.id));
  const notEnrolled = plans.filter((p) => !mineIds.has(p.id));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <LinearGradient colors={["#0B2A4A", "#0A1B3A", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {w > 0 && (<><SunriseGlow width={w} height={140} /><FishingNet width={w} height={140} gap={28} opacity={0.06} /><SeaWaves width={w} height={50} /></>)}
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
          <Text style={styles.topTitle}>Piani di Lettura</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.heroSub}>Un cammino guidato nella Parola di Dio</Text>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {mine.length > 0 && (
            <>
              <Text style={styles.section}>I miei piani</Text>
              {mine.map((p, i) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(i * 40)}>
                  <PressableScale testID={`my-plan-${p.id}`} style={styles.myCard} onPress={() => router.push(`/lettore/piano/${p.id}`)}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.myTitle} numberOfLines={2}>{p.title}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        {p.progress?.status === "completed" && <Ionicons name="checkmark-circle" size={20} color="#22C55E" />}
                        <PressableScale testID={`my-plan-share-${p.id}`} onPress={() => setSharePlan(p)} hitSlop={8} style={styles.shareIconDark}><Ionicons name="share-social" size={16} color={colors.white} /></PressableScale>
                      </View>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${p.progress?.percent || 0}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{p.progress?.completed_count || 0}/{p.progress?.duration_days || p.duration_days} giorni · {p.progress?.percent || 0}%</Text>
                  </PressableScale>
                </Animated.View>
              ))}
            </>
          )}

          <Text style={styles.section}>{mine.length > 0 ? "Scopri altri piani" : "Piani disponibili"}</Text>
          {notEnrolled.length === 0 && mine.length === 0 && (
            <Text style={styles.empty}>Nessun piano disponibile al momento.</Text>
          )}
          {notEnrolled.map((p, i) => (
            <Animated.View key={p.id} entering={FadeInDown.delay(i * 40)}>
              <PressableScale testID={`plan-${p.id}`} style={styles.card} onPress={() => router.push(`/lettore/piano/${p.id}`)}>
                <View style={styles.cardIcon}><Ionicons name="book" size={22} color={colors.white} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{p.title}</Text>
                  {!!p.subtitle && <Text style={styles.cardSub} numberOfLines={2}>{p.subtitle}</Text>}
                  <View style={styles.metaRow}>
                    <View style={styles.pill}><Ionicons name="calendar-outline" size={12} color={colors.onBrandTertiary} /><Text style={styles.pillText}>{p.duration_days} giorni</Text></View>
                    {!!p.category && <View style={styles.pill}><Text style={styles.pillText}>{p.category}</Text></View>}
                  </View>
                </View>
                <PressableScale testID={`plan-share-${p.id}`} onPress={() => setSharePlan(p)} hitSlop={8} style={styles.shareIcon}><Ionicons name="share-social" size={18} color={colors.brandPrimary} /></PressableScale>
              </PressableScale>
            </Animated.View>
          ))}
        </ScrollView>
      )}
      <SharePlanSheet visible={!!sharePlan} plan={sharePlan} onClose={() => setSharePlan(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, overflow: "hidden" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  topTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  heroSub: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700", marginTop: spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { color: colors.onSurface, fontSize: 16, fontWeight: "800", marginTop: spacing.md, marginBottom: spacing.md },
  empty: { color: colors.muted, fontSize: 14, textAlign: "center", marginTop: spacing.lg },
  myCard: { backgroundColor: colors.navy, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  myTitle: { flex: 1, color: colors.white, fontSize: 15, fontWeight: "800" },
  shareIconDark: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  shareIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.15)", marginTop: spacing.md, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary },
  progressText: { color: colors.brandSecondary, fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  cardSub: { color: colors.onSurfaceSecondary, fontSize: 12.5, marginTop: 3 },
  metaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { color: colors.onBrandTertiary, fontSize: 11, fontWeight: "700" },
});

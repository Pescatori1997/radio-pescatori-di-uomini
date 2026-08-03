import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
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
                    <View style={styles.coverWrap}>
                      {p.cover ? (
                        <Image source={{ uri: p.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, styles.coverEmpty]}><Ionicons name="book" size={40} color="rgba(255,255,255,0.5)" /></View>
                      )}
                      <LinearGradient colors={["rgba(10,17,40,0.05)", "rgba(10,17,40,0.85)"]} style={StyleSheet.absoluteFill} />
                      <View style={styles.coverTopRow}>
                        {p.progress?.status === "completed" ? <View style={styles.doneBadge}><Ionicons name="checkmark" size={14} color={colors.white} /></View> : <View />}
                        <PressableScale testID={`my-plan-share-${p.id}`} onPress={() => setSharePlan(p)} hitSlop={8} style={styles.shareIconDark}><Ionicons name="share-social" size={16} color={colors.white} /></PressableScale>
                      </View>
                      <Text style={styles.coverTitle} numberOfLines={2}>{p.title}</Text>
                    </View>
                    <View style={styles.myBody}>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${p.progress?.percent || 0}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{p.progress?.completed_count || 0}/{p.progress?.duration_days || p.duration_days} giorni · {p.progress?.percent || 0}%</Text>
                    </View>
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
                <View style={styles.coverWrap}>
                  {p.cover ? (
                    <Image source={{ uri: p.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.coverEmpty]}><Ionicons name="book" size={40} color="rgba(255,255,255,0.5)" /></View>
                  )}
                  <LinearGradient colors={["rgba(10,17,40,0.05)", "rgba(10,17,40,0.85)"]} style={StyleSheet.absoluteFill} />
                  <View style={styles.coverTopRow}>
                    <View />
                    <PressableScale testID={`plan-share-${p.id}`} onPress={() => setSharePlan(p)} hitSlop={8} style={styles.shareIconDark}><Ionicons name="share-social" size={16} color={colors.white} /></PressableScale>
                  </View>
                  <Text style={styles.coverTitle} numberOfLines={2}>{p.title}</Text>
                </View>
                <View style={styles.cardBody}>
                  {!!p.subtitle && <Text style={styles.cardSub} numberOfLines={2}>{p.subtitle}</Text>}
                  <View style={styles.metaRow}>
                    <View style={styles.pill}><Ionicons name="calendar-outline" size={12} color={colors.onBrandTertiary} /><Text style={styles.pillText}>{p.duration_days} giorni</Text></View>
                    {!!p.category && <View style={styles.pill}><Text style={styles.pillText}>{p.category}</Text></View>}
                  </View>
                </View>
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
  myCard: { backgroundColor: colors.navy, borderRadius: radius.lg, marginBottom: spacing.md, overflow: "hidden" },
  coverWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.navy, justifyContent: "flex-end", padding: spacing.md },
  coverEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.navySoft },
  coverTopRow: { position: "absolute", top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  coverTitle: { color: colors.white, fontSize: 19, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  doneBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center" },
  myBody: { padding: spacing.lg, paddingTop: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  shareIconDark: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary },
  progressText: { color: colors.brandSecondary, fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  cardBody: { padding: spacing.lg, paddingTop: spacing.md },
  cardSub: { color: colors.onSurfaceSecondary, fontSize: 13.5, lineHeight: 19 },
  metaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { color: colors.onBrandTertiary, fontSize: 11, fontWeight: "700" },
});

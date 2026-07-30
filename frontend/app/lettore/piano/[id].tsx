import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { FishingNet, SeaWaves, SunriseGlow } from "@/src/components/marine";
import PressableScale from "@/src/components/PressableScale";
import SharePlanSheet from "@/src/components/SharePlanSheet";
import { confirmAsync, alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

export default function PlanDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [plan, setPlan] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sharePlanOpen, setSharePlanOpen] = useState(false);
  const [shareDay, setShareDay] = useState<any>(null);
  const [w, setW] = useState(0);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api.readingPlan(id).then((p: any) => { setPlan(p); setEnrollment(p.enrollment || null); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const done = new Set<number>(enrollment?.completed_days || []);
  const duration = plan?.duration_days || (plan?.days?.length ?? 0);
  const percent = duration ? Math.round((done.size / duration) * 100) : 0;
  const enrolled = !!enrollment;

  const requireLogin = () => {
    alertMessage("Accedi per continuare", "Crea un account gratuito per iniziare i piani di lettura e salvare i tuoi progressi.");
    router.push("/login");
  };

  const enroll = async () => {
    if (!user) return requireLogin();
    setBusy(true);
    try {
      await api.enrollPlan(id!);
      await load();
    } catch (e: any) { alertMessage("Errore", e?.message || "Riprova"); }
    finally { setBusy(false); }
  };

  const toggleDay = async (day: number) => {
    if (!user) return requireLogin();
    const willDo = !done.has(day);
    // Optimistic update
    const next = new Set(done);
    willDo ? next.add(day) : next.delete(day);
    setEnrollment((e: any) => ({ ...(e || { completed_days: [] }), completed_days: Array.from(next) }));
    try {
      await api.togglePlanDay(id!, day, willDo);
    } catch (e: any) {
      setEnrollment((prev: any) => ({ ...prev, completed_days: Array.from(done) }));
      alertMessage("Errore", e?.message || "Riprova");
    }
  };

  const openReading = (r: any) => {
    const hl = r.verse_start ? `&highlight=${r.verse_start}` : "";
    router.push(`/lettore/read?book=${r.book_nr}&chapter=${r.chapter}${hl}`);
  };

  const reset = async () => {
    const ok = await confirmAsync("Ripristina piano", "Vuoi azzerare i tuoi progressi per questo piano?", "Ripristina", true);
    if (!ok) return;
    try { await api.unenrollPlan(id!); await load(); } catch (e: any) { alertMessage("Errore", e?.message || "Riprova"); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  if (!plan) return <View style={styles.center}><Text style={{ color: colors.muted }}>Piano non trovato</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <LinearGradient colors={["#0B2A4A", "#0A1B3A", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {w > 0 && (<><SunriseGlow width={w} height={220} /><FishingNet width={w} height={220} gap={28} opacity={0.06} /><SeaWaves width={w} height={60} /></>)}
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <PressableScale testID="plan-share" onPress={() => setSharePlanOpen(true)} style={styles.iconBtn}><Ionicons name="share-social" size={18} color={colors.white} /></PressableScale>
            {enrolled && (
              <PressableScale testID="plan-reset" onPress={reset} style={styles.iconBtn}><Ionicons name="refresh" size={18} color={colors.white} /></PressableScale>
            )}
          </View>
        </View>
        <Text style={styles.heroTitle}>{plan.title}</Text>
        {!!plan.subtitle && <Text style={styles.heroSub}>{plan.subtitle}</Text>}
        <View style={styles.metaRow}>
          <View style={styles.pill}><Ionicons name="calendar-outline" size={12} color={colors.white} /><Text style={styles.pillText}>{duration} giorni</Text></View>
          {!!plan.category && <View style={styles.pill}><Text style={styles.pillText}>{plan.category}</Text></View>}
        </View>
        {enrolled && (
          <>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
            <Text style={styles.progressText}>{done.size}/{duration} giorni completati · {percent}%</Text>
          </>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {!!plan.description && <Text style={styles.desc}>{plan.description}</Text>}

        {!enrolled && (
          <PressableScale testID="plan-enroll" style={styles.enrollBtn} onPress={enroll} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.white} /> : <>
              <Ionicons name="play" size={18} color={colors.white} />
              <Text style={styles.enrollText}>Inizia il piano</Text>
            </>}
          </PressableScale>
        )}

        {(plan.days || []).map((d: any, i: number) => {
          const isDone = done.has(d.day);
          return (
            <Animated.View key={d.day} entering={FadeInDown.delay(i * 25)} style={[styles.dayCard, isDone && styles.dayCardDone]}>
              <View style={styles.dayHeader}>
                <View style={[styles.dayBadge, isDone && styles.dayBadgeDone]}><Text style={[styles.dayBadgeText, isDone && { color: colors.white }]}>{d.day}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayLabel}>Giorno {d.day}</Text>
                  {!!d.title && <Text style={styles.dayTitle}>{d.title}</Text>}
                </View>
                <PressableScale testID={`plan-day-share-${d.day}`} onPress={() => setShareDay(d)} style={styles.dayShare}>
                  <Ionicons name="share-social" size={18} color={colors.brandPrimary} />
                </PressableScale>
                <PressableScale testID={`plan-day-toggle-${d.day}`} onPress={() => toggleDay(d.day)} style={[styles.check, isDone && styles.checkOn]}>
                  <Ionicons name={isDone ? "checkmark" : "ellipse-outline"} size={20} color={isDone ? colors.white : colors.muted} />
                </PressableScale>
              </View>
              {!!d.meditation && <Text style={styles.meditation}>{d.meditation}</Text>}
              <View style={styles.readings}>
                {(d.readings || []).map((r: any, ri: number) => (
                  <PressableScale key={ri} testID={`plan-day-${d.day}-reading-${ri}`} style={styles.readingBtn} onPress={() => openReading(r)}>
                    <Ionicons name="book-outline" size={16} color={colors.brandPrimary} />
                    <Text style={styles.readingText}>{r.label || `${r.book_name} ${r.chapter}`}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </PressableScale>
                ))}
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>
      <SharePlanSheet visible={sharePlanOpen} plan={plan} onClose={() => setSharePlanOpen(false)} />
      <SharePlanSheet visible={!!shareDay} plan={plan} day={shareDay} onClose={() => setShareDay(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, overflow: "hidden" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  heroTitle: { color: colors.white, fontSize: 22, fontWeight: "800", marginTop: spacing.md },
  heroSub: { color: colors.brandSecondary, fontSize: 14, fontWeight: "600", marginTop: 4 },
  metaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.14)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.15)", marginTop: spacing.lg, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary },
  progressText: { color: colors.brandSecondary, fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
  desc: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21, marginBottom: spacing.lg },
  enrollBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.pill, marginBottom: spacing.xl },
  enrollText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  dayCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  dayCardDone: { borderColor: "#22C55E", backgroundColor: "rgba(34,197,94,0.06)" },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dayBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  dayBadgeDone: { backgroundColor: "#22C55E" },
  dayBadgeText: { color: colors.onBrandTertiary, fontSize: 15, fontWeight: "800" },
  dayLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  dayTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800", marginTop: 1 },
  check: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  checkOn: { backgroundColor: "#22C55E" },
  dayShare: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
  meditation: { color: colors.onSurfaceSecondary, fontSize: 13.5, lineHeight: 20, marginTop: spacing.md, fontStyle: "italic" },
  readings: { marginTop: spacing.md, gap: spacing.sm },
  readingBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  readingText: { flex: 1, color: colors.onSurface, fontSize: 14, fontWeight: "700" },
});

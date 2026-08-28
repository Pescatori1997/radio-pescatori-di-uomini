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
import BookCover from "@/src/components/plans/BookCover";
import SharePlanSheet from "@/src/components/SharePlanSheet";
import { confirmAsync, alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

const FEATURES = [
  ["book-outline", "Struttura a libro per un'esperienza immersiva"],
  ["bookmark-outline", "Segnalibri per ogni giornata del piano"],
  ["time-outline", "Letture brevi e mirate (5-7 minuti)"],
  ["create-outline", "Spazio per la riflessione personale"],
  ["share-social-outline", "Condividi le meditazioni che ti toccano"],
];

// Ribbon-shaped bookmark tab for a single day.
function Ribbon({ day, title, done, current, onPress }: { day: number; title?: string; done: boolean; current: boolean; onPress: () => void }) {
  return (
    <PressableScale testID={`plan-day-${day}`} onPress={onPress} style={styles.ribbonWrap}>
      <View style={[styles.ribbonBody, done && styles.ribbonDone, current && styles.ribbonCurrent]}>
        <Text style={[styles.ribbonLabel, (done || current) && { color: "rgba(255,255,255,0.85)" }]}>Giorno</Text>
        <Text style={[styles.ribbonNum, done && { color: "#fff" }, current && { color: colors.navy }]}>{day}</Text>
        {done && <View style={styles.ribbonCheck}><Ionicons name="checkmark" size={9} color="#fff" /></View>}
      </View>
      <View style={[styles.ribbonTail, done && { borderTopColor: "#1B6E43" }, current && { borderTopColor: "#F6C560" }]} />
    </PressableScale>
  );
}

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
  const days = plan?.days || [];
  const resumeDay = days.map((d: any) => d.day).find((d: number) => !done.has(d)) || 1;
  const resumeObj = days.find((d: any) => d.day === resumeDay);

  const requireLogin = () => {
    alertMessage("Accedi per continuare", "Crea un account gratuito per iniziare i piani di lettura e salvare i tuoi progressi.");
    router.push("/login");
  };

  const openDay = (day: number) => router.push(`/lettore/piano/giorno?id=${id}&day=${day}`);

  const startOrContinue = async () => {
    if (!enrolled) {
      if (!user) return requireLogin();
      setBusy(true);
      try { await api.enrollPlan(id!); await load(); } catch (e: any) { alertMessage("Errore", e?.message || "Riprova"); }
      finally { setBusy(false); }
      openDay(1);
      return;
    }
    openDay(resumeDay);
  };

  const reset = async () => {
    const ok = await confirmAsync("Ripristina piano", "Vuoi azzerare i tuoi progressi per questo piano?", "Ripristina", true);
    if (!ok) return;
    try { await api.unenrollPlan(id!); await load(); } catch (e: any) { alertMessage("Errore", e?.message || "Riprova"); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  if (!plan) return <View style={styles.center}><Text style={{ color: colors.muted }}>Piano non trovato</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: "#070C18" }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {/* Ambient hero glow behind the book cover */}
      <View style={styles.heroBg}>
        <LinearGradient colors={["#0B2A4A", "#0A1B3A", "#070C18"]} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        {w > 0 && (<><SunriseGlow width={w} height={320} /><FishingNet width={w} height={320} gap={28} opacity={0.05} /></>)}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
          <PressableScale onPress={() => router.back()} style={styles.topLeft}>
            <Ionicons name="chevron-back" size={22} color={colors.white} />
            <Text style={styles.topLeftText}>PIANI BIBLICI</Text>
          </PressableScale>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <PressableScale testID="plan-share" onPress={() => setSharePlanOpen(true)} style={styles.iconBtn}><Ionicons name="share-social" size={17} color={colors.white} /></PressableScale>
            {enrolled && <PressableScale testID="plan-reset" onPress={reset} style={styles.iconBtn}><Ionicons name="refresh" size={17} color={colors.white} /></PressableScale>}
          </View>
        </View>

        {/* Book cover */}
        <View style={styles.coverArea}>
          <BookCover plan={plan} width={188} onPress={startOrContinue} style={{ marginRight: 0 }} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{plan.title}</Text>
          {!!plan.description && <Text style={styles.desc}>{plan.description}</Text>}

          <View style={styles.metaRow}>
            <View style={styles.metaPill}><Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.8)" /><Text style={styles.metaText}>{duration} Giorni</Text></View>
            <View style={styles.metaPill}><Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.8)" /><Text style={styles.metaText}>5-7 min al giorno</Text></View>
            <View style={styles.metaPill}><Ionicons name="bookmark-outline" size={13} color="rgba(255,255,255,0.8)" /><Text style={styles.metaText}>{duration} Segnalibri</Text></View>
          </View>

          {enrolled && (
            <View style={{ marginTop: spacing.lg }}>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
              <Text style={styles.progressText}>{done.size}/{duration} giorni completati · {percent}%</Text>
            </View>
          )}

          {/* Bookmarks */}
          <Text style={styles.blockLabel}>I TUOI SEGNALIBRI</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4, paddingRight: spacing.lg }}>
            {days.map((d: any) => (
              <Ribbon key={d.day} day={d.day} title={d.title} done={done.has(d.day)} current={enrolled && d.day === resumeDay} onPress={() => openDay(d.day)} />
            ))}
          </ScrollView>

          {/* Continue */}
          <PressableScale testID="plan-continue" style={styles.continueBtn} onPress={startOrContinue} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.white} /> : (
              <>
                <View style={styles.continueIcon}><Ionicons name="book" size={18} color={colors.white} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.continueTitle}>{enrolled ? "CONTINUA IL PIANO" : "INIZIA IL PIANO"}</Text>
                  <Text style={styles.continueSub} numberOfLines={1}>Giorno {enrolled ? resumeDay : 1}{resumeObj?.title ? ` · ${enrolled ? resumeObj.title : days[0]?.title || ""}` : ""}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
              </>
            )}
          </PressableScale>

          {/* Features */}
          <View style={styles.featureCard}>
            <Text style={styles.featureHead}>CARATTERISTICHE</Text>
            {FEATURES.map(([icon, text]) => (
              <View key={text} style={styles.featureRow}>
                <Ionicons name={icon as any} size={16} color="#F6C560" />
                <Text style={styles.featureText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        {w > 0 && <SeaWaves width={w} height={40} />}
      </ScrollView>

      <SharePlanSheet visible={sharePlanOpen} plan={plan} onClose={() => setSharePlanOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#070C18" },
  heroBg: { position: "absolute", top: 0, left: 0, right: 0, height: 360, overflow: "hidden" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 2 },
  topLeftText: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  coverArea: { alignItems: "center", marginTop: spacing.md, marginBottom: spacing.lg },

  body: { paddingHorizontal: spacing.lg },
  title: { color: colors.white, fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: spacing.sm },
  desc: { color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: spacing.md },
  metaRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", justifyContent: "center" },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill },
  metaText: { color: "rgba(255,255,255,0.85)", fontSize: 11.5, fontWeight: "700" },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: "#F6C560" },
  progressText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700", marginTop: spacing.sm, textAlign: "center" },

  blockLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: spacing.xl, marginBottom: spacing.md },
  ribbonWrap: { alignItems: "center", marginRight: 10 },
  ribbonBody: { width: 56, paddingTop: 8, paddingBottom: 8, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", alignItems: "center" },
  ribbonDone: { backgroundColor: "#22A559", borderColor: "#22A559" },
  ribbonCurrent: { backgroundColor: "#F6C560", borderColor: "#F6C560" },
  ribbonLabel: { color: "rgba(255,255,255,0.6)", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.5 },
  ribbonNum: { color: colors.white, fontSize: 18, fontWeight: "900", marginTop: 1 },
  ribbonCheck: { position: "absolute", top: 3, right: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center" },
  ribbonTail: { width: 0, height: 0, borderLeftWidth: 28, borderRightWidth: 28, borderTopWidth: 10, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "rgba(255,255,255,0.10)" },

  continueBtn: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(246,197,96,0.35)", borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  continueIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  continueTitle: { color: colors.white, fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  continueSub: { color: "rgba(255,255,255,0.65)", fontSize: 12.5, marginTop: 2 },

  featureCard: { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.xl, gap: spacing.md },
  featureHead: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 2 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  featureText: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 13.5, fontWeight: "600", lineHeight: 19 },
});

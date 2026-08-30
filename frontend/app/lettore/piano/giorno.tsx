import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, TextInput, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { FadeIn } from "react-native-reanimated";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import PressableScale from "@/src/components/PressableScale";
import SharePlanSheet from "@/src/components/SharePlanSheet";
import { alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

// Warm "book page" palette (distinct from the app navy — this is the reading page).
const PAPER = "#F3E7CE";
const PAPER_EDGE = "#E4D3AE";
const INK = "#3B2C18";
const INK_SOFT = "#6E5B3E";
const RIBBON = "#0B2A4A";
const serif = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, 'Times New Roman', serif" });

const Ornament = () => (
  <View style={styles.ornament}>
    <View style={styles.ornLine} />
    <Ionicons name="fish-outline" size={14} color={INK_SOFT} />
    <View style={styles.ornLine} />
  </View>
);

export default function PlanDayPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, day } = useLocalSearchParams<{ id: string; day: string }>();
  const dayNum = parseInt(day || "1", 10);
  const { user } = useAuth();

  const [plan, setPlan] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verseBlocks, setVerseBlocks] = useState<any[]>([]);
  const [reflection, setReflection] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const saveTimer = useRef<any>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api.readingPlan(id).then((p: any) => { setPlan(p); setEnrollment(p.enrollment || null); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const dayObj = useMemo(() => (plan?.days || []).find((d: any) => d.day === dayNum), [plan, dayNum]);
  const duration = plan?.duration_days || (plan?.days?.length ?? 0);
  const done = new Set<number>(enrollment?.completed_days || []);
  const isDone = done.has(dayNum);

  // Load saved personal reflection (local, per plan+day).
  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`pdu_plan_refl_${id}_${dayNum}`).then((v) => setReflection(v || "")).catch(() => {});
  }, [id, dayNum]);

  const onReflect = (t: string) => {
    setReflection(t);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(`pdu_plan_refl_${id}_${dayNum}`, t).catch(() => {});
    }, 500);
  };

  // Fetch inline verse text for readings that specify a verse range.
  useEffect(() => {
    if (!dayObj) return;
    let cancelled = false;
    (async () => {
      const readings = dayObj.readings || [];
      const blocks = await Promise.all(readings.map(async (r: any) => {
        if (r.verse_start) {
          try {
            const ch = await api.bibleChapter(r.book_nr, r.chapter);
            const vs = (ch.verses || []).filter((v: any) => v.verse >= r.verse_start && v.verse <= (r.verse_end || r.verse_start));
            return { reading: r, ref: r.label || `${r.book_name} ${r.chapter}:${r.verse_start}${r.verse_end ? `-${r.verse_end}` : ""}`, verses: vs };
          } catch { return { reading: r, ref: r.label || `${r.book_name} ${r.chapter}`, verses: [] }; }
        }
        return { reading: r, ref: r.label || `${r.book_name} ${r.chapter}`, verses: null };
      }));
      if (!cancelled) setVerseBlocks(blocks);
    })();
    return () => { cancelled = true; };
  }, [dayObj]);

  const requireLogin = () => {
    alertMessage("Accedi per continuare", "Crea un account gratuito per salvare i tuoi progressi.");
    router.push("/login");
  };

  const toggleDone = async () => {
    if (!user) return requireLogin();
    if (!enrollment) { // auto-enroll on first interaction
      try { await api.enrollPlan(id!); } catch { /* noop */ }
    }
    const willDo = !isDone;
    const next = new Set(done);
    willDo ? next.add(dayNum) : next.delete(dayNum);
    setEnrollment((e: any) => ({ ...(e || { completed_days: [] }), completed_days: Array.from(next) }));
    try { await api.togglePlanDay(id!, dayNum, willDo); }
    catch (e: any) { setEnrollment((prev: any) => ({ ...prev, completed_days: Array.from(done) })); alertMessage("Errore", e?.message || "Riprova"); }
  };

  const openReading = (r: any) => {
    const hl = r.verse_start ? `&highlight=${r.verse_start}${r.verse_end ? `&highlightEnd=${r.verse_end}` : ""}` : "";
    router.push(`/lettore/read?book=${r.book_nr}&chapter=${r.chapter}${hl}`);
  };

  const goDay = (d: number) => router.replace(`/lettore/piano/giorno?id=${id}&day=${d}`);

  // Mark the current day as read (never un-marks here). Returns true on success.
  const markDone = async () => {
    if (!user) { requireLogin(); return false; }
    if (!enrollment) { try { await api.enrollPlan(id!); } catch { /* noop */ } }
    if (!done.has(dayNum)) {
      const next = new Set(done); next.add(dayNum);
      setEnrollment((e: any) => ({ ...(e || { completed_days: [] }), completed_days: Array.from(next) }));
      try { await api.togglePlanDay(id!, dayNum, true); }
      catch (e: any) { setEnrollment((prev: any) => ({ ...prev, completed_days: Array.from(done) })); alertMessage("Errore", e?.message || "Riprova"); return false; }
    }
    return true;
  };

  const finishAndContinue = async () => {
    const ok = await markDone();
    if (!ok) return;
    if (dayNum < (plan?.duration_days || (plan?.days?.length ?? 0))) { goDay(dayNum + 1); return; }
    alertMessage("Piano completato 🎉", "Hai completato tutte le giornate di questo piano. Continua a camminare nella Parola!");
    router.back();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  if (!plan || !dayObj) return (
    <View style={styles.center}>
      <Text style={{ color: colors.muted }}>Giornata non trovata</Text>
      <PressableScale onPress={() => router.back()} style={styles.backLink}><Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Torna al piano</Text></PressableScale>
    </View>
  );

  const hasPrev = dayNum > 1;
  const hasNext = dayNum < duration;

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1128" }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => router.back()} style={styles.hIcon}><Ionicons name="chevron-back" size={22} color={colors.white} /></PressableScale>
        <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
          <Text numberOfLines={1} style={styles.hTitle}>{plan.title}</Text>
          <Text style={styles.hSub}>Il tuo progresso: Giorno {dayNum} di {duration}</Text>
        </View>
        <PressableScale onPress={toggleDone} style={styles.hIcon}>
          <Ionicons name={isDone ? "bookmark" : "bookmark-outline"} size={20} color={isDone ? "#F6C560" : colors.white} />
        </PressableScale>
        <PressableScale onPress={() => setShareOpen(true)} style={styles.hIcon}><Ionicons name="share-outline" size={20} color={colors.white} /></PressableScale>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeIn.duration(250)} style={styles.page}>
            {/* Ribbon + day title */}
            <View style={styles.ribbonWrap}>
              <View style={styles.ribbon}><Text style={styles.ribbonLabel}>GIORNO</Text><Text style={styles.ribbonNum}>{dayNum}</Text></View>
            </View>
            <Text style={styles.dayTitle}>{dayObj.title || `Giorno ${dayNum}`}</Text>
            <Ornament />

            {/* Meditation */}
            {!!dayObj.meditation && (
              <>
                <View style={styles.sectionRow}><Ionicons name="heart-outline" size={15} color={INK_SOFT} /><Text style={styles.sectionLabel}>💭  MEDITAZIONE</Text></View>
                <Text style={styles.meditation}>{dayObj.meditation}</Text>
              </>
            )}

            {/* Talk with the Lord */}
            {!!dayObj.talk && (
              <>
                <View style={[styles.sectionRow, { marginTop: spacing.xl }]}><Ionicons name="chatbubble-ellipses-outline" size={15} color={INK_SOFT} /><Text style={styles.sectionLabel}>🙏  PARLA CON IL SIGNORE</Text></View>
                <Text style={styles.talk}>{dayObj.talk}</Text>
              </>
            )}

            {/* Bible verses */}
            <View style={[styles.sectionRow, { marginTop: spacing.xl }]}><Ionicons name="book-outline" size={15} color={INK_SOFT} /><Text style={styles.sectionLabel}>📖  VERSETTI BIBLICI DEL GIORNO</Text></View>
            {verseBlocks.map((b: any, i: number) => (
              <View key={i} style={styles.verseBlock}>
                <Text style={styles.verseRef}>{b.ref}</Text>
                {b.verses === null ? (
                  <PressableScale onPress={() => openReading(b.reading)} style={styles.readWholeBtn}>
                    <Ionicons name="book" size={15} color={RIBBON} />
                    <Text style={styles.readWholeText}>Leggi il capitolo completo</Text>
                    <Ionicons name="chevron-forward" size={15} color={INK_SOFT} />
                  </PressableScale>
                ) : b.verses.length ? (
                  <PressableScale onPress={() => openReading(b.reading)}>
                    <Text style={styles.verseText}>
                      {b.verses.map((v: any) => (
                        <Text key={v.verse}><Text style={styles.verseNum}>{v.verse} </Text>{v.text} </Text>
                      ))}
                    </Text>
                  </PressableScale>
                ) : (
                  <Text style={styles.verseText}>—</Text>
                )}
              </View>
            ))}

            {/* Personal reflection */}
            <View style={[styles.sectionRow, { marginTop: spacing.xl }]}><Ionicons name="create-outline" size={15} color={INK_SOFT} /><Text style={styles.sectionLabel}>RIFLESSIONE PERSONALE</Text></View>
            <TextInput
              value={reflection}
              onChangeText={onReflect}
              placeholder="Annota qui la tua riflessione di oggi…"
              placeholderTextColor="#A99873"
              multiline
              style={styles.reflectInput}
            />

            {/* End-of-day confirmation: mark read and move on (read several days in a row). */}
            <PressableScale testID="day-finish" onPress={finishAndContinue} style={[styles.finishBtn, isDone && styles.finishBtnDone]}>
              <Ionicons name={isDone ? "checkmark-circle" : "checkmark-circle-outline"} size={20} color="#fff" />
              <Text style={styles.finishText}>
                {isDone ? (hasNext ? "Vai alla giornata successiva" : "Torna al piano") : (hasNext ? "Ho letto · Vai al giorno successivo" : "Ho letto · Completa il piano")}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.85)" />
            </PressableScale>

            <Ornament />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Page-turn footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <PressableScale disabled={!hasPrev} onPress={() => goDay(dayNum - 1)} style={[styles.turnBtn, !hasPrev && styles.turnDisabled]}>
          <Ionicons name="chevron-back" size={18} color={hasPrev ? colors.white : "rgba(255,255,255,0.3)"} />
          <Text style={[styles.turnText, !hasPrev && { color: "rgba(255,255,255,0.3)" }]}>Precedente</Text>
        </PressableScale>
        <PressableScale onPress={toggleDone} style={[styles.doneBtn, isDone && styles.doneBtnOn]}>
          <Ionicons name={isDone ? "checkmark-circle" : "ellipse-outline"} size={18} color={colors.white} />
          <Text style={styles.doneText}>{isDone ? "Completato" : "Segna come letto"}</Text>
        </PressableScale>
        <PressableScale disabled={!hasNext} onPress={() => goDay(dayNum + 1)} style={[styles.turnBtn, !hasNext && styles.turnDisabled]}>
          <Text style={[styles.turnText, !hasNext && { color: "rgba(255,255,255,0.3)" }]}>Successiva</Text>
          <Ionicons name="chevron-forward" size={18} color={hasNext ? colors.white : "rgba(255,255,255,0.3)"} />
        </PressableScale>
      </View>

      <SharePlanSheet visible={shareOpen} plan={plan} day={dayObj} onClose={() => setShareOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A1128", gap: spacing.md },
  backLink: { padding: spacing.md },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.sm, backgroundColor: "#0A1128" },
  hIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  hTitle: { color: colors.white, fontSize: 15, fontWeight: "800" },
  hSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600", marginTop: 1 },

  page: { backgroundColor: PAPER, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: PAPER_EDGE,
    ...Platform.select({ web: { boxShadow: "0 16px 40px rgba(0,0,0,0.45)" } as any, default: { shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 10 } }) },

  ribbonWrap: { alignItems: "flex-start" },
  ribbon: { backgroundColor: RIBBON, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, alignItems: "center", marginTop: -spacing.xl - 1, marginLeft: 4 },
  ribbonLabel: { color: "rgba(255,255,255,0.7)", fontSize: 8, fontWeight: "800", letterSpacing: 2 },
  ribbonNum: { color: "#F6C560", fontSize: 22, fontWeight: "900", fontFamily: serif },

  dayTitle: { color: INK, fontSize: 26, fontWeight: "800", fontFamily: serif, marginTop: spacing.lg, lineHeight: 32 },
  ornament: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginVertical: spacing.lg },
  ornLine: { width: 40, height: 1, backgroundColor: "#C9B487" },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  sectionLabel: { color: INK_SOFT, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  meditation: { color: INK, fontSize: 15.5, lineHeight: 25, fontFamily: serif },
  talk: { color: "#4A3A22", fontSize: 15, lineHeight: 24, fontFamily: serif, fontStyle: "italic" },

  verseBlock: { marginBottom: spacing.lg },
  verseRef: { color: INK, fontSize: 14, fontWeight: "800", fontFamily: serif, marginBottom: 3 },
  verseText: { color: "#4A3A22", fontSize: 15, lineHeight: 24, fontFamily: serif, fontStyle: "italic" },
  verseNum: { color: "#B08A3E", fontSize: 11, fontWeight: "800", fontStyle: "normal" },
  readWholeBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(11,42,74,0.06)", borderWidth: 1, borderColor: "rgba(11,42,74,0.15)", borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, marginTop: 2 },
  readWholeText: { flex: 1, color: RIBBON, fontSize: 13.5, fontWeight: "700" },

  reflectInput: { backgroundColor: "rgba(255,255,255,0.5)", borderWidth: 1, borderColor: "#D8C49A", borderRadius: radius.md, padding: spacing.md, minHeight: 90, color: INK, fontSize: 14.5, lineHeight: 22, fontFamily: serif, textAlignVertical: "top" },

  finishBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: RIBBON, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  finishBtnDone: { backgroundColor: "#1B7A46" },
  finishText: { color: "#fff", fontSize: 14.5, fontWeight: "800" },

  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: "rgba(10,17,40,0.96)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  turnBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 8 },
  turnDisabled: { opacity: 0.6 },
  turnText: { color: colors.white, fontSize: 12.5, fontWeight: "700" },
  doneBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill },
  doneBtnOn: { backgroundColor: "#22A559" },
  doneText: { color: colors.white, fontSize: 13, fontWeight: "800" },
});

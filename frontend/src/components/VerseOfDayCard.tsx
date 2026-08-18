import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, verseMeditationAudioUrl } from "@/src/api";
import { useSettings } from "@/src/context/SettingsContext";
import { FishingNet, SeaWaves, SunriseGlow, LightRays, Bubbles } from "@/src/components/marine";
import Logo from "@/src/components/Logo";
import ShareVerseSheet from "@/src/components/ShareVerseSheet";
import MeditationAudioButton from "@/src/components/MeditationAudioButton";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const MARINE = ["#0B2A4A", "#0A1B3A", "#0A1128"] as const;

export default function VerseOfDayCard() {
  const router = useRouter();
  const { settings } = useSettings();
  const [verse, setVerse] = useState<any>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [shareOpen, setShareOpen] = useState(false);

  // Flip state
  const flip = useSharedValue(0);
  const [face, setFace] = useState<"front" | "back">("front");

  // Meditation (back side)
  const [med, setMed] = useState<{ meditation?: string; reflection?: string } | null>(null);
  const [medLoading, setMedLoading] = useState(true);
  const [medError, setMedError] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  const flipHint = (settings?.verse_flip_hint || "").trim() || "Tocca la scheda per girarla";

  useEffect(() => {
    api.verseToday()
      .then((v: any) => { setVerse(v); AsyncStorage.setItem("votd_cache", JSON.stringify(v)).catch(() => {}); })
      .catch(async () => {
        const c = await AsyncStorage.getItem("votd_cache").catch(() => null);
        if (c) setVerse(JSON.parse(c));
      });
  }, []);

  // Load the meditation associated with today's verse (for the back of the card).
  useEffect(() => {
    if (!verse?.id) return;
    setMedLoading(true); setMedError(false);
    let retry: any;
    api.verseMeditation(verse.id)
      .then((d: any) => {
        setMed({ meditation: d.meditation, reflection: d.reflection });
        setAudioReady(!!d.audio);
        AsyncStorage.setItem(`med_${verse.id}`, JSON.stringify({ meditation: d.meditation, reflection: d.reflection })).catch(() => {});
        if (!d.audio) {
          retry = setTimeout(() => { api.verseMeditation(verse.id).then((d2: any) => setAudioReady(!!d2.audio)).catch(() => {}); }, 7000);
        }
      })
      .catch(async () => {
        const c = await AsyncStorage.getItem(`med_${verse.id}`).catch(() => null);
        if (c) setMed(JSON.parse(c)); else setMedError(true);
      })
      .finally(() => setMedLoading(false));
    return () => { if (retry) clearTimeout(retry); };
  }, [verse?.id]);

  // Slow shimmer on the card border.
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const borderStyle = useAnimatedStyle(() => ({ opacity: interpolate(glow.value, [0, 1], [0.25, 0.7]) }));

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    opacity: interpolate(flip.value, [0, 0.49, 0.5, 1], [1, 1, 0, 0]),
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    opacity: interpolate(flip.value, [0, 0.5, 0.51, 1], [0, 0, 1, 1]),
  }));

  if (!verse) return null;

  const toggle = () => {
    const goBack = face === "front";
    flip.value = withTiming(goBack ? 1 : 0, { duration: 520, easing: Easing.inOut(Easing.ease) });
    setFace(goBack ? "back" : "front");
  };
  const openContext = () => router.push({ pathname: "/bibbia", params: { verseId: verse.id } } as any);

  const cardH = Math.max(320, Math.min(size.w || 360, 400) * 1.02);

  return (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.wrap} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={[styles.flipArea, { height: cardH }]}>
        {/* ---------------- FRONT ---------------- */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.face, frontStyle]} pointerEvents={face === "front" ? "auto" : "none"}>
          <Pressable style={styles.card} onPress={toggle} testID="verse-flip">
            <LinearGradient colors={MARINE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            {size.w > 0 && (
              <>
                <SunriseGlow width={size.w} height={cardH} />
                <LightRays width={size.w} height={cardH} />
                <FishingNet width={size.w} height={cardH} gap={26} opacity={0.06} />
                <SeaWaves width={size.w} height={Math.min(110, cardH * 0.32)} />
                <Bubbles height={cardH} count={7} />
              </>
            )}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glowBorder, borderStyle]} />

            <View style={styles.frontContent}>
              <View style={styles.brandRow}>
                <Logo size={30} />
                <Text style={styles.brandText}>Radio Pescatori di Uomini</Text>
                <PressableScale testID="verse-share" style={styles.shareIcon} onPress={() => setShareOpen(true)}>
                  <Ionicons name="share-social-outline" size={18} color={colors.white} />
                </PressableScale>
              </View>

              <View style={styles.verseWrap}>
                <Text style={styles.label}>VERSETTO DEL GIORNO</Text>
                <Text style={styles.verseText} adjustsFontSizeToFit numberOfLines={8}>“{verse.text}”</Text>
                <View style={styles.refRow}>
                  <View style={styles.refLine} />
                  <Text style={styles.reference}>{verse.reference}</Text>
                </View>
              </View>

              <View style={styles.flipHintRow}>
                <Ionicons name="sync-outline" size={15} color="#CBD5E1" />
                <Text style={styles.flipHint}>{flipHint}</Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* ---------------- BACK (meditation) ---------------- */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.face, backStyle]} pointerEvents={face === "back" ? "auto" : "none"}>
          <View style={styles.card}>
            <LinearGradient colors={MARINE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            {size.w > 0 && (
              <>
                <FishingNet width={size.w} height={cardH} gap={26} opacity={0.05} />
                <SeaWaves width={size.w} height={Math.min(90, cardH * 0.26)} />
              </>
            )}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glowBorder, borderStyle]} />

            <View style={styles.backContent}>
              <View style={styles.brandRow}>
                <View style={styles.medBadge}><Ionicons name="sparkles" size={15} color="#FDE68A" /></View>
                <Text style={styles.label}>MEDITAZIONE DEL GIORNO</Text>
                <PressableScale testID="verse-flip-back" style={styles.shareIcon} onPress={toggle}>
                  <Ionicons name="arrow-undo-outline" size={17} color={colors.white} />
                </PressableScale>
              </View>

              {medLoading ? (
                <View style={styles.medLoading}>
                  <ActivityIndicator color={colors.brandSecondary} />
                  <Text style={styles.medLoadingText}>Sto preparando la riflessione…</Text>
                </View>
              ) : medError ? (
                <Text style={styles.medBody}>Meditazione non disponibile al momento. Riprova più tardi.</Text>
              ) : (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: spacing.sm }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  <Text style={styles.medBody}>{med?.meditation}</Text>
                  {!!med?.reflection && (
                    <View style={styles.reflectCard}>
                      <Ionicons name="help-circle-outline" size={18} color="#FDE68A" />
                      <Text style={styles.reflectText}>{med.reflection}</Text>
                    </View>
                  )}
                </ScrollView>
              )}

              {audioReady && verse?.id && (
                <MeditationAudioButton audioUrl={verseMeditationAudioUrl(verse.id)} />
              )}

              <PressableScale testID="verse-read-context" style={styles.contextBtn} onPress={openContext}>
                <Ionicons name="book-outline" size={17} color={colors.navy} />
                <Text style={styles.contextText}>Leggi il contesto</Text>
              </PressableScale>

              <Pressable onPress={toggle} style={styles.flipHintRow} testID="verse-flip-back-hint">
                <Ionicons name="sync-outline" size={15} color="#CBD5E1" />
                <Text style={styles.flipHint}>Tocca per tornare al versetto</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>

      <ShareVerseSheet verse={verse} visible={shareOpen} onClose={() => setShareOpen(false)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing["2xl"],
    borderRadius: radius.lg,
    shadowColor: colors.navy,
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 9,
  },
  flipArea: { width: "100%" },
  face: { borderRadius: radius.lg, backfaceVisibility: "hidden" },
  card: { flex: 1, borderRadius: radius.lg, overflow: "hidden" },
  glowBorder: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brandSecondary },

  frontContent: { flex: 1, padding: spacing.xl, justifyContent: "space-between" },
  backContent: { flex: 1, padding: spacing.xl, gap: spacing.sm },

  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandText: { color: colors.white, fontSize: 13, fontWeight: "800", flex: 1 },
  shareIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  medBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(251,191,36,0.18)", borderWidth: 1, borderColor: "rgba(251,191,36,0.4)", alignItems: "center", justifyContent: "center" },

  verseWrap: { flex: 1, justifyContent: "center" },
  label: { color: "#FDE68A", fontSize: 11.5, fontWeight: "800", letterSpacing: 1.4, flex: 1 },
  verseText: { color: colors.white, fontSize: 21, fontWeight: "700", fontStyle: "italic", lineHeight: 31, marginTop: spacing.md, letterSpacing: 0.2 },
  refRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  refLine: { width: 24, height: 2, borderRadius: 1, backgroundColor: colors.brandSecondary },
  reference: { color: colors.brandSecondary, fontSize: 15, fontWeight: "800" },

  flipHintRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.sm },
  flipHint: { color: "#CBD5E1", fontSize: 12.5, fontWeight: "600" },

  medLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  medLoadingText: { color: "#CBD5E1", fontSize: 13 },
  medBody: { color: "#E2E8F0", fontSize: 15, lineHeight: 23 },
  reflectCard: { flexDirection: "row", gap: spacing.sm, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: "rgba(251,191,36,0.25)" },
  reflectText: { flex: 1, color: "#FDE68A", fontSize: 13.5, fontStyle: "italic", lineHeight: 20 },
  contextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.white, paddingVertical: spacing.md, borderRadius: radius.pill },
  contextText: { color: colors.navy, fontSize: 15, fontWeight: "800" },
});

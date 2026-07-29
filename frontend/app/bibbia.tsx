import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { FishingNet, SeaWaves, SunriseGlow } from "@/src/components/marine";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function Bibbia() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { verseId } = useLocalSearchParams<{ verseId?: string }>();
  const [verse, setVerse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [med, setMed] = useState<{ meditation: string; reflection: string } | null>(null);
  const [medLoading, setMedLoading] = useState(false);
  const [medError, setMedError] = useState(false);
  const [w, setW] = useState(0);

  useEffect(() => {
    const fetch = verseId ? api.verse(verseId) : api.verseToday();
    fetch.then(setVerse).catch(() => {}).finally(() => setLoading(false));
  }, [verseId]);

  useEffect(() => {
    if (!verse?.id) return;
    setMedLoading(true);
    setMedError(false);
    api.verseMeditation(verse.id)
      .then((d: any) => setMed({ meditation: d.meditation, reflection: d.reflection }))
      .catch(() => setMedError(true))
      .finally(() => setMedLoading(false));
  }, [verse?.id]);

  const book = verse?.book || "";
  const chapter = verse?.chapter;
  const vnum = verse?.verse;
  const chapterTitle = book ? `${book}${chapter ? ` ${chapter}` : ""}` : "Bibbia";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Hero header with marine theme */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <LinearGradient colors={["#0B2A4A", "#0A1B3A", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {w > 0 && (
          <>
            <SunriseGlow width={w} height={190} />
            <FishingNet width={w} height={190} gap={28} opacity={0.06} />
            <SeaWaves width={w} height={64} />
          </>
        )}
        <View style={styles.topBar}>
          <PressableScale testID="bibbia-back" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </PressableScale>
          <Text style={styles.topTitle}>Bibbia</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.heroChapter} numberOfLines={1}>{chapterTitle}</Text>
        {!!chapter && <Text style={styles.heroSub}>Capitolo {chapter}</Text>}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : !verse ? (
        <View style={styles.center}><Text style={styles.dim}>Versetto non disponibile.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(400)}>
            {/* Highlighted verse of the day */}
            <View style={styles.verseBlock}>
              {!!vnum && <Text style={styles.vnum}>{vnum}</Text>}
              <Text style={styles.verseText}>{verse.text}</Text>
            </View>
            <Text style={styles.reference}>— {verse.reference}</Text>

            {/* Meditazione di oggi */}
            <View style={styles.medHeader}>
              <View style={styles.medIcon}><Ionicons name="sparkles" size={16} color={colors.brandPrimary} /></View>
              <Text style={styles.medTitle}>Meditazione di oggi</Text>
            </View>

            {medLoading ? (
              <View style={styles.medLoading}>
                <ActivityIndicator color={colors.brandPrimary} />
                <Text style={styles.medLoadingText}>Sto preparando la riflessione…</Text>
              </View>
            ) : medError ? (
              <View style={styles.medCard}>
                <Text style={styles.medBody}>Meditazione non disponibile al momento. Riprova più tardi.</Text>
              </View>
            ) : med ? (
              <>
                <View style={styles.medCard}>
                  <Text style={styles.medBody}>{med.meditation}</Text>
                </View>
                {!!med.reflection && (
                  <View style={styles.reflectCard}>
                    <Ionicons name="help-circle-outline" size={20} color={colors.onBrandTertiary} />
                    <Text style={styles.reflectText}>{med.reflection}</Text>
                  </View>
                )}
                <Text style={styles.medFoot}>Prenditi un momento per parlarne personalmente con Dio.</Text>
              </>
            ) : null}
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, overflow: "hidden" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  topTitle: { color: colors.white, fontSize: 16, fontWeight: "800" },
  heroChapter: { color: colors.white, fontSize: 30, fontWeight: "800", marginTop: spacing.lg, letterSpacing: -0.5 },
  heroSub: { color: colors.brandSecondary, fontSize: 14, fontWeight: "700", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  dim: { color: colors.onSurfaceSecondary, fontSize: 15 },
  verseBlock: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.lg, padding: spacing.lg, borderLeftWidth: 4, borderLeftColor: colors.brandPrimary },
  vnum: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800", marginTop: 3 },
  verseText: { flex: 1, color: colors.navy, fontSize: 19, fontWeight: "700", fontStyle: "italic", lineHeight: 29 },
  reference: { color: colors.onBrandTertiary, fontSize: 14, fontWeight: "800", marginTop: spacing.md, textAlign: "right" },
  medHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing["2xl"], marginBottom: spacing.md },
  medIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  medTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  medLoading: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  medLoadingText: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "600" },
  medCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  medBody: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 24 },
  reflectCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md },
  reflectText: { flex: 1, color: colors.onBrandTertiary, fontSize: 15, fontWeight: "700", fontStyle: "italic", lineHeight: 22 },
  medFoot: { color: colors.muted, fontSize: 12.5, fontStyle: "italic", textAlign: "center", marginTop: spacing.lg },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Share, ActivityIndicator, Pressable, Linking, useWindowDimensions } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, mediaUrl } from "@/src/api";
import MeditationPlayer from "@/src/components/MeditationPlayer";
import PressableScale from "@/src/components/PressableScale";
import { PROVIDER_LABEL } from "@/src/utils/embeds";
import { colors, spacing, radius } from "@/src/theme";

function fmtDate(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }); } catch { return ""; }
}

export default function MeditationDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [m, setM] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (id) api.meditationItem(id).then(setM).catch(() => setM(null)).finally(() => setLoading(false));
  }, [id]));

  const share = () => {
    if (!m) return;
    const link = m.video_url || (m.media_id ? mediaUrl(m.media_id) : "");
    Share.share({ message: `Guarda "${m.title}"${m.speaker ? ` di ${m.speaker}` : ""} su Pescatori di Uomini${link ? `\n${link}` : ""}` });
  };
  const download = () => {
    if (m?.media_id) Linking.openURL(mediaUrl(m.media_id, true));
    else if (m?.video_url) Linking.openURL(m.video_url);
  };

  if (loading) return <View style={styles.centerScreen}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  if (!m) return (
    <View style={styles.centerScreen}>
      <Text style={{ color: colors.onSurfaceSecondary }}>Meditazione non trovata.</Text>
      <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}><Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Torna indietro</Text></Pressable>
    </View>
  );

  const ct = m.content_type;
  const playerHeight = ct === "audio" ? 120 : ct === "pdf" ? Math.min(width * 1.3, 560) : (width * 9) / 16;
  const canDownload = (m.downloadable !== false) && (m.media_id || m.video_url);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="med-detail-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>Meditazione</Text>
        <Pressable testID="med-detail-share" onPress={share} hitSlop={12}><Ionicons name="share-social" size={22} color={colors.onSurface} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.playerBox, { height: playerHeight }]}>
          <MeditationPlayer m={m} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{m.title}</Text>
          {!!m.subtitle && <Text style={styles.subtitle}>{m.subtitle}</Text>}
          <View style={styles.metaRow}>
            {!!m.speaker && <View style={styles.metaPill}><Ionicons name="person" size={13} color={colors.brandPrimary} /><Text style={styles.metaText}>{m.speaker}</Text></View>}
            {!!m.category && <View style={styles.metaPill}><Ionicons name="pricetag" size={13} color={colors.brandPrimary} /><Text style={styles.metaText}>{m.category}</Text></View>}
            {!!m.duration && <View style={styles.metaPill}><Ionicons name="time-outline" size={13} color={colors.brandPrimary} /><Text style={styles.metaText}>{m.duration}</Text></View>}
            {!!m.provider && m.provider !== "upload" && <View style={styles.metaPill}><Ionicons name="globe-outline" size={13} color={colors.brandPrimary} /><Text style={styles.metaText}>{PROVIDER_LABEL[m.provider] || m.provider}</Text></View>}
          </View>
          <Text style={styles.date}>{fmtDate(m.publish_date)}</Text>

          {!!m.verse && (
            <View style={styles.verseCard}>
              <MaterialCommunityIcons name="book-cross" size={20} color={colors.brandSecondary} />
              <Text style={styles.verseText}>“{m.verse}”</Text>
            </View>
          )}

          {!!m.description && <Text style={styles.desc}>{m.description}</Text>}

          <View style={styles.actions}>
            <PressableScale testID="med-share-btn" style={styles.shareBtn} onPress={share}>
              <Ionicons name="share-social" size={18} color={colors.white} />
              <Text style={styles.shareText}>Condividi</Text>
            </PressableScale>
            {canDownload && (
              <PressableScale testID="med-download-btn" style={styles.dlBtn} onPress={download}>
                <Ionicons name="download-outline" size={18} color={colors.onSurface} />
                <Text style={styles.dlText}>Scarica</Text>
              </PressableScale>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centerScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  topTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800", flex: 1, textAlign: "center", marginHorizontal: spacing.md },
  playerBox: { width: "100%", backgroundColor: "#000" },
  body: { padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: "800", lineHeight: 28 },
  subtitle: { color: colors.onSurfaceSecondary, fontSize: 15, marginTop: 4, fontWeight: "600" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  metaText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
  date: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: spacing.md },
  verseCard: { flexDirection: "row", gap: spacing.md, alignItems: "center", backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  verseText: { flex: 1, color: colors.white, fontSize: 15, fontStyle: "italic", lineHeight: 22, fontWeight: "600" },
  desc: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 24, marginTop: spacing.lg },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  shareBtn: { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill },
  shareText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  dlBtn: { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  dlText: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Share, ActivityIndicator, Pressable, Linking, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, mediaUrl } from "@/src/api";
import { goBackOrHome } from "@/src/utils/nav";
import MeditationPlayer from "@/src/components/MeditationPlayer";
import PressableScale from "@/src/components/PressableScale";
import { PROVIDER_LABEL } from "@/src/utils/embeds";
import { sectionLabel } from "@/src/utils/sections";
import { colors, spacing, radius } from "@/src/theme";

function fmtDate(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }); } catch { return ""; }
}

export default function ContentDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { section, id } = useLocalSearchParams<{ section: string; id: string }>();
  const label = sectionLabel(section);
  const [m, setM] = useState<any>(null);
  const [siblings, setSiblings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.all([
      api.contentItem(id!).catch(() => null),
      api.contents(section!).catch(() => []),
    ]).then(([item, list]) => { setM(item); setSiblings(list as any[]); }).finally(() => setLoading(false));
  }, [id, section]));

  const share = () => {
    if (!m) return;
    const link = m.video_url || (m.media_id ? mediaUrl(m.media_id) : "");
    Share.share({ message: `Guarda "${m.title}"${m.author ? ` di ${m.author}` : ""} su Pescatori di Uomini${link ? `\n${link}` : ""}` });
  };
  const download = () => {
    if (m?.media_id) Linking.openURL(mediaUrl(m.media_id, true));
    else if (m?.video_url) Linking.openURL(m.video_url);
  };

  if (loading) return <View style={styles.centerScreen}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  if (!m) return (
    <View style={styles.centerScreen}>
      <Text style={{ color: colors.onSurfaceSecondary }}>Contenuto non trovato.</Text>
      <Pressable onPress={() => goBackOrHome()} style={{ marginTop: 12 }}><Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Torna indietro</Text></Pressable>
    </View>
  );

  const idx = siblings.findIndex((s) => s.id === m.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const related = siblings.filter((s) => s.id !== m.id && s.category === m.category).slice(0, 6);

  const ct = m.content_type;
  const hasMedia = m.media_id || m.video_url;
  const playerHeight = ct === "audio" ? 120 : ct === "pdf" ? Math.min(width * 1.3, 560) : (width * 9) / 16;
  const canDownload = (m.downloadable !== false) && (m.media_id || m.video_url);
  const goTo = (cid: string) => router.replace(`/c/${section}/${cid}` as any);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="cd-back" onPress={() => goBackOrHome()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{label}</Text>
        <Pressable testID="cd-share" onPress={share} hitSlop={12}><Ionicons name="share-social" size={22} color={colors.onSurface} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {hasMedia ? (
          <View style={[styles.playerBox, { height: playerHeight }]}><MeditationPlayer m={m} /></View>
        ) : m.thumbnail ? (
          <Image source={{ uri: m.thumbnail }} style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.navy }} contentFit="cover" />
        ) : null}

        <View style={styles.body}>
          <Text style={styles.title}>{m.title}</Text>
          {!!m.subtitle && <Text style={styles.subtitle}>{m.subtitle}</Text>}
          <View style={styles.metaRow}>
            {!!m.author && <View style={styles.metaPill}><Ionicons name="person" size={13} color={colors.brandPrimary} /><Text style={styles.metaText}>{m.author}</Text></View>}
            {!!m.category && <View style={styles.metaPill}><Ionicons name="pricetag" size={13} color={colors.brandPrimary} /><Text style={styles.metaText}>{m.category}</Text></View>}
            {!!m.duration && <View style={styles.metaPill}><Ionicons name="time-outline" size={13} color={colors.brandPrimary} /><Text style={styles.metaText}>{m.duration}</Text></View>}
            {!!m.provider && m.provider !== "upload" && <View style={styles.metaPill}><Ionicons name="globe-outline" size={13} color={colors.brandPrimary} /><Text style={styles.metaText}>{PROVIDER_LABEL[m.provider] || m.provider}</Text></View>}
          </View>
          <Text style={styles.date}>{fmtDate(m.publish_date)}</Text>

          {Array.isArray(m.tags) && m.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {m.tags.map((t: string) => <View key={t} style={styles.tag}><Text style={styles.tagText}>#{t}</Text></View>)}
            </View>
          )}

          {!!m.description && <Text style={styles.desc}>{m.description}</Text>}

          <View style={styles.actions}>
            <PressableScale testID="cd-share-btn" style={styles.shareBtn} onPress={share}>
              <Ionicons name="share-social" size={18} color={colors.white} />
              <Text style={styles.shareText}>Condividi</Text>
            </PressableScale>
            {canDownload && (
              <PressableScale testID="cd-download-btn" style={styles.dlBtn} onPress={download}>
                <Ionicons name="download-outline" size={18} color={colors.onSurface} />
                <Text style={styles.dlText}>Scarica</Text>
              </PressableScale>
            )}
          </View>

          {(prev || next) && (
            <View style={styles.navRow}>
              {prev ? (
                <Pressable testID="cd-prev" style={styles.navBtn} onPress={() => goTo(prev.id)}>
                  <Ionicons name="chevron-back" size={18} color={colors.brandPrimary} />
                  <Text style={styles.navText} numberOfLines={1}>{prev.title}</Text>
                </Pressable>
              ) : <View style={{ flex: 1 }} />}
              {next ? (
                <Pressable testID="cd-next" style={[styles.navBtn, { justifyContent: "flex-end" }]} onPress={() => goTo(next.id)}>
                  <Text style={[styles.navText, { textAlign: "right" }]} numberOfLines={1}>{next.title}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.brandPrimary} />
                </Pressable>
              ) : <View style={{ flex: 1 }} />}
            </View>
          )}

          {related.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <Text style={styles.relTitle}>Contenuti correlati</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.md }}>
                {related.map((r) => (
                  <PressableScale key={r.id} testID={`cd-rel-${r.id}`} style={styles.relCard} onPress={() => goTo(r.id)}>
                    {r.thumbnail ? <Image source={{ uri: r.thumbnail }} style={styles.relThumb} contentFit="cover" /> : <View style={[styles.relThumb, styles.relEmpty]}><MaterialCommunityIcons name="play-circle" size={30} color={colors.white} /></View>}
                    <Text style={styles.relCardTitle} numberOfLines={2}>{r.title}</Text>
                  </PressableScale>
                ))}
              </ScrollView>
            </View>
          )}
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
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  tag: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  tagText: { color: colors.onBrandTertiary, fontSize: 12, fontWeight: "700" },
  desc: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 24, marginTop: spacing.lg },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  shareBtn: { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill },
  shareText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  dlBtn: { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  dlText: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  navRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  navBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  navText: { flex: 1, color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
  relTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  relCard: { width: 150 },
  relThumb: { width: 150, height: 84, borderRadius: radius.md, backgroundColor: colors.navy },
  relEmpty: { alignItems: "center", justifyContent: "center" },
  relCardTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "700", marginTop: spacing.sm, lineHeight: 18 },
});

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Share, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { goBackOrHome } from "@/src/utils/nav";
import { usePlayer } from "@/src/context/PlayerContext";
import { useAuth } from "@/src/context/AuthContext";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function PodcastDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { playTrack, track, isPlaying, togglePlay } = usePlayer();
  const { user } = useAuth();
  const [p, setP] = useState<any>(null);
  const [fav, setFav] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.podcast(id).then(setP).catch(() => {});
    if (user) api.favoriteIds().then((ids: string[]) => setFav(ids.includes(id))).catch(() => {});
  }, [id, user]);

  if (!p) return <View style={[styles.container, styles.center]}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;

  const isThis = track?.id === p.id;
  const play = () => {
    if (isThis) { togglePlay(); return; }
    playTrack({ id: p.id, title: p.title, artist: p.author, artwork: p.artwork, url: p.audio_url, isLive: false });
    if (user) api.addHistory(p.id).catch(() => {});
  };
  const toggleFav = async () => {
    if (!user) { router.push("/login"); return; }
    try { const r = await api.toggleFavorite(p.id); setFav(r.favorited); } catch {}
  };
  const date = p.publish_date || p.created_at;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: p.artwork }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={30} />
          <LinearGradient colors={["rgba(10,17,40,0.5)", "rgba(10,17,40,0.98)"]} style={StyleSheet.absoluteFill} />
          <PressableScale testID="pod-detail-back" onPress={() => goBackOrHome()} style={[styles.backBtn, { top: insets.top + spacing.sm }]}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
          <View style={[styles.heroContent, { paddingTop: insets.top + spacing["2xl"] }]}>
            <Image source={{ uri: p.artwork }} style={styles.cover} contentFit="cover" />
            {p.category ? <View style={styles.catBadge}><Text style={styles.catText}>{p.category}</Text></View> : null}
            <Text style={styles.title}>{p.title}</Text>
            {p.subtitle ? <Text style={styles.subtitle}>{p.subtitle}</Text> : null}
            <View style={styles.metaRow}>
              <Ionicons name="person-circle-outline" size={16} color={colors.brandSecondary} />
              <Text style={styles.meta}>{p.author || "Pescatori di Uomini"}</Text>
              {p.duration ? <><Text style={styles.dot}>·</Text><Text style={styles.meta}>{p.duration}</Text></> : null}
            </View>
            <Text style={styles.meta}>{date ? new Date(date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : ""}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <PressableScale testID="pod-detail-play" style={styles.playBtn} onPress={play}>
            <Ionicons name={isThis && isPlaying ? "pause" : "play"} size={22} color={colors.navy} />
            <Text style={styles.playText}>{isThis && isPlaying ? "In pausa" : "Riproduci"}</Text>
          </PressableScale>
          <PressableScale testID="pod-detail-fav" style={styles.circleBtn} onPress={toggleFav}>
            <Ionicons name={fav ? "heart" : "heart-outline"} size={22} color={fav ? colors.error : colors.onSurface} />
          </PressableScale>
          <PressableScale testID="pod-detail-share" style={styles.circleBtn} onPress={() => Share.share({ message: `Ascolta "${p.title}" su Pescatori di Uomini` })}>
            <Ionicons name="share-outline" size={22} color={colors.onSurface} />
          </PressableScale>
        </View>

        {p.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descrizione</Text>
            <Text style={styles.body}>{p.description}</Text>
          </View>
        ) : null}
        {p.tags?.length ? (
          <View style={styles.tags}>
            {p.tags.map((t: string) => <View key={t} style={styles.tag}><Text style={styles.tagText}>#{t}</Text></View>)}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  hero: { backgroundColor: colors.navy, paddingBottom: spacing.xl },
  backBtn: { position: "absolute", left: spacing.lg, zIndex: 2, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  heroContent: { alignItems: "center", paddingHorizontal: spacing.xl },
  cover: { width: 180, height: 180, borderRadius: radius.lg, backgroundColor: colors.navyCard, marginBottom: spacing.lg },
  catBadge: { backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  catText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  title: { color: colors.white, fontSize: 24, fontWeight: "800", textAlign: "center", marginTop: spacing.md },
  subtitle: { color: colors.muted, fontSize: 15, textAlign: "center", marginTop: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  meta: { color: colors.muted, fontSize: 13 },
  dot: { color: colors.muted },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  playBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border, paddingVertical: spacing.md, borderRadius: radius.pill },
  playText: { color: colors.navy, fontSize: 16, fontWeight: "800" },
  circleBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm },
  body: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 24 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, padding: spacing.lg },
  tag: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  tagText: { color: colors.onBrandTertiary, fontSize: 13, fontWeight: "700" },
});

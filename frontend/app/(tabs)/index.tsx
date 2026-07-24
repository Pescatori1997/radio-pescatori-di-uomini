import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { usePlayer, Track } from "@/src/context/PlayerContext";
import Collaborators from "@/src/components/Collaborators";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const LOGO = require("@/assets/images/logo.png");
const STUDIO = require("@/assets/images/studio.png");

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { playTrack, track, isPlaying, togglePlay } = usePlayer();
  const [live, setLive] = useState<any>(null);
  const [podcasts, setPodcasts] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [l, p, n, pr] = await Promise.all([
        api.liveStatus(),
        api.podcasts(),
        api.news(),
        api.programs(),
      ]);
      setLive(l);
      setPodcasts(p);
      setNews(n);
      setPrograms(pr);
    } catch (e) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const liveTrack: Track | null = live
    ? { id: "live", title: live.title, artist: live.artist, artwork: live.artwork, url: live.stream_url, isLive: true }
    : null;

  const isLivePlaying = track?.id === "live" && isPlaying;

  const onListen = () => {
    if (!liveTrack) return;
    if (track?.id === "live") togglePlay();
    else playTrack(liveTrack);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      testID="home-screen"
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: 180 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
    >
      {/* HERO */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        <Image
          source={STUDIO}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          blurRadius={1}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,17,40,0.65)" }]} />
        <LinearGradient colors={["rgba(10,17,40,0.35)", "rgba(10,17,40,0.92)"]} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInDown.duration(500)} style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Image source={LOGO} style={styles.logoImg} contentFit="contain" />
          </View>
          <View>
            <Text style={styles.brandName}>Pescatori di Uomini</Text>
            <Text style={styles.slogan}>La radio che annuncia il Vangelo</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(120)} style={styles.liveBadge} testID="live-indicator">
          <View style={[styles.dot, { backgroundColor: live?.is_live ? colors.success : colors.error }]} />
          <Text style={styles.liveText}>{live?.is_live ? "IN DIRETTA ORA" : "OFFLINE"}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(180)}>
          <Text style={styles.nowLabel}>ORA IN ONDA</Text>
          <Text style={styles.nowTitle} numberOfLines={1}>{live?.title}</Text>
          <Text style={styles.nowArtist} numberOfLines={1}>{live?.artist}</Text>
        </Animated.View>

        <PressableScale testID="listen-live-button" style={styles.cta} onPress={onListen}>
          <Ionicons name={isLivePlaying ? "pause" : "play"} size={22} color={colors.navy} />
          <Text style={styles.ctaText}>{isLivePlaying ? "In riproduzione" : "Ascolta la Diretta"}</Text>
        </PressableScale>
      </View>

      {/* PODCASTS */}
      <SectionHeader title="Ultimi Podcast" onPress={() => router.push("/podcast")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {podcasts.slice(0, 6).map((p) => (
          <PressableScale
            key={p.id}
            testID={`home-podcast-${p.id}`}
            style={styles.podCard}
            onPress={() => playTrack({ id: p.id, title: p.title, artist: p.author, artwork: p.artwork, url: p.audio_url, isLive: false })}
          >
            <Image source={{ uri: p.artwork }} style={styles.podArt} contentFit="cover" />
            <Text numberOfLines={2} style={styles.podTitle}>{p.title}</Text>
            <Text numberOfLines={1} style={styles.podCat}>{p.category} · {p.duration}</Text>
          </PressableScale>
        ))}
      </ScrollView>

      {/* NEWS */}
      <SectionHeader title="Ultime Notizie" onPress={() => router.push("/news")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {news.slice(0, 5).map((n) => (
          <PressableScale key={n.id} testID={`home-news-${n.id}`} style={styles.newsCard} onPress={() => router.push(`/news/${n.id}`)}>
            <Image source={{ uri: n.image }} style={styles.newsImg} contentFit="cover" />
            <LinearGradient colors={["transparent", "rgba(10,17,40,0.9)"]} style={styles.newsScrim} />
            <View style={styles.newsBadge}><Text style={styles.newsBadgeText}>{n.category}</Text></View>
            <Text numberOfLines={2} style={styles.newsTitle}>{n.title}</Text>
          </PressableScale>
        ))}
      </ScrollView>

      {/* PROGRAMS */}
      <SectionHeader title="Programmi della settimana" onPress={() => router.push("/palinsesto")} />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
        {programs.slice(0, 4).map((pr) => (
          <View key={pr.id} style={styles.progRow}>
            <View style={styles.progTime}><Text style={styles.progTimeText}>{pr.time}</Text><Text style={styles.progDay}>{pr.day.slice(0, 3)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.progName} numberOfLines={1}>{pr.name}</Text>
              <Text style={styles.progHost} numberOfLines={1}>{pr.host}</Text>
            </View>
          </View>
        ))}
      </View>

      <Collaborators />

      <Pressable testID="prayer-cta" style={styles.prayerCta} onPress={() => router.push("/prayer")}>
        <Ionicons name="heart" size={20} color={colors.brandPrimary} />
        <Text style={styles.prayerCtaText}>Invia una richiesta di preghiera</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </ScrollView>
  );
}

function SectionHeader({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onPress} hitSlop={8}><Text style={styles.seeAll}>Vedi tutti</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  hero: { padding: spacing.xl, paddingBottom: spacing.xl, overflow: "hidden" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", overflow: "hidden", shadowColor: colors.brandPrimary, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  logoImg: { width: 46, height: 46 },
  brandName: { color: colors.white, fontSize: 17, fontWeight: "800" },
  slogan: { color: colors.brandSecondary, fontSize: 13, marginTop: 2 },
  nowLabel: { color: colors.brandSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginTop: spacing.md },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xl, backgroundColor: "rgba(255,255,255,0.12)", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  dot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { color: colors.white, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  nowTitle: { color: colors.white, fontSize: 26, fontWeight: "800", marginTop: 4, letterSpacing: -0.5 },
  nowArtist: { color: colors.muted, fontSize: 14, marginTop: 2 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.white, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.lg, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  ctaText: { color: colors.navy, fontSize: 16, fontWeight: "800" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  seeAll: { color: colors.brandPrimary, fontSize: 13, fontWeight: "600" },
  hRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  podCard: { width: 150 },
  podArt: { width: 150, height: 150, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, shadowColor: colors.navy, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  podTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700", marginTop: spacing.sm },
  podCat: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  newsCard: { width: 260, height: 160, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.navy, shadowColor: colors.navy, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  newsImg: { ...StyleSheet.absoluteFillObject },
  newsScrim: { ...StyleSheet.absoluteFillObject },
  newsBadge: { position: "absolute", top: spacing.md, left: spacing.md, backgroundColor: colors.brandPrimary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  newsBadgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  newsTitle: { position: "absolute", bottom: spacing.md, left: spacing.md, right: spacing.md, color: colors.white, fontSize: 15, fontWeight: "700" },
  progRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  progTime: { alignItems: "center", width: 52 },
  progTimeText: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  progDay: { color: colors.muted, fontSize: 11, textTransform: "uppercase" },
  progName: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  progHost: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  prayerCta: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.xl, backgroundColor: colors.brandTertiary, padding: spacing.lg, borderRadius: radius.md },
  prayerCtaText: { flex: 1, color: colors.onBrandTertiary, fontSize: 15, fontWeight: "700" },
});

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate } from "react-native-reanimated";
import { api, audioSrc } from "@/src/api";
import { currentProgram } from "@/src/utils/onair";
import { usePlayer } from "@/src/context/PlayerContext";
import { useSettings } from "@/src/context/SettingsContext";
import WeatherWidget from "@/src/components/WeatherWidget";
import Collaborators from "@/src/components/Collaborators";
import WhatsAppSection from "@/src/components/WhatsAppSection";
import VerseOfDayCard from "@/src/components/VerseOfDayCard";
import CommunityStats from "@/src/components/community/CommunityStats";
import BibleCard from "@/src/components/BibleCard";
import ReadingPlansCard from "@/src/components/ReadingPlansCard";
import BachecaCard from "@/src/components/BachecaCard";
import ShowcaseCarousel from "@/src/components/showcase/ShowcaseCarousel";
import ScaleBox from "@/src/components/home/ScaleBox";
import { PulsingDot, SoundRings } from "@/src/components/LiveHeroFx";
import PressableScale from "@/src/components/PressableScale";
import Logo from "@/src/components/Logo";
import { mergeHomeLayout, scaleFor, HomeSectionCfg } from "@/src/homeLayout";
import { useLabel } from "@/src/utils/labels";
import { colors, spacing, radius } from "@/src/theme";

const STUDIO = require("@/assets/images/studio.png");

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { playLive, playTrack, track, isPlaying, liveInfo } = usePlayer();
  const { sectionVisible, settings } = useSettings();
  const t = useLabel();
  const [podcasts, setPodcasts] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, pr] = await Promise.all([api.podcasts(), api.programs()]);
      setPodcasts(p);
      setPrograms(pr);
    } catch (e) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const live = liveInfo;
  const isLivePlaying = track?.id === "live" && isPlaying;
  const isLive = !!(liveInfo?.live_mode || live?.is_live);
  const onAir = currentProgram(programs);

  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const glowStyle = useAnimatedStyle(() => ({ opacity: interpolate(glow.value, [0, 1], [0.25, 0.55]), transform: [{ scale: interpolate(glow.value, [0, 1], [0.92, 1.08]) }] }));
  const ctaPulse = useAnimatedStyle(() => (isLive ? { transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.025]) }] } : {}));
  const onAirPics: string[] = onAir
    ? ((onAir.images?.length ? onAir.images : (onAir.presenters || []).map((p: any) => p.image)).filter(Boolean))
    : [];

  const onListen = () => { router.push("/diretta"); };

  // ---- Section renderers (order/width/size come from the admin layout) ----
  const sectionNode = (key: string, half = false): React.ReactNode => {
    switch (key) {
      case "meteo":
        return <View style={[styles.weatherWrap, half && styles.wrapHalf]}><WeatherWidget /></View>;
      case "community":
        return <CommunityStats />;
      case "podcast":
        return (
          <>
            <SectionHeader title={t("home_podcast")} onPress={() => router.push("/podcast")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {podcasts.slice(0, 6).map((p) => (
                <PressableScale key={p.id} testID={`home-podcast-${p.id}`} style={styles.podCard}
                  onPress={() => playTrack({ id: p.id, title: p.title, artist: p.author, artwork: p.artwork, url: audioSrc(p.audio_url), isLive: false })}>
                  <Image source={{ uri: p.artwork }} style={styles.podArt} contentFit="cover" />
                  <Text numberOfLines={2} style={styles.podTitle}>{p.title}</Text>
                  <Text numberOfLines={1} style={styles.podCat}>{p.category} · {p.duration}</Text>
                </PressableScale>
              ))}
            </ScrollView>
          </>
        );
      case "vetrina":
        return <ShowcaseCarousel />;
      case "palinsesto":
        return (
          <>
            <SectionHeader title={t("home_palinsesto")} onPress={() => router.push("/palinsesto")} />
            <View style={half ? undefined : { paddingHorizontal: spacing.lg }}>
              <PressableScale testID="home-onair" style={styles.onAirCard} onPress={() => router.push("/palinsesto")}>
                {onAir ? (
                  <>
                    {onAirPics.length ? (
                      <View style={styles.onAirStack}>
                        {onAirPics.slice(0, 3).map((uri, i) => (
                          <Image key={i} source={{ uri }} style={[styles.onAirAvatar, { marginLeft: i === 0 ? 0 : -16, borderColor: colors.surfaceSecondary, zIndex: 10 - i }]} contentFit="cover" />
                        ))}
                      </View>
                    ) : (
                      <View style={[styles.onAirAvatar, styles.onAirAvatarEmpty]}><Ionicons name="mic" size={22} color={colors.brandPrimary} /></View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.onAirBadge}><View style={styles.onAirDot} /><Text style={styles.onAirBadgeText}>IN ONDA</Text></View>
                      <Text style={styles.onAirTitle} numberOfLines={1}>{onAir.title}</Text>
                      {!!onAir.host && <Text style={styles.onAirHost} numberOfLines={1}>{onAir.host}</Text>}
                      {(onAir.start_time || onAir.end_time) ? <Text style={styles.onAirTime}>{onAir.start_time}{onAir.end_time ? ` – ${onAir.end_time}` : ""}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                  </>
                ) : (
                  <>
                    <View style={[styles.onAirAvatar, styles.onAirAvatarEmpty]}><Ionicons name="radio-outline" size={22} color={colors.muted} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.onAirTitle} numberOfLines={2}>Nessun programma in onda</Text>
                      <Text style={styles.onAirHost} numberOfLines={2}>Visualizza il palinsesto completo</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                  </>
                )}
              </PressableScale>
              <PressableScale testID="home-view-schedule" style={styles.scheduleBtn} onPress={() => router.push("/palinsesto")}>
                <Ionicons name="calendar-outline" size={18} color={colors.brandPrimary} />
                <Text style={styles.scheduleBtnText}>Visualizza palinsesto</Text>
              </PressableScale>
            </View>
          </>
        );
      case "team":
        return <Collaborators />;
      case "whatsapp":
        return <WhatsAppSection />;
      case "verse":
        return <VerseOfDayCard />;
      case "bibbia":
        return <BibleCard inGrid={false} />;
      case "piani":
        return <ReadingPlansCard inGrid={false} />;
      case "traguardi":
        return <BachecaCard inGrid={false} />;
      case "prayer":
        return (
          <>
            <Pressable testID="prayer-cta" style={[styles.prayerCta, half && styles.ctaHalf]} onPress={() => router.push("/prayer")}>
              <Ionicons name="heart" size={20} color={colors.brandPrimary} />
              <Text style={styles.prayerCtaText} numberOfLines={2}>Invia una richiesta di preghiera</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
            <Pressable testID="prayer-board-cta" style={[styles.boardCta, half && styles.ctaHalf]} onPress={() => router.push("/prayer-board")}>
              <View style={styles.boardIcon}><Ionicons name="heart" size={20} color={colors.white} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.boardTitle} numberOfLines={2}>Bacheca delle Richieste di Preghiera</Text>
                <Text style={styles.boardSub} numberOfLines={2}>Prega per i tuoi fratelli e sorelle</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </>
        );
      default:
        return null;
    }
  };

  // Card components that render nicely edge-to-edge inside a half cell.
  const cardInGrid: Record<string, (half: boolean) => React.ReactNode> = {
    bibbia: (half) => <BibleCard inGrid={half} />,
    piani: (half) => <ReadingPlansCard inGrid={half} />,
    traguardi: (half) => <BachecaCard inGrid={half} />,
  };

  const renderSection = (cfg: HomeSectionCfg, half: boolean) => {
    const node = half && cardInGrid[cfg.key] ? cardInGrid[cfg.key](true) : sectionNode(cfg.key, half);
    const scale = scaleFor(cfg.width, cfg.size);
    return <ScaleBox scale={scale}>{node}</ScaleBox>;
  };

  // Build the ordered, visibility-filtered layout, pairing consecutive halves.
  // Desktop (wide) and mobile use independent configurations set from the Admin.
  const rawLayout = isDesktop
    ? (settings?.home_layout_desktop ?? settings?.home_layout)
    : settings?.home_layout;
  const layout = mergeHomeLayout(rawLayout).filter((s) => sectionVisible(s.key));
  const rows: HomeSectionCfg[][] = [];
  let buf: HomeSectionCfg[] = [];
  const flush = () => { if (buf.length) { rows.push(buf); buf = []; } };
  layout.forEach((it) => {
    if (it.width === "half") { buf.push(it); if (buf.length === 2) flush(); }
    else { flush(); rows.push([it]); }
  });
  flush();

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  }

  return (
    <ScrollView
      testID="home-screen"
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: 180 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
    >
      {/* HERO (fixed, not part of the configurable layout) */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        <Image source={STUDIO} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" blurRadius={1} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,17,40,0.65)" }]} />
        <LinearGradient colors={["rgba(10,17,40,0.35)", "rgba(10,17,40,0.92)"]} style={StyleSheet.absoluteFill} />
        <Animated.View pointerEvents="none" style={[styles.heroGlow, glowStyle]} />
        <Animated.View entering={FadeInDown.duration(500)} style={styles.brandRow}>
          <View>
            {isLive && <SoundRings size={52} />}
            <Logo size={52} shadow />
          </View>
          <View>
            <Text style={styles.brandName}>Pescatori di Uomini</Text>
            <Text style={styles.slogan}>La radio che annuncia il Vangelo</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(120)} style={styles.liveBadge} testID="live-indicator">
          {isLive ? <PulsingDot color={colors.success} size={8} /> : <View style={[styles.dot, { backgroundColor: colors.error }]} />}
          <Text style={styles.liveText}>{liveInfo?.live_mode ? "IN DIRETTA" : live?.is_live ? "IN DIRETTA ORA" : "NON IN ONDA"}</Text>
        </Animated.View>

        {liveInfo?.live_mode ? (
          <>
            <Animated.View entering={FadeInDown.duration(500).delay(180)} testID="live-now-banner">
              <Text style={styles.liveNowTitle}>🔴 Siamo in diretta</Text>
              <Text style={styles.liveNowSub}>Guarda la diretta streaming ora in corso</Text>
            </Animated.View>
            <Animated.View style={ctaPulse}>
              <PressableScale testID="watch-live-button" style={styles.cta} onPress={() => router.push("/live")}>
                <Ionicons name="videocam" size={22} color={colors.navy} />
                <Text style={styles.ctaText}>Guarda la diretta</Text>
              </PressableScale>
            </Animated.View>
          </>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(500).delay(180)}>
              <Text style={styles.nowLabel}>ORA IN ONDA</Text>
              <Text style={styles.nowTitle} numberOfLines={1}>{live?.title}</Text>
              <Text style={styles.nowArtist} numberOfLines={1}>{live?.artist}</Text>
            </Animated.View>
            <Animated.View style={ctaPulse}>
              <PressableScale testID="listen-live-button" style={styles.cta} onPress={onListen}>
                <Ionicons name={isLivePlaying ? "pause" : "play"} size={22} color={colors.navy} />
                <Text style={styles.ctaText}>{isLivePlaying ? "In riproduzione" : "Ascolta la Diretta"}</Text>
              </PressableScale>
            </Animated.View>
          </>
        )}
      </View>

      {/* DYNAMIC, ADMIN-CONFIGURABLE SECTIONS */}
      {rows.map((row, ri) => {
        if (row.length === 1 && row[0].width === "full") {
          return <View key={`r${ri}`}>{renderSection(row[0], false)}</View>;
        }
        return (
          <View key={`r${ri}`} style={styles.halfRow}>
            {row.map((it) => (
              <View key={it.key} style={styles.halfCell}>{renderSection(it, true)}</View>
            ))}
          </View>
        );
      })}
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
  halfRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", paddingHorizontal: spacing.xs },
  halfCell: { width: "50%", paddingHorizontal: spacing.xs },
  hero: { padding: spacing.xl, paddingBottom: spacing.xl, overflow: "hidden" },
  heroGlow: { position: "absolute", top: 40, alignSelf: "center", width: 320, height: 320, borderRadius: 160, backgroundColor: colors.brandPrimary },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandName: { color: colors.white, fontSize: 17, fontWeight: "800" },
  slogan: { color: colors.brandSecondary, fontSize: 13, marginTop: 2 },
  nowLabel: { color: colors.brandSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginTop: spacing.md },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xl, backgroundColor: "rgba(255,255,255,0.12)", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  dot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { color: colors.white, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  nowTitle: { color: colors.white, fontSize: 26, fontWeight: "800", marginTop: 4, letterSpacing: -0.5 },
  nowArtist: { color: colors.muted, fontSize: 14, marginTop: 2 },
  weatherWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  wrapHalf: { paddingHorizontal: 0, marginTop: 0 },
  ctaHalf: { marginHorizontal: 0 },
  liveNowTitle: { color: colors.white, fontSize: 26, fontWeight: "800", marginTop: spacing.md, letterSpacing: -0.5 },
  liveNowSub: { color: colors.muted, fontSize: 14, marginTop: 4 },
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
  onAirCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  onAirAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.navy, borderWidth: 2, borderColor: colors.brandPrimary },
  onAirStack: { flexDirection: "row", alignItems: "center" },
  onAirAvatarEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderColor: colors.border },
  onAirBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, backgroundColor: colors.error, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginBottom: 4 },
  onAirDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  onAirBadgeText: { color: colors.white, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  onAirTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  onAirHost: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  onAirTime: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700", marginTop: 3 },
  scheduleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brandPrimary },
  scheduleBtnText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800" },
  prayerCta: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.xl, backgroundColor: colors.brandTertiary, padding: spacing.lg, borderRadius: radius.md },
  prayerCtaText: { flex: 1, color: colors.onBrandTertiary, fontSize: 15, fontWeight: "700" },
  boardCta: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.navy, padding: spacing.lg, borderRadius: radius.md },
  boardIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  boardTitle: { color: colors.white, fontSize: 15, fontWeight: "800" },
  boardSub: { color: colors.brandSecondary, fontSize: 12.5, fontWeight: "600", marginTop: 2 },
});

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Platform } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, absUrl } from "@/src/api";
import { detectProvider, liveEmbedSrc } from "@/src/utils/embeds";
import EmbedFrame from "@/src/components/live/EmbedFrame";
import { colors, spacing, radius } from "@/src/theme";

export default function Diretta() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const lastUrl = useRef<string>("");

  const player = useVideoPlayer(null, (p) => { p.loop = false; p.staysActiveInBackground = true; });

  const applyLive = useCallback((d: any) => {
    setData(d);
    setLoaded(true);
    const onAir = d?.on_air && d?.media?.url;
    const filler = d?.filler || {};
    let rawUrl = "", isLive = false, loop = false, seek: number | null = null;
    if (onAir) {
      rawUrl = d.media.url;
      isLive = !!d.media.is_live;
      seek = isLive ? null : Math.max(0, Number(d?.offset_seconds || 0));
    } else if (filler.url && (filler.kind === "video" || filler.kind === "audio")) {
      rawUrl = filler.url; loop = true; seek = 0;
    }
    // Embeddable provider (YouTube/Vimeo/Facebook/...) → iframe/WebView, NOT expo-video.
    const provider = detectProvider(rawUrl);
    const embed = provider ? liveEmbedSrc(rawUrl, provider) : null;
    if (embed) {
      setEmbedUrl(embed);
      lastUrl.current = "";
      try { player.pause(); } catch {}
      return;
    }
    setEmbedUrl(null);
    const url = rawUrl ? absUrl(rawUrl) : "";
    try {
      if (url) {
        if (url !== lastUrl.current) {
          lastUrl.current = url;
          player.loop = loop;
          player.replace({ uri: url });
          if (seek != null) setTimeout(() => { try { player.currentTime = seek as number; player.play(); } catch {} }, 350);
          else setTimeout(() => { try { player.play(); } catch {} }, 350);
        } else if (seek != null && Math.abs((player.currentTime || 0) - seek) > 6) {
          player.currentTime = seek;
          player.play();
        } else {
          player.play();
        }
      } else {
        lastUrl.current = "";
        player.pause();
      }
    } catch {}
  }, [player]);

  const fetchLive = useCallback(() => {
    api.liveNow().then(applyLive).catch(() => setLoaded(true));
  }, [applyLive]);

  useFocusEffect(
    useCallback(() => {
      fetchLive();
      const iv = setInterval(fetchLive, 15000);
      return () => { clearInterval(iv); try { player.pause(); } catch {} };
    }, [fetchLive]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onAir = !!data?.on_air;
  const isVideo = data?.media?.kind === "video";
  const prog = data?.program;
  const nextP = data?.next;

  // Live-ticking countdown to the next scheduled program (off-air only).
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    if (onAir || !nextP?.starts_at) return;
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [onAir, nextP?.starts_at]);
  const countdown = (() => {
    if (onAir || !nextP?.starts_at) return null;
    const remain = Math.max(0, Math.floor((new Date(nextP.starts_at).getTime() - nowMs) / 1000));
    const hh = String(Math.floor(remain / 3600)).padStart(2, "0");
    const mm = String(Math.floor((remain % 3600) / 60)).padStart(2, "0");
    const ss = String(remain % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  })();
  const upNext = data?.up_next || [];
  const filler = data?.filler || {};
  const fillerMedia = !onAir && filler?.url && (filler.kind === "video" || filler.kind === "audio");
  const fillerMessage = !onAir && !fillerMedia && filler?.kind === "message" && !!filler?.message;

  const UpNext = upNext.length > 0 ? (
    <View style={styles.upNext}>
      <Text style={styles.upNextTitle}>A seguire</Text>
      {upNext.map((u: any) => (
        <View key={u.id} style={styles.upRow}>
          <Text style={styles.upTime}>{u.start_time}</Text>
          <Text style={styles.upTitle} numberOfLines={1}>{u.title}{u.host ? ` · ${u.host}` : ""}</Text>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable testID="diretta-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-down" size={28} color={colors.white} /></Pressable>
        <View style={styles.liveTag}><View style={styles.liveDot} /><Text style={styles.liveTagText}>DIRETTA</Text></View>
        <View style={{ width: 28 }} />
      </View>

      {!loaded ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandSecondary} size="large" /></View>
      ) : onAir && data?.media ? (
        <View style={styles.stage}>
          {embedUrl ? (
            <View style={styles.video}><EmbedFrame url={embedUrl} testID="diretta-embed" /></View>
          ) : isVideo ? (
            <VideoView player={player} style={styles.video} contentFit="contain" nativeControls allowsFullscreen />
          ) : (
            <View style={styles.audioStage}>
              {prog?.hero_image ? (
                <Image source={{ uri: absUrl(prog.hero_image) }} style={styles.audioArt} contentFit="cover" />
              ) : (
                <View style={[styles.audioArt, styles.audioArtEmpty]}><Ionicons name="radio" size={64} color={colors.brandSecondary} /></View>
              )}
              <View style={styles.audioWave}><Ionicons name="musical-notes" size={20} color={colors.brandSecondary} /><Text style={styles.audioWaveText}>In onda</Text></View>
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.progTitle} numberOfLines={2}>{prog?.title}</Text>
            {!!prog?.host && <Text style={styles.progHost} numberOfLines={1}>con {prog.host}</Text>}
            {!!(prog?.start_time && prog?.end_time) && <Text style={styles.progTime}>{prog.start_time} – {prog.end_time}{data?.media?.is_live ? "  ·  LIVE" : ""}</Text>}
          </View>
          {UpNext}
        </View>
      ) : fillerMedia ? (
        <View style={styles.stage}>
          {embedUrl ? (
            <View style={styles.video}><EmbedFrame url={embedUrl} testID="diretta-filler-embed" /></View>
          ) : filler.kind === "video" ? (
            <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
          ) : (
            <View style={styles.audioStage}>
              <View style={[styles.audioArt, styles.audioArtEmpty]}><Ionicons name="radio" size={64} color={colors.brandSecondary} /></View>
              <View style={styles.audioWave}><Ionicons name="musical-notes" size={20} color={colors.brandSecondary} /><Text style={styles.audioWaveText}>Programmazione</Text></View>
            </View>
          )}
          <View style={styles.info}><Text style={styles.progTitle}>Programmazione</Text><Text style={styles.progHost}>Nessuna diretta in questo momento</Text></View>
          {UpNext}
        </View>
      ) : (
        <View style={styles.center}>
          <View style={styles.offIcon}><Ionicons name="tv-outline" size={54} color={colors.muted} /></View>
          <Text style={styles.offTitle}>Nessuna diretta in corso</Text>
          {fillerMessage ? (
            <Text style={styles.offSub}>{filler.message}</Text>
          ) : onAir && prog ? (
            <Text style={styles.offSub}>{prog.title} è in onda ma non ha un contenuto da riprodurre.</Text>
          ) : nextP && countdown ? (
            <View style={styles.cdWrap}>
              <Text style={styles.cdLabel}>La diretta inizia tra</Text>
              <Text style={styles.cdTime}>{countdown}</Text>
              <Text style={styles.cdProg} numberOfLines={2}>{nextP.title}{nextP.start_time ? ` · ${nextP.start_time}` : ""}</Text>
            </View>
          ) : nextP ? (
            <Text style={styles.offSub}>Prossimo programma: <Text style={{ color: colors.white, fontWeight: "800" }}>{nextP.title}</Text>{nextP.start_time ? ` alle ${nextP.start_time}` : ""}</Text>
          ) : (
            <Text style={styles.offSub}>Torna più tardi per la prossima diretta.</Text>
          )}
          {UpNext}
          <Pressable testID="diretta-palinsesto" style={styles.schedBtn} onPress={() => router.push("/palinsesto" as any)}>
            <Ionicons name="calendar-outline" size={16} color={colors.white} /><Text style={styles.schedBtnText}>Vedi il palinsesto</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },
  liveTagText: { color: colors.white, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  stage: { flex: 1 },
  video: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", marginTop: spacing.md },
  audioStage: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: spacing.lg },
  audioArt: { width: 220, height: 220, borderRadius: 24, backgroundColor: colors.navySoft },
  audioArtEmpty: { alignItems: "center", justifyContent: "center" },
  audioWave: { flexDirection: "row", alignItems: "center", gap: 8 },
  audioWaveText: { color: colors.brandSecondary, fontSize: 14, fontWeight: "800" },
  info: { padding: spacing.xl, gap: 6 },
  progTitle: { color: colors.white, fontSize: 24, fontWeight: "900" },
  progHost: { color: "#CBD5E1", fontSize: 15, fontWeight: "600" },
  progTime: { color: colors.brandSecondary, fontSize: 14, fontWeight: "700", marginTop: 4 },
  offIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.navySoft, alignItems: "center", justifyContent: "center" },
  offTitle: { color: colors.white, fontSize: 20, fontWeight: "800", marginTop: spacing.sm },
  offSub: { color: "#94A3B8", fontSize: 15, textAlign: "center", lineHeight: 22, paddingHorizontal: spacing.lg },
  cdWrap: { alignItems: "center", gap: 6, marginTop: spacing.sm },
  cdLabel: { color: "#94A3B8", fontSize: 14, fontWeight: "600" },
  cdTime: { color: colors.brandSecondary, fontSize: 42, fontWeight: "900", letterSpacing: 2, fontVariant: ["tabular-nums"] },
  cdProg: { color: colors.white, fontSize: 15, fontWeight: "800", textAlign: "center", paddingHorizontal: spacing.lg },
  schedBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: 999, marginTop: spacing.md },
  schedBtnText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  upNext: { paddingHorizontal: spacing.xl, marginTop: spacing.md, gap: 8, width: "100%" },
  upNextTitle: { color: colors.brandSecondary, fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  upRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  upTime: { color: colors.white, fontSize: 13, fontWeight: "800", width: 46 },
  upTitle: { color: "#CBD5E1", fontSize: 13, flex: 1 },
});

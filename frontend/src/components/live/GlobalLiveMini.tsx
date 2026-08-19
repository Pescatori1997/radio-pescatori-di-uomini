import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, PanResponder, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter, useSegments } from "expo-router";
import { api, absUrl } from "@/src/api";
import { detectProvider, liveEmbedSrc } from "@/src/utils/embeds";
import EmbedFrame from "@/src/components/live/EmbedFrame";
import { useLiveMini } from "@/src/context/LiveMiniContext";

const W = 224;                 // mini window width
const VIDEO_H = Math.round((W * 9) / 16);
const BAR_H = 34;

/**
 * Floating, draggable live mini-player. Because the broadcast is time-synced,
 * this independent instance joins at the exact live position — so it looks like
 * the Diretta "keeps playing" while the user navigates elsewhere. Hidden while
 * the full Diretta screen is open (to avoid double audio).
 */
export default function GlobalLiveMini() {
  const { visible, close } = useLiveMini();
  const router = useRouter();
  const segments = useSegments();
  const onDiretta = (segments as string[]).includes("diretta");

  const [data, setData] = useState<any>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const lastEmbedBase = useRef("");
  const lastUrl = useRef("");
  const targetSeek = useRef<number | null>(null);
  const player = useVideoPlayer(null, (p) => { p.loop = true; p.muted = false; });

  const active = visible && !onDiretta;

  const apply = useCallback((d: any) => {
    setData(d);
    const onAir = d?.on_air && d?.media?.url;
    const filler = d?.filler || {};
    let rawUrl = "", seek: number | null = null, embedStart = 0;
    if (onAir) {
      rawUrl = d.media.url;
      const off = Math.max(0, Number(d?.offset_seconds || 0));
      embedStart = off;
      seek = d.media.is_live ? null : off;
    } else if (filler.url && (filler.kind === "video" || filler.kind === "audio")) {
      rawUrl = filler.url; seek = 0; embedStart = 0;
    }
    if (!rawUrl) { setEmbedUrl(null); lastUrl.current = ""; lastEmbedBase.current = ""; try { player.pause(); } catch {} close(); return; }
    const provider = detectProvider(rawUrl);
    if (provider) {
      if (rawUrl !== lastEmbedBase.current) { lastEmbedBase.current = rawUrl; setEmbedUrl(liveEmbedSrc(rawUrl, provider, embedStart)); }
      lastUrl.current = ""; try { player.pause(); } catch {}
      return;
    }
    lastEmbedBase.current = ""; setEmbedUrl(null);
    const url = absUrl(rawUrl);
    if (url !== lastUrl.current) { lastUrl.current = url; targetSeek.current = seek; try { player.replace({ uri: url }); } catch {} }
  }, [player, close]);

  useEffect(() => {
    const sub = player.addListener("statusChange", (p: any) => {
      if (p?.status !== "readyToPlay") return;
      try {
        if (targetSeek.current != null) {
          const dur = player.duration || 0; let s = targetSeek.current;
          if (dur > 0 && s >= dur) s = s % dur;
          player.currentTime = Math.max(0, s);
        }
        player.play();
      } catch {}
    });
    return () => { try { sub.remove(); } catch {} };
  }, [player]);

  useEffect(() => {
    if (!active) { try { player.pause(); } catch {} return; }
    let alive = true;
    const fetchLive = () => api.liveNow().then((d) => { if (alive) apply(d); }).catch(() => {});
    fetchLive();
    const iv = setInterval(fetchLive, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, [active, apply, player]);

  // Draggable position
  const scr = Dimensions.get("window");
  const pos = useRef(new Animated.ValueXY({ x: scr.width - W - 12, y: scr.height - VIDEO_H - BAR_H - 120 })).current;
  const off = useRef({ x: scr.width - W - 12, y: scr.height - VIDEO_H - BAR_H - 120 });
  useEffect(() => {
    const id = pos.addListener((v) => { off.current = v; });
    return () => pos.removeListener(id);
  }, [pos]);
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: () => { pos.setOffset({ x: off.current.x, y: off.current.y }); pos.setValue({ x: 0, y: 0 }); },
      onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => { pos.flattenOffset(); },
    })
  ).current;

  const media = data?.media;
  const hasMedia = !!embedUrl || (media && media.kind && lastUrl.current);
  if (!active || !hasMedia) return null;

  const prog = data?.program;
  const isVideo = embedUrl || media?.kind === "video";
  const expand = () => { close(); router.push("/diretta" as any); };

  return (
    <Animated.View style={[styles.wrap, { transform: pos.getTranslateTransform() }]}>
      <View style={styles.bar} {...responder.panHandlers}>
        <Ionicons name="reorder-two" size={16} color="#94A3B8" />
        <Text style={styles.barTitle} numberOfLines={1}>{prog?.title || "Diretta"}</Text>
        <Pressable testID="mini-expand" onPress={expand} hitSlop={8} style={styles.barBtn}><Ionicons name="expand" size={15} color="#fff" /></Pressable>
        <Pressable testID="mini-close" onPress={() => { try { player.pause(); } catch {} close(); }} hitSlop={8} style={styles.barBtn}><Ionicons name="close" size={16} color="#fff" /></Pressable>
      </View>
      <Pressable onPress={expand} style={styles.videoBox}>
        {embedUrl ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none"><EmbedFrame url={embedUrl} testID="mini-embed" /></View>
        ) : isVideo ? (
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        ) : (
          <View style={styles.audio}><Ionicons name="radio" size={30} color="#0EA5E9" /></View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, width: W, borderRadius: 12, overflow: "hidden", backgroundColor: "#0B1220", zIndex: 9999, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  bar: { height: BAR_H, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, backgroundColor: "#111C2E" },
  barTitle: { flex: 1, color: "#fff", fontSize: 12, fontWeight: "700" },
  barBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  videoBox: { width: "100%", height: VIDEO_H, backgroundColor: "#000" },
  audio: { flex: 1, alignItems: "center", justifyContent: "center" },
});

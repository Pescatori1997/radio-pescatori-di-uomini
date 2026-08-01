import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Share,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { api, mediaUrl } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import MeditationPlayer from "@/src/components/MeditationPlayer";
import MeditationComments from "@/src/components/meditations/MeditationComments";
import { colors, spacing } from "@/src/theme";

const WHITE = "#FFFFFF";

function RailBtn({ testID, icon, label, active, activeColor, onPress }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={8} style={styles.railBtn}>
      <View style={styles.railIcon}>
        <Ionicons name={icon} size={28} color={active ? activeColor : WHITE} />
      </View>
      <Text style={styles.railLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/**
 * Fullscreen vertical continuous meditation player (TikTok-style FORMAT, app
 * colours). Used both as the Meditazioni tab (opens straight into the videos)
 * and via a deep link with a starting item. Autoplays only the active card,
 * preloads neighbours, and overlays the app interactions.
 */
export default function ContinuousMeditationPlayer({
  startId, q, cat, isTab = false, showBack = false,
}: { startId?: string; q?: string; cat?: string; isTab?: boolean; showBack?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<Record<string, any>>({});
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const trackedViews = useRef<Set<string>>(new Set());
  const H = height;
  const bottomSpace = insets.bottom + (isTab ? 84 : 24);

  useEffect(() => {
    api.meditations(q || undefined, cat && cat !== "Tutti" ? cat : undefined)
      .then((data: any[]) => {
        setItems(data);
        const idx = startId ? Math.max(0, data.findIndex((d) => d.id === startId)) : 0;
        setActive(idx);
        if (idx > 0) setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: false }), 0);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [q, cat, startId]);

  const hydrate = useCallback((m: any) => {
    if (!m || state[m.id]) return;
    setState((s) => ({ ...s, [m.id]: {
      likes_count: m.likes_count || 0, praying_count: m.praying_count || 0,
      comments_count: m.comments_count || 0, liked: false, praying: false,
    } }));
    api.meditationInteractions(m.id).then((r: any) => setState((s) => ({ ...s, [m.id]: r }))).catch(() => {});
  }, [state]);

  useEffect(() => {
    const m = items[active];
    if (!m) return;
    hydrate(m);
    if (!trackedViews.current.has(m.id)) {
      trackedViews.current.add(m.id);
      api.trackContent("meditation", m.id, "view");
    }
  }, [active, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const onViewRef = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length) {
      const idx = viewableItems[0].index;
      if (typeof idx === "number") setActive(idx);
    }
  });
  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 55 });
  const requireLogin = () => router.push("/login?mode=register");

  const toggleLike = async (m: any) => {
    if (!user) return requireLogin();
    const cur = state[m.id] || {};
    setState((s) => ({ ...s, [m.id]: { ...cur, liked: !cur.liked, likes_count: (cur.likes_count || 0) + (cur.liked ? -1 : 1) } }));
    try { const r = await api.meditationLike(m.id); setState((s) => ({ ...s, [m.id]: { ...s[m.id], ...r } })); }
    catch { setState((s) => ({ ...s, [m.id]: cur })); }
  };
  const togglePray = async (m: any) => {
    if (!user) return requireLogin();
    const cur = state[m.id] || {};
    setState((s) => ({ ...s, [m.id]: { ...cur, praying: !cur.praying, praying_count: (cur.praying_count || 0) + (cur.praying ? -1 : 1) } }));
    try { const r = await api.meditationPray(m.id); setState((s) => ({ ...s, [m.id]: { ...s[m.id], ...r } })); }
    catch { setState((s) => ({ ...s, [m.id]: cur })); }
  };
  const share = (m: any) => {
    const link = m.video_url || (m.media_id ? mediaUrl(m.media_id) : "");
    Share.share({ message: `Guarda "${m.title}"${m.speaker ? ` di ${m.speaker}` : ""} su Pescatori di Uomini${link ? `\n${link}` : ""}` }).catch(() => {});
  };

  const renderItem = ({ item: m, index }: { item: any; index: number }) => {
    const st = state[m.id] || {};
    const showPlayer = Math.abs(index - active) <= 1;
    return (
      <View style={{ height: H, width, backgroundColor: "#000" }}>
        {showPlayer ? (
          <View style={StyleSheet.absoluteFill}>
            <MeditationPlayer m={m} active={index === active} autoplay fill />
          </View>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.poster]}><Ionicons name="play-circle" size={60} color="rgba(255,255,255,0.5)" /></View>
        )}

        {/* bottom gradient for legibility */}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={[styles.bottomGrad, { height: H * 0.4 }]} pointerEvents="none" />

        {/* info bottom-left */}
        <View style={[styles.info, { bottom: bottomSpace, right: 84 }]} pointerEvents="box-none">
          <Text style={styles.title} numberOfLines={2}>{m.title}</Text>
          {!!m.speaker && <Text style={styles.speaker} numberOfLines={1}>🎙  {m.speaker}</Text>}
          {!!m.verse && <Text style={styles.verse} numberOfLines={2}>“{m.verse}”</Text>}
        </View>

        {/* right action rail (TikTok-style format) */}
        <View style={[styles.rail, { bottom: bottomSpace }]}>
          <RailBtn testID={`med-like-${m.id}`} icon={st.liked ? "heart" : "heart-outline"} activeColor={colors.error} active={st.liked} label={`${st.likes_count || 0}`} onPress={() => toggleLike(m)} />
          <RailBtn testID={`med-pray-${m.id}`} icon={st.praying ? "hand-left" : "hand-left-outline"} activeColor="#38BDF8" active={st.praying} label={st.praying ? "Prego" : `${st.praying_count || 0}`} onPress={() => togglePray(m)} />
          <RailBtn testID={`med-comments-${m.id}`} icon="chatbubble-outline" label={`${st.comments_count || 0}`} onPress={() => setCommentsFor(m.id)} />
          <RailBtn testID={`med-share-${m.id}`} icon="arrow-redo-outline" label="Condividi" onPress={() => share(m)} />
        </View>

        {index === active && index < items.length - 1 && (
          <View style={[styles.swipeHint, { bottom: bottomSpace - 24 }]} pointerEvents="none">
            <Ionicons name="chevron-up" size={16} color="rgba(255,255,255,0.7)" />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* top overlay */}
      <LinearGradient colors={["rgba(0,0,0,0.55)", "transparent"]} style={[styles.topGrad, { height: insets.top + 70 }]} pointerEvents="none" />
      <View style={[styles.topBar, { top: insets.top + spacing.xs }]} pointerEvents="box-none">
        {showBack ? (
          <Pressable testID="med-player-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-down" size={26} color={WHITE} />
          </Pressable>
        ) : <View style={{ width: 40 }} />}
        <Text style={styles.topTitle}>Meditazioni</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={WHITE} size="large" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}><Text style={styles.empty}>Nessuna meditazione disponibile.</Text></View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          pagingEnabled
          snapToInterval={H}
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: H, offset: H * index, index })}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          onViewableItemsChanged={onViewRef.current}
          viewabilityConfig={viewConfigRef.current}
          onScrollToIndexFailed={(info) => setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false }), 50)}
        />
      )}

      {commentsFor && (
        <MeditationComments
          mid={commentsFor}
          visible={!!commentsFor}
          onClose={() => setCommentsFor(null)}
          onPosted={() => setState((s) => ({ ...s, [commentsFor]: { ...s[commentsFor], comments_count: (s[commentsFor]?.comments_count || 0) + 1 } }))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  empty: { color: "rgba(255,255,255,0.8)", fontSize: 15 },
  poster: { alignItems: "center", justifyContent: "center", backgroundColor: colors.navy },
  topGrad: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  topBar: { position: "absolute", left: 0, right: 0, zIndex: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  topTitle: { color: WHITE, fontSize: 16, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 6 },
  bottomGrad: { position: "absolute", left: 0, right: 0, bottom: 0 },
  info: { position: "absolute", left: spacing.lg },
  title: { color: WHITE, fontSize: 19, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  speaker: { color: "rgba(255,255,255,0.92)", fontSize: 14, fontWeight: "700", marginTop: 6, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  verse: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontStyle: "italic", marginTop: 6, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  rail: { position: "absolute", right: spacing.md, alignItems: "center", gap: spacing.lg },
  railBtn: { alignItems: "center", gap: 4 },
  railIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
  railLabel: { color: WHITE, fontSize: 12, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
  swipeHint: { position: "absolute", alignSelf: "center", alignItems: "center" },
});

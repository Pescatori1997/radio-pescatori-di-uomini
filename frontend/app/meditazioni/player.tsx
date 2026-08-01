import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Share,
  useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, mediaUrl } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import MeditationPlayer from "@/src/components/MeditationPlayer";
import MeditationComments from "@/src/components/meditations/MeditationComments";
import { colors, spacing, radius } from "@/src/theme";

function ActionBtn({ testID, icon, label, active, activeColor, onPress }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={8} style={styles.actionBtn}>
      <Ionicons name={icon} size={26} color={active ? activeColor : colors.onSurface} />
      <Text style={[styles.actionLabel, active && { color: activeColor }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export default function MeditationsPlayer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { user } = useAuth();
  const { start, q, cat } = useLocalSearchParams<{ start?: string; q?: string; cat?: string }>();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<Record<string, any>>({});
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const trackedViews = useRef<Set<string>>(new Set());
  const H = height;

  useEffect(() => {
    api.meditations(q || undefined, cat && cat !== "Tutti" ? cat : undefined)
      .then((data: any[]) => {
        setItems(data);
        const idx = Math.max(0, data.findIndex((d) => d.id === start));
        setActive(idx);
        if (idx > 0) setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: false }), 0);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [q, cat, start]);

  const hydrate = useCallback((m: any) => {
    if (!m || state[m.id]) return;
    // seed from the item itself, then refresh authoritative counts + my state
    setState((s) => ({ ...s, [m.id]: {
      likes_count: m.likes_count || 0, praying_count: m.praying_count || 0,
      comments_count: m.comments_count || 0, liked: false, praying: false,
    } }));
    api.meditationInteractions(m.id).then((r: any) => setState((s) => ({ ...s, [m.id]: r }))).catch(() => {});
  }, [state]);

  // when the active card changes: hydrate interactions + track a (deduped) view
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

  const playerHeight = (m: any) => {
    const ct = m.content_type;
    if (ct === "audio") return 150;
    if (ct === "pdf") return Math.min(H * 0.62, width * 1.3);
    return Math.min(width * 9 / 16, H * 0.5);
  };

  const renderItem = ({ item: m, index }: { item: any; index: number }) => {
    const st = state[m.id] || {};
    const showPlayer = Math.abs(index - active) <= 1; // preload prev/next, autoplay active
    return (
      <View style={{ height: H, backgroundColor: colors.surface }}>
        <View style={[styles.playerBox, { height: playerHeight(m), marginTop: insets.top + 52 }]}>
          {showPlayer ? (
            <MeditationPlayer m={m} active={index === active} autoplay />
          ) : (
            <View style={styles.posterFallback}><MaterialCommunityIcons name="play-circle" size={54} color={colors.white} /></View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{m.title}</Text>
          {!!m.speaker && <Text style={styles.speaker} numberOfLines={1}><Ionicons name="person" size={13} color={colors.brandPrimary} /> {m.speaker}</Text>}
          {!!m.verse && <Text style={styles.verse} numberOfLines={2}>“{m.verse}”</Text>}
          {!!m.description && <Text style={styles.desc} numberOfLines={3}>{m.description}</Text>}
        </View>

        <View style={[styles.actions, { bottom: insets.bottom + 90 }]}>
          <ActionBtn testID={`med-like-${m.id}`} icon={st.liked ? "heart" : "heart-outline"} activeColor={colors.error}
            active={st.liked} label={`${st.likes_count || 0}`} onPress={() => toggleLike(m)} />
          <ActionBtn testID={`med-pray-${m.id}`} icon={st.praying ? "hand-left" : "hand-left-outline"} activeColor={colors.brandSecondary}
            active={st.praying} label={st.praying ? "Sto pregando" : `Prego (${st.praying_count || 0})`} onPress={() => togglePray(m)} />
          <ActionBtn testID={`med-comments-${m.id}`} icon="chatbubble-outline" label={`${st.comments_count || 0}`}
            onPress={() => setCommentsFor(m.id)} />
          <ActionBtn testID={`med-share-${m.id}`} icon="share-social-outline" label="Condividi" onPress={() => share(m)} />
        </View>

        {index === active && index < items.length - 1 && (
          <View style={[styles.swipeHint, { bottom: insets.bottom + 44 }]}>
            <Ionicons name="chevron-up" size={16} color={colors.onSurfaceTertiary} />
            <Text style={styles.swipeHintText}>Scorri per la prossima</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* top bar */}
      <View style={[styles.topBar, { top: insets.top + spacing.xs }]}>
        <Pressable testID="med-player-back" onPress={() => router.back()} hitSlop={12} style={styles.topBtn}>
          <Ionicons name="chevron-down" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Meditazioni</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.onSurfaceSecondary, fontSize: 15 },
  topBar: { position: "absolute", left: 0, right: 0, zIndex: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  topTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  playerBox: { width: "100%", backgroundColor: "#000", borderRadius: radius.lg, overflow: "hidden" },
  posterFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy },
  info: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800", lineHeight: 26 },
  speaker: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "600", marginTop: 6 },
  verse: { color: colors.brandPrimary, fontSize: 14, fontStyle: "italic", marginTop: 8 },
  desc: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21, marginTop: 8 },
  actions: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", paddingHorizontal: spacing.lg },
  actionBtn: { alignItems: "center", gap: 4, minWidth: 60 },
  actionLabel: { color: colors.onSurface, fontSize: 12, fontWeight: "700" },
  swipeHint: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  swipeHintText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
});

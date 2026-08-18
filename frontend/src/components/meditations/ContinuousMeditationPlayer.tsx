import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Share,
  useWindowDimensions, Animated, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { api, mediaUrl } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { useContentFav } from "@/src/hooks/useContentFav";
import MeditationPlayer from "@/src/components/MeditationPlayer";
import MeditationCommentsPanel from "@/src/components/meditations/MeditationCommentsPanel";
import MeditationInfoSheet from "@/src/components/meditations/MeditationInfoSheet";
import { getSoundOn } from "@/src/components/meditations/soundPref";
import { MAX_CONTENT_WIDTH } from "@/src/components/DesktopFrame";
import { colors, spacing } from "@/src/theme";

const WHITE = "#FFFFFF";
const LOGO = require("@/assets/images/logo-badge.png");

function RailBtn({ testID, icon, label, active, activeColor, onPress }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={10} style={styles.railBtn}>
      <View style={styles.railIcon}>
        <Ionicons name={icon} size={33} color={active ? activeColor : WHITE} />
      </View>
      {label !== null && <Text style={styles.railLabel} numberOfLines={1}>{label}</Text>}
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
  const isFocused = useIsFocused();
  const { width, height } = useWindowDimensions();
  // On desktop web the app is centered in a ~640px column (see DesktopFrame),
  // but useWindowDimensions returns the FULL window width. Using that width made
  // the video overflow the column and get cropped to a zoomed sliver. Clamp the
  // layout width to the visible column so the video fits correctly.
  const W = Platform.OS === "web" ? Math.min(width, MAX_CONTENT_WIDTH) : width;
  const { user } = useAuth();
  const medFav = useContentFav("meditazioni");

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<Record<string, any>>({});
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [infoItem, setInfoItem] = useState<any>(null);
  const [soundHint, setSoundHint] = useState(false);
  const listRef = useRef<FlatList>(null);
  const trackedViews = useRef<Set<string>>(new Set());
  const heart = useRef(new Animated.Value(0)).current;
  const H = height;
  const bottomSpace = insets.bottom + (isTab ? 84 : 24);

  // Show a gentle "tap for sound" pill on the active card until the user turns
  // sound on (muted autoplay is required by the OS). Hides itself after a while.
  useEffect(() => {
    if (!getSoundOn()) {
      setSoundHint(true);
      const t = setTimeout(() => setSoundHint(false), 4500);
      return () => clearTimeout(t);
    }
    setSoundHint(false);
  }, [active, isFocused]);

  const burstHeart = useCallback(() => {
    heart.stopAnimation();
    heart.setValue(0);
    Animated.sequence([
      Animated.spring(heart, { toValue: 1, damping: 9, stiffness: 140, useNativeDriver: true }),
      Animated.timing(heart, { toValue: 0, duration: 420, delay: 280, useNativeDriver: true }),
    ]).start();
  }, [heart]);

  // Comments panel layout: the video shrinks to the top, the panel slides up
  // from the bottom. We only resize the video container (never remount the
  // WebView) so playback continues while commenting (TikTok/Instagram style).
  const commentsOpen = !!commentsFor;
  const topH = Math.round(H * 0.45);
  const itemH = commentsOpen ? topH : H;
  const panelH = H - topH;
  const slide = useRef(new Animated.Value(0)).current;
  const panelBottomInset = isTab ? insets.bottom + 56 : insets.bottom;

  // Animate the panel in when opened; keep it mounted during the slide-out.
  useEffect(() => {
    if (commentsFor) {
      slide.setValue(0);
      Animated.timing(slide, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    }
  }, [commentsFor, slide]);

  const openComments = (id: string) => setCommentsFor(id);
  const closeComments = () => {
    Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setCommentsFor(null);
    });
  };

  // Keep the active card aligned to the viewport top after the video resizes.
  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToOffset({ offset: active * itemH, animated: false }), 0);
    return () => clearTimeout(t);
  }, [commentsOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!cur.liked) burstHeart();
    setState((s) => ({ ...s, [m.id]: { ...cur, liked: !cur.liked, likes_count: (cur.likes_count || 0) + (cur.liked ? -1 : 1) } }));
    try { const r = await api.meditationLike(m.id); setState((s) => ({ ...s, [m.id]: { ...s[m.id], ...r } })); }
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
      <View style={{ height: itemH, width: W, backgroundColor: "#000" }}>
        {showPlayer ? (
          <View style={StyleSheet.absoluteFill}>
            <MeditationPlayer m={m} active={index === active && isFocused} autoplay fill />
          </View>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.poster]}><Ionicons name="play-circle" size={60} color="rgba(255,255,255,0.5)" /></View>
        )}

        {/* bottom gradient for legibility (taller & smoother, Reels-style) */}
        {!commentsOpen && (
          <LinearGradient
            colors={["transparent", "rgba(4,10,24,0.45)", "rgba(4,10,24,0.92)"]}
            locations={[0, 0.55, 1]}
            style={[styles.bottomGrad, { height: H * 0.5 }]}
            pointerEvents="none"
          />
        )}

        {/* caption bottom-left: avatar + speaker handle, title, verse */}
        {!commentsOpen && (
          <View style={[styles.info, { bottom: bottomSpace, right: 88 }]} pointerEvents="box-none">
            <View style={styles.handleRow}>
              <View style={styles.avatarRing}>
                <Image source={m.thumbnail ? { uri: m.thumbnail } : LOGO} style={styles.avatar} contentFit="cover" />
              </View>
              <Text style={styles.handle} numberOfLines={1}>{m.speaker || "Pescatori di Uomini"}</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>{m.title}</Text>
            {!!m.verse && (
              <View style={styles.verseRow}>
                <View style={styles.verseBar} />
                <Text style={styles.verse} numberOfLines={2}>{m.verse}</Text>
              </View>
            )}
          </View>
        )}

        {/* right action rail — clean icons + drop shadow (no circle bg) */}
        {!commentsOpen && (
          <View style={[styles.rail, { bottom: bottomSpace }]}>
            <RailBtn testID={`med-like-${m.id}`} icon={st.liked ? "heart" : "heart-outline"} activeColor={colors.error} active={st.liked} label={`${st.likes_count || 0}`} onPress={() => toggleLike(m)} />
            {user && (
              <RailBtn testID={`med-save-${m.id}`} icon={medFav.isFav(m.id) ? "bookmark" : "bookmark-outline"} activeColor={colors.brandSecondary} active={medFav.isFav(m.id)} label="Salva" onPress={() => medFav.toggle(m.id)} />
            )}
            <RailBtn testID={`med-comments-${m.id}`} icon="chatbubble-outline" label={`${st.comments_count || 0}`} onPress={() => openComments(m.id)} />
            <RailBtn testID={`med-share-${m.id}`} icon="paper-plane-outline" label="Invia" onPress={() => share(m)} />
          </View>
        )}

        {/* tap-for-sound hint (only while muted, on the active card) */}
        {!commentsOpen && index === active && soundHint && (
          <View style={[styles.soundHint, { bottom: bottomSpace + 96 }]} pointerEvents="none">
            <Ionicons name="volume-mute" size={15} color={WHITE} />
            <Text style={styles.soundHintText}>Tocca per l'audio</Text>
          </View>
        )}

        {!commentsOpen && index === active && index < items.length - 1 && (
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
        {items.length > 0 && !commentsOpen ? (
          <Pressable testID="med-info-top" onPress={() => setInfoItem(items[active])} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="ellipsis-vertical" size={22} color={WHITE} />
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      <View style={{ height: itemH, width: W, overflow: "hidden" }}>
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
            pagingEnabled={!commentsOpen}
            scrollEnabled={!commentsOpen}
            snapToInterval={itemH}
            decelerationRate="fast"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: itemH, offset: itemH * index, index })}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            onViewableItemsChanged={onViewRef.current}
            viewabilityConfig={viewConfigRef.current}
            onScrollToIndexFailed={(info) => setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false }), 50)}
          />
        )}
      </View>

      {/* Like heart-burst (delight) — centered over the active video */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heartBurst,
          {
            opacity: heart,
            transform: [
              { scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.25] }) },
              { rotate: "-8deg" },
            ],
          },
        ]}
      >
        <Ionicons name="heart" size={130} color="rgba(255,255,255,0.95)" />
      </Animated.View>

      {commentsFor && (
        <Animated.View
          style={[
            styles.panelWrap,
            { top: topH, height: panelH, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [panelH, 0] }) }] },
          ]}
        >
          <MeditationCommentsPanel
            mid={commentsFor}
            bottomInset={panelBottomInset}
            onClose={closeComments}
            onPosted={() => setState((s) => ({ ...s, [commentsFor]: { ...s[commentsFor], comments_count: (s[commentsFor]?.comments_count || 0) + 1 } }))}
          />
        </Animated.View>
      )}

      {infoItem && (
        <MeditationInfoSheet item={infoItem} onClose={() => setInfoItem(null)} />
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
  handleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  avatarRing: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: "rgba(255,255,255,0.9)", overflow: "hidden", backgroundColor: colors.navy },
  avatar: { width: "100%", height: "100%" },
  handle: { color: WHITE, fontSize: 14.5, fontWeight: "800", maxWidth: 190, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  title: { color: WHITE, fontSize: 18, fontWeight: "800", lineHeight: 23, textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 6 },
  verseRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 },
  verseBar: { width: 3, alignSelf: "stretch", borderRadius: 2, backgroundColor: colors.brandSecondary, opacity: 0.9 },
  verse: { flex: 1, color: "rgba(255,255,255,0.92)", fontSize: 13, fontStyle: "italic", lineHeight: 18, textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 6 },
  rail: { position: "absolute", right: spacing.md, alignItems: "center", gap: spacing.lg + 2 },
  railBtn: { alignItems: "center", gap: 5 },
  railIcon: { alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  railLabel: { color: WHITE, fontSize: 12.5, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 5 },
  soundHint: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(4,10,24,0.7)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  soundHintText: { color: WHITE, fontSize: 12.5, fontWeight: "700" },
  heartBurst: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 15 },
  swipeHint: { position: "absolute", alignSelf: "center", alignItems: "center" },
  panelWrap: { position: "absolute", left: 0, right: 0, zIndex: 20 },
});

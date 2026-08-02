import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Linking, LayoutChangeEvent,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const AUTOPLAY_MS = 5500;
const RESUME_MS = 9000;

/**
 * Home "Vetrina" — horizontal carousel of highlighted content (events, music,
 * projects, promoted content...). One full-width card at a time, dots, and gentle
 * autoplay that pauses while the user interacts. Renders nothing when empty so the
 * Home layout stays clean.
 */
export default function ShowcaseCarousel() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [w, setW] = useState(0);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const paused = useRef(false);
  const resumeTimer = useRef<any>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    api.showcase().then((d: any[]) => setItems(Array.isArray(d) ? d : [])).catch(() => setItems([]));
  }, []);

  useEffect(() => { indexRef.current = index; }, [index]);

  // Autoplay: advance while not paused and more than one card.
  useEffect(() => {
    if (items.length < 2 || w === 0) return;
    const iv = setInterval(() => {
      if (paused.current) return;
      const next = (indexRef.current + 1) % items.length;
      listRef.current?.scrollToOffset({ offset: next * w, animated: true });
    }, AUTOPLAY_MS);
    return () => clearInterval(iv);
  }, [items.length, w]);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const onScrollBeginDrag = () => {
    paused.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };
  const onMomentumEnd = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    if (w > 0) setIndex(Math.round(x / w));
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { paused.current = false; }, RESUME_MS);
  };
  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  const openCta = useCallback((url?: string) => {
    if (!url) return;
    const u = url.trim();
    if (!u) return;
    if (u.startsWith("/")) router.push(u as any);
    else Linking.openURL(u.startsWith("http") ? u : `https://${u}`).catch(() => {});
  }, [router]);

  if (items.length === 0) return null;

  const renderItem = ({ item }: { item: any }) => (
    <View style={{ width: w || undefined, paddingHorizontal: spacing.lg }}>
      <View testID={`showcase-card-${item.id}`} style={styles.card}>
        <View style={styles.imgWrap}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.imgEmpty]}><Ionicons name="sparkles" size={40} color={colors.brandPrimary} /></View>
          )}
          <LinearGradient colors={["transparent", "rgba(10,17,40,0.35)"]} style={StyleSheet.absoluteFill} />
          {!!item.category && (
            <View style={styles.badge}><Text style={styles.badgeText} numberOfLines={1}>{String(item.category).toUpperCase()}</Text></View>
          )}
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          {!!item.description && <Text style={styles.desc} numberOfLines={3}>{item.description}</Text>}
          {!!(item.cta_url && String(item.cta_url).trim()) && (
            <PressableScale testID={`showcase-cta-${item.id}`} style={styles.cta} onPress={() => openCta(item.cta_url)}>
              <Text style={styles.ctaText}>{item.cta_text?.trim() || "Scopri di più"}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.white} />
            </PressableScale>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View testID="showcase-section">
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Vetrina</Text>
      </View>
      <View onLayout={onLayout}>
        {w > 0 && (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={w}
            decelerationRate="fast"
            disableIntervalMomentum
            getItemLayout={(_, i) => ({ length: w, offset: w * i, index: i })}
            onScrollBeginDrag={onScrollBeginDrag}
            onMomentumScrollEnd={onMomentumEnd}
          />
        )}
      </View>
      {items.length > 1 && (
        <View style={styles.dots}>
          {items.map((it, i) => (
            <View key={it.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, shadowColor: colors.navy, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  imgWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.navy },
  imgEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  badge: { position: "absolute", top: spacing.md, left: spacing.md, backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  body: { padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  desc: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.lg },
  ctaText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.md },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotActive: { width: 20, backgroundColor: colors.brandPrimary },
});

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Linking, LayoutChangeEvent,
  Modal, ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const AUTOPLAY_MS = 5500;
const RESUME_MS = 9000;

// Light Markdown cleanup so admin-typed markdown (###, **bold**, lists) reads
// cleanly as plain text in the card and detail sheet.
function cleanMd(s?: string): string {
  if (!s) return "";
  return String(s)
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\*(?=\S)(.*?)(?<=\S)\*/g, "$1")
    .trim();
}

/**
 * Home "Vetrina" — horizontal carousel of highlighted content (events, music,
 * projects, promoted content...). One full-width card at a time, dots, and gentle
 * autoplay that pauses while the user interacts. Renders nothing when empty so the
 * Home layout stays clean.
 */
export default function ShowcaseCarousel() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [w, setW] = useState(0);
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState<any>(null);
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
      <Pressable testID={`showcase-card-${item.id}`} onPress={() => setDetail(item)} style={styles.card}>
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
          {!!item.description && <Text style={styles.desc} numberOfLines={3}>{cleanMd(item.description)}</Text>}
          <View style={styles.actionsRow}>
            {!!(item.cta_url && String(item.cta_url).trim()) && (
              <PressableScale testID={`showcase-cta-${item.id}`} style={styles.cta} onPress={() => openCta(item.cta_url)}>
                <Text style={styles.ctaText}>{item.cta_text?.trim() || "Scopri di più"}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.white} />
              </PressableScale>
            )}
            <View style={styles.readMore}>
              <Text style={styles.readMoreText}>Leggi</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.brandPrimary} />
            </View>
          </View>
        </View>
      </Pressable>
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

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetail(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg, maxHeight: "88%" }]}>
            <View style={styles.grabber} />
            {detail && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
                <View style={styles.detailImgWrap}>
                  {detail.image ? (
                    <Image source={{ uri: detail.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.imgEmpty]}><Ionicons name="sparkles" size={44} color={colors.brandPrimary} /></View>
                  )}
                  {!!detail.category && (
                    <View style={styles.badge}><Text style={styles.badgeText}>{String(detail.category).toUpperCase()}</Text></View>
                  )}
                  <Pressable testID="showcase-detail-close" onPress={() => setDetail(null)} hitSlop={10} style={styles.closeBtn}>
                    <Ionicons name="close" size={22} color={colors.white} />
                  </Pressable>
                </View>
                <View style={{ padding: spacing.lg }}>
                  <Text style={styles.detailTitle}>{detail.title}</Text>
                  {!!detail.description && <Text style={styles.detailDesc}>{cleanMd(detail.description)}</Text>}
                  {!!(detail.cta_url && String(detail.cta_url).trim()) && (
                    <PressableScale testID="showcase-detail-cta" style={styles.cta} onPress={() => { const u = detail.cta_url; setDetail(null); openCta(u); }}>
                      <Text style={styles.ctaText}>{detail.cta_text?.trim() || "Scopri di più"}</Text>
                      <Ionicons name="arrow-forward" size={16} color={colors.white} />
                    </PressableScale>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.pill, flex: 1 },
  ctaText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.lg },
  readMore: { flexDirection: "row", alignItems: "center", gap: 2 },
  readMoreText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800" },
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.md },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotActive: { width: 20, backgroundColor: colors.brandPrimary },
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: "hidden" },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: 8, marginBottom: 4, zIndex: 2 },
  detailImgWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.navy },
  closeBtn: { position: "absolute", top: spacing.md, right: spacing.md, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  detailTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "800", lineHeight: 28 },
  detailDesc: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 24, marginTop: spacing.md },
});

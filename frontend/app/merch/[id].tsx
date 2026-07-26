import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const AVAIL: Record<string, { label: string; color: string }> = {
  available: { label: "Disponibile", color: colors.success },
  coming_soon: { label: "Presto disponibile", color: colors.warning },
  sold_out: { label: "Esaurito", color: colors.error },
};

export default function ProductDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  const galleryW = Math.min(width, 720);

  useEffect(() => {
    api.product(id!).then(setP).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const buy = () => {
    const params = new URLSearchParams({ product_id: p.id, qty: String(qty) });
    if (size) params.set("size", size);
    if (color) params.set("color", color);
    router.push(`/checkout?${params.toString()}` as any);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  if (!p) return (
    <View style={styles.center}>
      <Text style={styles.err}>Prodotto non trovato</Text>
      <PressableScale onPress={() => router.back()} style={styles.closeInline}><Text style={styles.closeInlineText}>Chiudi</Text></PressableScale>
    </View>
  );

  const av = AVAIL[p.availability] || AVAIL.available;
  const images: string[] = p.images?.length ? p.images : [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {/* GALLERY */}
        <View style={[styles.gallery, { height: galleryW, alignSelf: "center", width: "100%", maxWidth: 720 }]}>
          {images.length ? (
            <ScrollView
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setActive(Math.round(e.nativeEvent.contentOffset.x / galleryW))}
            >
              {images.map((uri, i) => (
                <Image key={i} source={{ uri }} style={{ width: galleryW, height: galleryW }} contentFit="cover" transition={200} />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.galleryEmpty, { height: galleryW }]}><Ionicons name="image-outline" size={48} color={colors.muted} /></View>
          )}
          <LinearGradient colors={["rgba(10,17,40,0.5)", "transparent"]} style={styles.galleryTopScrim} pointerEvents="none" />
          <PressableScale testID="product-close" onPress={() => router.back()} style={[styles.closeBtn, { top: insets.top + spacing.sm }]}>
            <Ionicons name="close" size={22} color={colors.white} />
          </PressableScale>
          {images.length > 1 && (
            <View style={styles.dots}>
              {images.map((_, i) => <View key={i} style={[styles.dot, active === i && styles.dotActive]} />)}
            </View>
          )}
          {p.featured && <View style={styles.featBadge}><Ionicons name="star" size={12} color={colors.navy} /><Text style={styles.featText}>In evidenza</Text></View>}
        </View>

        <Animated.View entering={FadeInDown.duration(400)} style={styles.body}>
          <View style={styles.rowBetween}>
            <View style={styles.catPill}><Text style={styles.catPillText}>{p.category}</Text></View>
            <View style={[styles.availPill, { backgroundColor: av.color + "22" }]}><View style={[styles.availDot, { backgroundColor: av.color }]} /><Text style={[styles.availPillText, { color: av.color }]}>{av.label}</Text></View>
          </View>

          <Text style={styles.name}>{p.name}</Text>
          {!!p.price && <Text style={styles.price}>{p.price}</Text>}
          {!!p.description && <Text style={styles.shortDesc}>{p.description}</Text>}

          {!!p.long_description && (
            <>
              <Text style={styles.section}>Descrizione</Text>
              <Text style={styles.longDesc}>{p.long_description}</Text>
            </>
          )}

          {p.colors?.length > 0 && (
            <>
              <Text style={styles.section}>Colore</Text>
              <View style={styles.tagRow}>
                {p.colors.map((c: string) => (
                  <Pressable key={c} testID={`product-color-${c}`} onPress={() => setColor(color === c ? null : c)} style={[styles.tag, color === c && styles.tagActive]}>
                    <Text style={[styles.tagText, color === c && styles.tagTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {p.sizes?.length > 0 && (
            <>
              <Text style={styles.section}>Taglia</Text>
              <View style={styles.tagRow}>
                {p.sizes.map((s: string) => (
                  <Pressable key={s} testID={`product-size-${s}`} onPress={() => setSize(size === s ? null : s)} style={[styles.tag, size === s && styles.tagActive]}>
                    <Text style={[styles.tagText, size === s && styles.tagTextActive]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {av.label === AVAIL.available.label && (
            <>
              <Text style={styles.section}>Quantità</Text>
              <View style={styles.qtyRow}>
                <Pressable testID="product-qty-minus" onPress={() => setQty((q) => Math.max(1, q - 1))} style={styles.qtyBtn}><Ionicons name="remove" size={20} color={colors.onSurface} /></Pressable>
                <Text style={styles.qtyValue}>{qty}</Text>
                <Pressable testID="product-qty-plus" onPress={() => setQty((q) => Math.min(99, q + 1))} style={styles.qtyBtn}><Ionicons name="add" size={20} color={colors.onSurface} /></Pressable>
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>

      {/* BUY CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {p.availability === "available" ? (
          <PressableScale testID="product-buy" onPress={buy} style={styles.buyBtn}>
            <Ionicons name="bag-check" size={22} color={colors.white} />
            <Text style={styles.buyBtnText}>Acquista ora{p.price ? ` · ${p.price}` : ""}</Text>
          </PressableScale>
        ) : (
          <View style={[styles.buyBtn, styles.buyBtnDisabled]}>
            <Ionicons name="lock-closed" size={18} color={colors.white} />
            <Text style={styles.buyBtnText}>{av.label}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: spacing.lg },
  err: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  closeInline: { backgroundColor: colors.navy, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  closeInlineText: { color: colors.white, fontWeight: "800" },
  gallery: { backgroundColor: colors.surfaceTertiary },
  galleryEmpty: { alignItems: "center", justifyContent: "center", width: "100%" },
  galleryTopScrim: { position: "absolute", top: 0, left: 0, right: 0, height: 90 },
  closeBtn: { position: "absolute", right: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(10,17,40,0.5)", alignItems: "center", justifyContent: "center" },
  dots: { position: "absolute", bottom: spacing.md, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: colors.white, width: 18 },
  featBadge: { position: "absolute", top: spacing.md, left: spacing.lg, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.warning, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  featText: { color: colors.navy, fontSize: 11, fontWeight: "800" },
  body: { padding: spacing.lg, maxWidth: 720, alignSelf: "center", width: "100%" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catPill: { backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  catPillText: { color: colors.onBrandTertiary, fontSize: 11, fontWeight: "800" },
  availPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  availDot: { width: 7, height: 7, borderRadius: 4 },
  availPillText: { fontSize: 11, fontWeight: "800" },
  name: { color: colors.onSurface, fontSize: 26, fontWeight: "800", marginTop: spacing.md, letterSpacing: -0.5 },
  price: { color: colors.brandPrimary, fontSize: 20, fontWeight: "800", marginTop: spacing.xs },
  shortDesc: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 22, marginTop: spacing.md },
  section: { color: colors.onSurface, fontSize: 16, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.sm },
  longDesc: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 23 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  tagActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  tagText: { color: colors.onSurface, fontSize: 13, fontWeight: "700" },
  tagTextActive: { color: colors.onBrandTertiary },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  qtyBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  qtyValue: { color: colors.onSurface, fontSize: 18, fontWeight: "800", minWidth: 28, textAlign: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  buyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md + 2, borderRadius: radius.pill, backgroundColor: colors.navy, maxWidth: 720, alignSelf: "center", width: "100%" },
  buyBtnDisabled: { backgroundColor: colors.muted },
  buyBtnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Linking, useWindowDimensions, Pressable } from "react-native";
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

  const galleryW = Math.min(width, 720);

  useEffect(() => {
    api.product(id!).then(setP).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const whatsapp = () => {
    const text = encodeURIComponent(`Ciao Radio Pescatori di Uomini! Sono interessato/a al prodotto: ${p?.name || ""}`);
    Linking.openURL(`https://wa.me/393517556255?text=${text}`).catch(() => Linking.openURL("https://wa.me/393517556255").catch(() => {}));
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
          {p.featured && <View style={styles.featBadge}><Ionicons name="star" size={12} color={colors.navy} /><Text style={styles.featText}>Featured</Text></View>}
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
              <Text style={styles.section}>Colori</Text>
              <View style={styles.tagRow}>
                {p.colors.map((c: string) => <View key={c} style={styles.tag}><Text style={styles.tagText}>{c}</Text></View>)}
              </View>
            </>
          )}

          {p.sizes?.length > 0 && (
            <>
              <Text style={styles.section}>Taglie</Text>
              <View style={styles.tagRow}>
                {p.sizes.map((s: string) => <View key={s} style={styles.tag}><Text style={styles.tagText}>{s}</Text></View>)}
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>

      {/* WHATSAPP CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PressableScale testID="product-whatsapp" onPress={whatsapp} style={styles.waBtnShadow}>
          <LinearGradient colors={["#25D366", "#1EBE5D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.waBtn}>
            <Ionicons name="logo-whatsapp" size={24} color={colors.white} />
            <Text style={styles.waBtnText}>Contattaci su WhatsApp</Text>
          </LinearGradient>
        </PressableScale>
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
  tagText: { color: colors.onSurface, fontSize: 13, fontWeight: "700" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  waBtnShadow: { borderRadius: radius.pill, shadowColor: "#25D366", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8, maxWidth: 720, alignSelf: "center", width: "100%" },
  waBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md + 2, borderRadius: radius.pill },
  waBtnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

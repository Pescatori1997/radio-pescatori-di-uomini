import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const HERO = require("@/assets/images/studio.png");

const AVAIL: Record<string, { label: string; color: string }> = {
  available: { label: "Disponibile", color: colors.success },
  coming_soon: { label: "Presto disponibile", color: colors.warning },
  sold_out: { label: "Esaurito", color: colors.error },
};

export default function Merch() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const gridY = useRef(0);

  const [all, setAll] = useState<any[]>([]);
  const [cats, setCats] = useState<string[]>(["Tutti"]);
  const [cat, setCat] = useState("Tutti");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api.products(), api.productCategories()]);
      setAll(p); setCats(c);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((p) => {
      if (cat !== "Tutti" && p.category !== cat) return false;
      if (!q) return true;
      return [p.name, p.description, p.category].some((f: string) => (f || "").toLowerCase().includes(q));
    });
  }, [all, cat, search]);

  const numColumns = width >= 1000 ? 4 : width >= 700 ? 3 : 2;
  const gap = spacing.md;
  const contentW = Math.min(width, 1100) - spacing.lg * 2;
  const cardW = (contentW - gap * (numColumns - 1)) / numColumns;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        ref={scrollRef}
        testID="merch-screen"
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
      >
        {/* HERO */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
          <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" blurRadius={2} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,17,40,0.72)" }]} />
          <LinearGradient colors={["rgba(10,17,40,0.4)", "rgba(10,17,40,0.96)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroTop}>
            <PressableScale testID="merch-back" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.white} />
            </PressableScale>
          </View>
          <Animated.View entering={FadeInDown.duration(500)} style={{ marginTop: spacing.xl }}>
            <View style={styles.kicker}><Ionicons name="storefront" size={13} color={colors.brandSecondary} /><Text style={styles.kickerText}>SHOP UFFICIALE</Text></View>
            <Text style={styles.heroTitle}>Merchandising</Text>
            <Text style={styles.heroSub}>Indossa la missione. Ogni acquisto sostiene Radio Pescatori di Uomini e contribuisce alla diffusione del Vangelo.</Text>
            <PressableScale testID="merch-cta" style={styles.heroCta} onPress={() => scrollRef.current?.scrollTo({ y: gridY.current - 12, animated: true })}>
              <Text style={styles.heroCtaText}>Scopri la collezione</Text>
              <Ionicons name="arrow-down" size={18} color={colors.navy} />
            </PressableScale>
          </Animated.View>
        </View>

        {/* SEARCH */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput testID="merch-search" value={search} onChangeText={setSearch} placeholder="Cerca un prodotto..." placeholderTextColor={colors.muted} style={styles.searchInput} />
            {search ? <Pressable onPress={() => setSearch("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
          </View>
        </View>

        {/* CATEGORIES */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ maxHeight: 52 }}>
          {cats.map((c) => (
            <Pressable key={c} testID={`merch-cat-${c}`} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipActive]}>
              <Text style={[styles.chipText, cat === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* GRID */}
        <View onLayout={(e) => { gridY.current = e.nativeEvent.layout.y; }} style={[styles.grid, { maxWidth: 1100, alignSelf: "center", width: "100%", paddingHorizontal: spacing.lg }]}>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
          ) : items.length === 0 ? (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name="storefront-outline" size={44} color={colors.brandPrimary} /></View>
              <Text style={styles.emptyTitle}>Collezione in arrivo</Text>
              <Text style={styles.emptyText}>Il nostro merchandising arriverà presto. Continua a seguirci!</Text>
            </Animated.View>
          ) : (
            <View style={[styles.cards, { gap }]}>
              {items.map((p, i) => {
                const av = AVAIL[p.availability] || AVAIL.available;
                const soon = p.availability === "coming_soon";
                return (
                  <Animated.View key={p.id} entering={FadeInDown.duration(400).delay(Math.min(i, 8) * 60)} style={{ width: cardW }}>
                    <PressableScale testID={`merch-card-${p.id}`} style={styles.card} onPress={() => router.push(`/merch/${p.id}`)}>
                      <View style={styles.imgWrap}>
                        {p.images?.[0] ? (
                          <Image source={{ uri: p.images[0] }} style={styles.img} contentFit="cover" transition={200} recyclingKey={p.id} />
                        ) : (
                          <View style={[styles.img, styles.imgEmpty]}><Ionicons name="image-outline" size={28} color={colors.muted} /></View>
                        )}
                        {p.featured && <View style={styles.featBadge}><Ionicons name="star" size={11} color={colors.navy} /><Text style={styles.featText}>In evidenza</Text></View>}
                        <View style={[styles.availBadge, { backgroundColor: av.color }]}><Text style={styles.availText}>{av.label}</Text></View>
                      </View>
                      <View style={styles.cardBody}>
                        <Text style={styles.cardName} numberOfLines={1}>{p.name}</Text>
                        {!!p.description && <Text style={styles.cardDesc} numberOfLines={2}>{p.description}</Text>}
                        <View style={styles.cardFooter}>
                          {!!p.price && <Text style={styles.price}>{p.price}</Text>}
                          <View style={[styles.cardBtn, soon && styles.cardBtnSoon]}>
                            <Text style={[styles.cardBtnText, soon && styles.cardBtnTextSoon]} numberOfLines={1}>{soon ? "Prossimamente" : "Scopri"}</Text>
                          </View>
                        </View>
                      </View>
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </View>

        {/* FOOTER BANNER */}
        {!loading && (
          <LinearGradient colors={["#101C3D", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
            <View style={styles.bannerIcon}><Ionicons name="heart" size={22} color={colors.brandSecondary} /></View>
            <Text style={styles.bannerText}>Ogni acquisto contribuisce a sostenere Radio Pescatori di Uomini e la diffusione del Vangelo. Grazie per il tuo supporto!</Text>
          </LinearGradient>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: spacing["3xl"], alignItems: "center", justifyContent: "center", width: "100%" },
  hero: { paddingHorizontal: spacing.xl, paddingBottom: spacing["2xl"], overflow: "hidden" },
  heroTop: { flexDirection: "row" },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  kicker: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.12)", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  kickerText: { color: colors.brandSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { color: colors.white, fontSize: 34, fontWeight: "800", marginTop: spacing.md, letterSpacing: -0.5 },
  heroSub: { color: "#CBD5E1", fontSize: 14.5, lineHeight: 21, marginTop: spacing.sm, maxWidth: 560 },
  heroCta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.white, alignSelf: "flex-start", paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.lg, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  heroCtaText: { color: colors.navy, fontSize: 15, fontWeight: "800" },
  searchWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, maxWidth: 1100, alignSelf: "center", width: "100%" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 46 },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 15 },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.navy },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  grid: { marginTop: spacing.sm },
  cards: { flexDirection: "row", flexWrap: "wrap" },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, shadowColor: colors.navy, shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  imgWrap: { width: "100%", aspectRatio: 1, backgroundColor: colors.surfaceTertiary },
  img: { width: "100%", height: "100%" },
  imgEmpty: { alignItems: "center", justifyContent: "center" },
  featBadge: { position: "absolute", top: spacing.sm, left: spacing.sm, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.warning, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  featText: { color: colors.navy, fontSize: 10, fontWeight: "800" },
  availBadge: { position: "absolute", bottom: spacing.sm, right: spacing.sm, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  availText: { color: colors.white, fontSize: 10, fontWeight: "800" },
  cardBody: { padding: spacing.md },
  cardName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  cardDesc: { color: colors.onSurfaceTertiary, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md, gap: spacing.sm },
  price: { color: colors.brandPrimary, fontSize: 15, fontWeight: "800" },
  cardBtn: { backgroundColor: colors.navy, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, flexShrink: 1 },
  cardBtnSoon: { backgroundColor: colors.surfaceTertiary },
  cardBtnText: { color: colors.white, fontSize: 12.5, fontWeight: "800" },
  cardBtnTextSoon: { color: colors.onSurfaceTertiary },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: spacing["3xl"], width: "100%" },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  emptyTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  emptyText: { color: colors.onSurfaceSecondary, fontSize: 15, textAlign: "center", marginTop: spacing.sm, lineHeight: 22, maxWidth: 340 },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing["2xl"], padding: spacing.lg, borderRadius: radius.lg, maxWidth: 1100, alignSelf: "center", width: "100%", borderWidth: 1, borderColor: "rgba(56,189,248,0.25)" },
  bannerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(56,189,248,0.15)", alignItems: "center", justifyContent: "center" },
  bannerText: { flex: 1, color: "#CBD5E1", fontSize: 13, lineHeight: 19, fontWeight: "600" },
});

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, TextInput, ScrollView } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { useThumbAspect } from "@/src/hooks/useThumbAspect";
import { colors, spacing, radius } from "@/src/theme";

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [cats, setCats] = useState<string[]>(["Tutte"]);
  const [cat, setCat] = useState("Tutte");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const cardAspect = useThumbAspect();

  useFocusEffect(
    useCallback(() => {
      api.news().then(setItems).catch(() => {}).finally(() => setLoading(false));
      api.featuredNews().then(setFeatured).catch(() => {});
    }, [])
  );
  useEffect(() => { api.newsCategories().then(setCats).catch(() => {}); }, []);

  const showFeatured = featured.length > 0 && !search && cat === "Tutte";
  const featuredBannerId = showFeatured ? featured[0]?.id : undefined;
  const filtered = useMemo(() => items.filter((n) =>
    (cat === "Tutte" || n.category === cat) &&
    (!search || n.title.toLowerCase().includes(search.toLowerCase())) &&
    n.id !== featuredBannerId
  ), [items, cat, search, featuredBannerId]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.h1}>Notizie</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="news-search-input" value={search} onChangeText={setSearch} placeholder="Cerca notizie..." placeholderTextColor={colors.muted} style={styles.searchInput} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={styles.chipsScroll}>
          {cats.map((c) => (
            <Pressable key={c} testID={`news-chip-${c}`} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipActive]}>
              <Text style={[styles.chipText, cat === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            featured.length > 0 && !search && cat === "Tutte" ? (
              <PressableScale testID={`news-featured-${featured[0].id}`} style={styles.banner} onPress={() => router.push(`/news/${featured[0].id}`)}>
                <Image source={{ uri: featured[0].image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient colors={["transparent", "rgba(10,17,40,0.95)"]} style={StyleSheet.absoluteFill} />
                <View style={styles.bannerBadge}><Ionicons name="star" size={11} color={colors.navy} /><Text style={styles.bannerBadgeText}>IN PRIMO PIANO</Text></View>
                <View style={styles.bannerBody}>
                  <Text style={styles.bannerTitle} numberOfLines={2}>{featured[0].title}</Text>
                  <Text style={styles.bannerMeta}>{featured[0].author} · {featured[0].reading_time} min di lettura</Text>
                </View>
              </PressableScale>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.empty}>Nessuna notizia trovata</Text>}
          renderItem={({ item }) => (
            <Pressable testID={`news-card-${item.id}`} style={styles.row} onPress={() => router.push(`/news/${item.id}`)}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.rowThumb} contentFit="cover" />
              ) : (
                <View style={[styles.rowThumb, styles.rowThumbEmpty]}><Ionicons name="newspaper-outline" size={24} color={colors.brandPrimary} /></View>
              )}
              <View style={styles.rowBody}>
                {!!item.category && <Text style={styles.rowCat}>{String(item.category).toUpperCase()}</Text>}
                <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                {!!item.excerpt && <Text style={styles.rowExcerpt} numberOfLines={2}>{item.excerpt}</Text>}
                <Text style={styles.readMore}>Leggi di più ›</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  h1: { fontSize: 30, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.md },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44 },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 15 },
  chipsScroll: { marginTop: spacing.md, marginHorizontal: -spacing.lg },
  chipsRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0, borderWidth: 1, borderColor: "transparent" },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.white },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.muted, fontSize: 15, textAlign: "center", marginTop: spacing.xl },
  banner: { height: 240, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.navy, marginBottom: spacing.lg },
  bannerBadge: { position: "absolute", top: spacing.md, left: spacing.md, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.warning, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  bannerBadgeText: { color: colors.navy, fontSize: 10, fontWeight: "800" },
  bannerBody: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  bannerTitle: { color: colors.white, fontSize: 22, fontWeight: "800" },
  bannerMeta: { color: colors.brandSecondary, fontSize: 13, marginTop: spacing.xs },
  card: { width: "100%", borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.navy },
  row: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  rowThumb: { width: 76, height: 76, borderRadius: radius.md },
  rowThumbEmpty: { backgroundColor: colors.brandPrimary + "14", alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  rowCat: { color: colors.brandPrimary, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6, marginBottom: 2 },
  rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800", lineHeight: 19 },
  rowExcerpt: { color: colors.muted, fontSize: 12.5, marginTop: 2, lineHeight: 16 },
  readMore: { color: colors.brandPrimary, fontSize: 12.5, fontWeight: "800", marginTop: 4 },
  img: { ...StyleSheet.absoluteFillObject },
  scrim: { ...StyleSheet.absoluteFillObject },
  badge: { position: "absolute", top: spacing.md, left: spacing.md, backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  textBox: { position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  title: { color: colors.white, fontSize: 19, fontWeight: "800" },
  excerpt: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: spacing.xs },
  rt: { color: colors.brandSecondary, fontSize: 12, fontWeight: "600", marginTop: spacing.sm },
});

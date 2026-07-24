import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, TextInput, ScrollView } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
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

  useFocusEffect(
    useCallback(() => {
      api.news().then(setItems).catch(() => {}).finally(() => setLoading(false));
      api.featuredNews().then(setFeatured).catch(() => {});
    }, [])
  );
  useEffect(() => { api.newsCategories().then(setCats).catch(() => {}); }, []);

  const filtered = useMemo(() => items.filter((n) =>
    (cat === "Tutte" || n.category === cat) &&
    (!search || n.title.toLowerCase().includes(search.toLowerCase()))
  ), [items, cat, search]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.h1}>News</Text>
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
            <Pressable testID={`news-card-${item.id}`} style={styles.card} onPress={() => router.push(`/news/${item.id}`)}>
              <Image source={{ uri: item.image }} style={styles.img} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(10,17,40,0.92)"]} style={styles.scrim} />
              <View style={styles.badge}><Text style={styles.badgeText}>{item.category}</Text></View>
              <View style={styles.textBox}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.excerpt} numberOfLines={2}>{item.excerpt}</Text>
                {item.reading_time ? <Text style={styles.rt}>{item.reading_time} min di lettura</Text> : null}
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
  card: { height: 220, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.navy },
  img: { ...StyleSheet.absoluteFillObject },
  scrim: { ...StyleSheet.absoluteFillObject },
  badge: { position: "absolute", top: spacing.md, left: spacing.md, backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  textBox: { position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  title: { color: colors.white, fontSize: 19, fontWeight: "800" },
  excerpt: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: spacing.xs },
  rt: { color: colors.brandSecondary, fontSize: 12, fontWeight: "600", marginTop: spacing.sm },
});

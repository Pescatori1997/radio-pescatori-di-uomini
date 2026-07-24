import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet, TextInput, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function PodcastScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [cats, setCats] = useState<string[]>(["Tutti"]);
  const [cat, setCat] = useState("Tutti");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (c: string, s: string) => {
    setLoading(true);
    try {
      const data = await api.podcasts(s || undefined, c);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { api.categories().then(setCats).catch(() => {}); api.featuredPodcasts().then(setFeatured).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => load(cat, search), 300);
    return () => clearTimeout(t);
  }, [cat, search, load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.h1}>Podcast</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="podcast-search"
            placeholder="Cerca podcast, studi, testimonianze..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={styles.chipsScroll}>
          {cats.map((c) => (
            <Pressable
              key={c}
              testID={`podcast-chip-${c}`}
              onPress={() => setCat(c)}
              style={[styles.chip, cat === c && styles.chipActive]}
            >
              <Text style={[styles.chipText, cat === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}><Text style={styles.empty}>Nessun podcast trovato</Text></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.lg, paddingTop: spacing.md, paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            featured.length > 0 && !search && cat === "Tutti" ? (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={styles.featTitle}>In evidenza</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featRow}>
                  {featured.map((fp) => (
                    <PressableScale key={fp.id} testID={`featured-podcast-${fp.id}`} style={styles.featCard} onPress={() => router.push(`/podcast/${fp.id}`)}>
                      <Image source={{ uri: fp.artwork }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <LinearGradient colors={["transparent", "rgba(10,17,40,0.95)"]} style={StyleSheet.absoluteFill} />
                      <View style={styles.featBadge}><Ionicons name="star" size={11} color={colors.navy} /><Text style={styles.featBadgeText}>IN EVIDENZA</Text></View>
                      <View style={styles.featBody}>
                        <Text numberOfLines={2} style={styles.featName}>{fp.title}</Text>
                        <Text numberOfLines={1} style={styles.featMeta}>{fp.author}{fp.duration ? ` · ${fp.duration}` : ""}</Text>
                      </View>
                    </PressableScale>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <PressableScale
              testID={`podcast-card-${item.id}`}
              style={styles.card}
              onPress={() => router.push(`/podcast/${item.id}`)}
            >
              <View style={styles.artWrap}>
                <Image source={{ uri: item.artwork }} style={styles.art} contentFit="cover" />
                <LinearGradient colors={["transparent", "rgba(10,17,40,0.7)"]} style={styles.scrim} />
                <View style={styles.playCircle}><Ionicons name="play" size={18} color={colors.navy} /></View>
                <View style={styles.durBadge}><Text style={styles.durText}>{item.duration}</Text></View>
              </View>
              <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
              <Text numberOfLines={1} style={styles.cardCat}>{item.category}</Text>
            </PressableScale>
          )}
        />
      )}
    </View>
  );
}

const CARD_W = "48%";
const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surface },
  h1: { fontSize: 30, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.md },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44 },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 15 },
  chipsScroll: { marginTop: spacing.md, marginHorizontal: -spacing.lg },
  chipsRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0, borderWidth: 1, borderColor: "transparent" },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.white },
  card: { width: CARD_W },
  artWrap: { width: "100%", aspectRatio: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  art: { ...StyleSheet.absoluteFillObject },
  scrim: { ...StyleSheet.absoluteFillObject },
  playCircle: { position: "absolute", right: spacing.sm, bottom: spacing.sm, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  durBadge: { position: "absolute", left: spacing.sm, top: spacing.sm, backgroundColor: "rgba(10,17,40,0.7)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  durText: { color: colors.white, fontSize: 11, fontWeight: "600" },
  cardTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700", marginTop: spacing.sm },
  cardCat: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.muted, fontSize: 15 },
  featTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  featRow: { gap: spacing.md, paddingHorizontal: spacing.lg },
  featCard: { width: 280, height: 150, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.navy },
  featBadge: { position: "absolute", top: spacing.md, left: spacing.md, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.warning, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  featBadgeText: { color: colors.navy, fontSize: 10, fontWeight: "800" },
  featBody: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.md },
  featName: { color: colors.white, fontSize: 17, fontWeight: "800" },
  featMeta: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
});

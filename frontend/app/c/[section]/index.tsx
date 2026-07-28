import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { useThumbAspect } from "@/src/hooks/useThumbAspect";
import { sectionLabel, sectionIcon } from "@/src/utils/sections";
import { colors, spacing, radius } from "@/src/theme";

function fmtDate(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }); } catch { return ""; }
}
const TYPE_ICON: Record<string, any> = { audio: "headphones", pdf: "file-pdf-box", embed: "web", video: "play" };

export default function ContentList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section: string }>();
  const label = sectionLabel(section);
  const [items, setItems] = useState<any[]>([]);
  const [cat, setCat] = useState("Tutti");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const thumbAspect = useThumbAspect();

  const load = useCallback(() => {
    api.contents(section!, { search: search || undefined, category: cat !== "Tutti" ? cat : undefined })
      .then(setItems).catch(() => setItems([]))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [section, search, cat]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Category chips derived from the loaded data (unfiltered fetch on first mount handled by "Tutti").
  const [allCats, setAllCats] = useState<string[]>([]);
  useFocusEffect(useCallback(() => {
    api.contents(section!).then((d: any[]) => {
      const cats = Array.from(new Set(d.map((x) => x.category).filter(Boolean)));
      setAllCats(cats as string[]);
    }).catch(() => {});
  }, [section]));
  const chips = useMemo(() => ["Tutti", ...allCats], [allCats]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="cl-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{label}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>{label}</Text>
          </View>
          <View style={styles.headerIcon}><MaterialCommunityIcons name={sectionIcon(section) as any} size={22} color={colors.white} /></View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="cl-search" value={search} onChangeText={setSearch} placeholder="Cerca per titolo..." placeholderTextColor={colors.muted} style={styles.searchInput} />
          {search ? <Pressable onPress={() => setSearch("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
        </View>

        {chips.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ maxHeight: 48 }}>
            {chips.map((c) => (
              <Pressable key={c} testID={`cl-cat-${c}`} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipActive]}>
                <Text style={[styles.chipText, cat === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="folder-open-outline" size={54} color={colors.muted} />
            <Text style={styles.emptyText}>Nessun contenuto disponibile al momento.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((m, i) => (
              <Animated.View key={m.id} entering={FadeInDown.delay(Math.min(i * 50, 300))}>
                <PressableScale testID={`cl-card-${m.id}`} style={styles.card} onPress={() => router.push(`/c/${section}/${m.id}` as any)}>
                  <View style={styles.thumbWrap}>
                    {m.thumbnail ? <Image source={{ uri: m.thumbnail }} style={[styles.thumb, { aspectRatio: thumbAspect }]} contentFit="cover" /> : <View style={[styles.thumb, styles.thumbEmpty, { aspectRatio: thumbAspect }]}><MaterialCommunityIcons name={sectionIcon(section) as any} size={44} color={colors.white} /></View>}
                    <View style={styles.typeBadge}>
                      <MaterialCommunityIcons name={TYPE_ICON[m.content_type] || "play"} size={13} color={colors.white} />
                      {!!m.duration && <Text style={styles.typeBadgeText}>{m.duration}</Text>}
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{m.title}</Text>
                    {!!m.author && <Text style={styles.author} numberOfLines={1}><Ionicons name="person" size={12} color={colors.brandPrimary} /> {m.author}</Text>}
                    {!!m.subtitle && <Text style={styles.desc} numberOfLines={2}>{m.subtitle}</Text>}
                    <Text style={styles.date}>{[m.category, fmtDate(m.publish_date)].filter(Boolean).join(" · ")}</Text>
                  </View>
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  topTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800", flex: 1, textAlign: "center", marginHorizontal: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: spacing.md },
  h1: { fontSize: 28, fontWeight: "800", color: colors.onSurface },
  headerIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 46, marginHorizontal: spacing.lg, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 15 },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  chip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", flexShrink: 0, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  center: { paddingTop: spacing["3xl"], alignItems: "center" },
  empty: { alignItems: "center", paddingTop: spacing["3xl"], gap: spacing.md },
  emptyText: { color: colors.onSurfaceSecondary, fontSize: 15, textAlign: "center", paddingHorizontal: spacing.xl },
  list: { padding: spacing.lg, gap: spacing.lg },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  thumbWrap: { position: "relative" },
  thumb: { width: "100%", backgroundColor: colors.navy },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  typeBadge: { position: "absolute", top: spacing.sm, left: spacing.sm, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(10,17,40,0.82)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  typeBadgeText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  cardBody: { padding: spacing.lg },
  cardTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800", lineHeight: 22 },
  author: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600", marginTop: 6 },
  desc: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  date: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 8 },
});

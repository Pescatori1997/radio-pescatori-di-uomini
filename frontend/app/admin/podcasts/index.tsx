import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const STATUS = [{ key: "", label: "Tutti" }, { key: "published", label: "Pubblicati" }, { key: "draft", label: "Bozze" }];

export default function AdminPodcasts() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.adminPodcasts(status || undefined, search || undefined).then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, [status, search]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <AdminShell title="Podcast" activeKey="podcast">
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={ADMIN.muted} />
          <TextInput testID="pod-search" value={search} onChangeText={setSearch} placeholder="Cerca podcast..." placeholderTextColor={ADMIN.muted} style={styles.searchInput} />
        </View>
        <PressableScale testID="pod-create" style={styles.createBtn} onPress={() => router.push("/admin/podcasts/new")}>
          <Ionicons name="add" size={22} color={colors.white} />
        </PressableScale>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ maxHeight: 56 }}>
        {STATUS.map((s) => (
          <Pressable key={s.key} testID={`pod-filter-${s.key || "all"}`} onPress={() => setStatus(s.key)} style={[styles.chip, status === s.key && styles.chipActive]}>
            <Text style={[styles.chipText, status === s.key && styles.chipTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {items.length === 0 ? <Text style={styles.empty}>Nessun podcast. Tocca + per crearne uno.</Text> : items.map((p) => (
            <PressableScale key={p.id} testID={`pod-row-${p.id}`} style={styles.row} onPress={() => router.push(`/admin/podcasts/${p.id}`)}>
              {p.artwork ? <Image source={{ uri: p.artwork }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="mic" size={20} color={ADMIN.muted} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{p.title}</Text>
                <Text style={styles.meta} numberOfLines={1}>{p.category}{p.duration ? ` · ${p.duration}` : ""}</Text>
                <View style={styles.tagsRow}>
                  <View style={[styles.badge, { backgroundColor: (p.published ? colors.success : ADMIN.muted) + "22" }]}>
                    <Text style={[styles.badgeText, { color: p.published ? colors.success : ADMIN.muted }]}>{p.published ? "Pubblicato" : "Bozza"}</Text>
                  </View>
                  {p.featured && <View style={[styles.badge, { backgroundColor: colors.warning + "22" }]}><Text style={[styles.badgeText, { color: colors.warning }]}>In evidenza</Text></View>}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ADMIN.muted} />
            </PressableScale>
          ))}
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: ADMIN.card, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, borderWidth: 1, borderColor: ADMIN.border },
  searchInput: { flex: 1, color: colors.white, fontSize: 15 },
  createBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center", flexShrink: 0, borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.navy, fontWeight: "700" },
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: spacing["2xl"], fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: ADMIN.surface },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  name: { color: colors.white, fontSize: 15, fontWeight: "800" },
  meta: { color: ADMIN.muted, fontSize: 13, marginTop: 2 },
  tagsRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: "800" },
});

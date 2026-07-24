import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const STATUS = [{ key: "", label: "Tutti" }, { key: "published", label: "Visibili" }, { key: "hidden", label: "Nascosti" }, { key: "featured", label: "In evidenza" }];
const AVAIL: Record<string, { label: string; color: string }> = {
  available: { label: "Disponibile", color: colors.success },
  coming_soon: { label: "Prossimamente", color: colors.warning },
  sold_out: { label: "Esaurito", color: colors.error },
};

export default function AdminProducts() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.adminProducts(status || undefined, undefined, search || undefined).then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, [status, search]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= items.length || busy) return;
    const arr = [...items];
    [arr[index], arr[next]] = [arr[next], arr[index]];
    setItems(arr);
    setBusy(true);
    try { await api.adminReorderProducts(arr.map((p) => p.id)); } catch {} finally { setBusy(false); }
  };

  const canReorder = !status && !search;

  return (
    <AdminShell title="Merchandising" activeKey="merch">
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={ADMIN.muted} />
          <TextInput testID="prod-search" value={search} onChangeText={setSearch} placeholder="Cerca prodotto..." placeholderTextColor={ADMIN.muted} style={styles.searchInput} />
        </View>
        <PressableScale testID="prod-create" style={styles.createBtn} onPress={() => router.push("/admin/products/new")}>
          <Ionicons name="add" size={22} color={colors.white} />
        </PressableScale>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ maxHeight: 56 }}>
        {STATUS.map((s) => (
          <Pressable key={s.key} testID={`prod-filter-${s.key || "all"}`} onPress={() => setStatus(s.key)} style={[styles.chip, status === s.key && styles.chipActive]}>
            <Text style={[styles.chipText, status === s.key && styles.chipTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {canReorder && items.length > 1 && <Text style={styles.hint}>Usa le frecce per riordinare i prodotti (l'ordine è riflesso nell'app).</Text>}
          {items.length === 0 ? <Text style={styles.empty}>Nessun prodotto. Tocca + per aggiungerne uno.</Text> : items.map((p, i) => {
            const av = AVAIL[p.availability] || AVAIL.available;
            return (
              <View key={p.id} testID={`prod-row-${p.id}`} style={styles.row}>
                {canReorder && (
                  <View style={styles.reorder}>
                    <Pressable testID={`prod-up-${p.id}`} onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6}><Ionicons name="chevron-up" size={20} color={i === 0 ? ADMIN.border : colors.brandSecondary} /></Pressable>
                    <Pressable testID={`prod-down-${p.id}`} onPress={() => move(i, 1)} disabled={i === items.length - 1} hitSlop={6}><Ionicons name="chevron-down" size={20} color={i === items.length - 1 ? ADMIN.border : colors.brandSecondary} /></Pressable>
                  </View>
                )}
                <PressableScale style={styles.rowMain} onPress={() => router.push(`/admin/products/${p.id}`)}>
                  {p.images?.[0] ? <Image source={{ uri: p.images[0] }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="image-outline" size={20} color={ADMIN.muted} /></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{p.category}{p.price ? ` · ${p.price}` : ""}</Text>
                    <View style={styles.badges}>
                      <View style={[styles.badge, { backgroundColor: av.color + "22" }]}><Text style={[styles.badgeText, { color: av.color }]}>{av.label}</Text></View>
                      {p.featured && <View style={[styles.badge, { backgroundColor: colors.warning + "22" }]}><Text style={[styles.badgeText, { color: colors.warning }]}>Featured</Text></View>}
                      {!p.published && <View style={[styles.badge, { backgroundColor: ADMIN.muted + "22" }]}><Text style={[styles.badgeText, { color: ADMIN.muted }]}>Nascosto</Text></View>}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={ADMIN.muted} />
                </PressableScale>
              </View>
            );
          })}
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
  hint: { color: ADMIN.muted, fontSize: 12, marginBottom: spacing.md },
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: spacing["2xl"], fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  reorder: { alignItems: "center", justifyContent: "center" },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: ADMIN.surface },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  name: { color: colors.white, fontSize: 15, fontWeight: "800" },
  meta: { color: ADMIN.muted, fontSize: 13, marginTop: 2 },
  badges: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: "800" },
});

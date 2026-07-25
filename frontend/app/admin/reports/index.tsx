import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import { colors, spacing, radius } from "@/src/theme";

export const CAT_META: Record<string, { emoji: string; label: string }> = {
  bug: { emoji: "🐞", label: "Bug" },
  suggestion: { emoji: "💡", label: "Suggerimento" },
  technical: { emoji: "⚠️", label: "Problema tecnico" },
  other: { emoji: "❤️", label: "Altro" },
};
export const STATUS_META: Record<string, { label: string; color: string }> = {
  new: { label: "Nuova", color: colors.brandPrimary },
  in_progress: { label: "In lavorazione", color: colors.warning },
  resolved: { label: "Risolta", color: colors.success },
  closed: { label: "Chiusa", color: ADMIN.muted },
};

const STATUS_FILTERS = [{ k: "", l: "Tutte" }, { k: "new", l: "Nuove" }, { k: "in_progress", l: "In lavorazione" }, { k: "resolved", l: "Risolte" }, { k: "closed", l: "Chiuse" }];
const CAT_FILTERS = [{ k: "", l: "Tutte" }, ...Object.entries(CAT_META).map(([k, v]) => ({ k, l: v.label }))];

function fmt(iso: string) {
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export default function AdminReportsList() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.adminReports({ status: status || undefined, category: category || undefined, search: search || undefined, sort })
      .then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, [status, category, search, sort]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <AdminShell title="Segnalazioni" activeKey="reports">
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={ADMIN.muted} />
          <TextInput testID="rep-search" value={search} onChangeText={setSearch} placeholder="Cerca segnalazioni..." placeholderTextColor={ADMIN.muted} style={styles.searchInput} />
        </View>
        <Pressable testID="rep-sort" onPress={() => setSort((s) => (s === "desc" ? "asc" : "desc"))} style={styles.sortBtn}>
          <Ionicons name={sort === "desc" ? "arrow-down" : "arrow-up"} size={18} color={colors.white} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ maxHeight: 52 }}>
        {STATUS_FILTERS.map((s) => (
          <Pressable key={s.k} testID={`rep-status-${s.k || "all"}`} onPress={() => setStatus(s.k)} style={[styles.chip, status === s.k && styles.chipActive]}>
            <Text style={[styles.chipText, status === s.k && styles.chipTextActive]}>{s.l}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ maxHeight: 52 }}>
        {CAT_FILTERS.map((c) => (
          <Pressable key={c.k} testID={`rep-cat-${c.k || "all"}`} onPress={() => setCategory(c.k)} style={[styles.chip, category === c.k && styles.chipActive]}>
            <Text style={[styles.chipText, category === c.k && styles.chipTextActive]}>{c.l}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {items.length === 0 ? <Text style={styles.empty}>Nessuna segnalazione.</Text> : items.map((r) => {
            const cat = CAT_META[r.category] || CAT_META.other;
            const st = STATUS_META[r.status] || STATUS_META.new;
            return (
              <Pressable key={r.id} testID={`rep-row-${r.id}`} style={[styles.row, !r.read && styles.rowUnread]} onPress={() => router.push(`/admin/reports/${r.id}`)}>
                {!r.read && <View style={styles.unreadDot} />}
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, !r.read && { fontWeight: "800" }]} numberOfLines={1}>{r.title}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{cat.label} · {r.user_name || r.user_email || "Ospite"} · {fmt(r.created_at)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: st.color + "22" }]}><Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text></View>
              </Pressable>
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
  sortBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: ADMIN.border },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  chip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center", flexShrink: 0, borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.navy, fontWeight: "700" },
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: spacing["2xl"], fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: ADMIN.border },
  rowUnread: { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary + "12" },
  unreadDot: { position: "absolute", top: 8, left: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary },
  catEmoji: { fontSize: 22 },
  title: { color: colors.white, fontSize: 15, fontWeight: "700" },
  meta: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: "800" },
});

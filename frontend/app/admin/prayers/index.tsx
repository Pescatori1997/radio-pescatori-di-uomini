import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const FILTERS = [
  { key: "", label: "Tutte" },
  { key: "pending", label: "In attesa" },
  { key: "published", label: "Pubblicate" },
  { key: "private", label: "Private" },
  { key: "archived", label: "Archiviate" },
];

export const PRAYER_LABEL: Record<string, string> = { new: "Nuova", in_progress: "In corso", prayed: "Pregata", archived: "Archiviata" };
export const PRAYER_COLOR: Record<string, string> = { new: "#F59E0B", in_progress: colors.brandPrimary, prayed: colors.success, archived: ADMIN.muted };

/** Derive a human display state for a prayer request. */
export function displayState(p: any): { label: string; color: string } {
  if (p.status === "archived") return { label: "Archiviata", color: ADMIN.muted };
  if ((p.visibility || "private") === "board") {
    return p.published ? { label: "Pubblicata", color: colors.success } : { label: "In attesa", color: "#F59E0B" };
  }
  return { label: "Privata", color: colors.brandPrimary };
}

export function authorLine(p: any): string {
  return p.author_name || p.author_email || p.name || "Anonimo";
}

export default function AdminPrayers() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.adminPrayers(filter || undefined, search || undefined).then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, [filter, search]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <AdminShell title="Richieste di Preghiera" activeKey="prayer">
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={ADMIN.muted} />
          <TextInput testID="prayer-search" value={search} onChangeText={setSearch} placeholder="Cerca (testo, nome, autore)..." placeholderTextColor={ADMIN.muted} style={styles.searchInput} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ maxHeight: 56 }}>
        {FILTERS.map((s) => (
          <Pressable key={s.key} testID={`prayer-filter-${s.key || "all"}`} onPress={() => setFilter(s.key)} style={[styles.chip, filter === s.key && styles.chipActive]}>
            <Text style={[styles.chipText, filter === s.key && styles.chipTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {items.length === 0 ? <Text style={styles.empty}>Nessuna richiesta di preghiera.</Text> : items.map((p) => {
            const st = displayState(p);
            const isBoard = (p.visibility || "private") === "board";
            const nameShown = isBoard ? (p.show_name && p.name ? p.name : "Anonima") : (p.name || "—");
            return (
              <PressableScale key={p.id} testID={`prayer-row-${p.id}`} style={styles.row} onPress={() => router.push(`/admin/prayers/${p.id}`)}>
                <View style={styles.icon}><MaterialCommunityIcons name="hands-pray" size={20} color={colors.brandPrimary} /></View>
                <View style={{ flex: 1 }}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: (isBoard ? "#0EA5E9" : ADMIN.muted) + "22" }]}>
                      <Text style={[styles.badgeText, { color: isBoard ? "#38BDF8" : ADMIN.muted }]}>{isBoard ? "📢 Bacheca" : "🔒 Privata"}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: st.color + "22" }]}>
                      <Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text>
                    </View>
                    {isBoard && (
                      <View style={[styles.badge, { backgroundColor: ADMIN.card }]}>
                        <Text style={[styles.badgeText, { color: colors.white }]}>{p.show_name && p.name ? `👤 ${nameShown}` : "🕶 Anonima"}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.text} numberOfLines={2}>{p.text}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {authorLine(p)} · {p.created_at ? new Date(p.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    {isBoard && p.published ? ` · 🙏 ${p.praying_count || 0}` : ""}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={ADMIN.muted} />
              </PressableScale>
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
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center", flexShrink: 0, borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.navy, fontWeight: "700" },
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: spacing["2xl"], fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary + "22", alignItems: "center", justifyContent: "center" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  text: { color: "#E2E8F0", fontSize: 14, marginTop: 2 },
  meta: { color: ADMIN.muted, fontSize: 12, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: "800" },
});

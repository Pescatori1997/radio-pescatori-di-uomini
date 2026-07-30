import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, RefreshControl } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function AdminPlansList() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.adminReadingPlans().then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const q = search.trim().toLowerCase();
  const filtered = q ? items.filter((p) => (p.title || "").toLowerCase().includes(q)) : items;

  return (
    <AdminShell title="Piani di Lettura" activeKey="plans">
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={ADMIN.muted} />
          <TextInput testID="plan-admin-search" value={search} onChangeText={setSearch} placeholder="Cerca piani..." placeholderTextColor={ADMIN.muted} style={styles.searchInput} />
        </View>
        <PressableScale testID="plan-create" style={styles.createBtn} onPress={() => router.push("/admin/reading-plans/new")}>
          <Ionicons name="add" size={22} color={colors.white} />
        </PressableScale>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {filtered.length === 0 ? <Text style={styles.empty}>Nessun piano. Tocca + per crearne uno.</Text> : filtered.map((p) => (
            <PressableScale key={p.id} testID={`plan-row-${p.id}`} style={styles.row} onPress={() => router.push(`/admin/reading-plans/${p.id}`)}>
              <View style={styles.rowIcon}><MaterialCommunityIcons name="book-open-page-variant" size={22} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={2}>{p.title}</Text>
                <Text style={styles.meta} numberOfLines={1}>{p.duration_days} giorni{p.category ? ` · ${p.category}` : ""}</Text>
                <View style={styles.tagsRow}>
                  <View style={[styles.badge, p.status === "published" ? styles.badgePub : styles.badgeDraft]}>
                    <Text style={styles.badgeText}>{p.status === "published" ? "Pubblicato" : "Bozza"}</Text>
                  </View>
                  {p.featured && <View style={[styles.badge, styles.badgeFeat]}><Text style={styles.badgeText}>In evidenza</Text></View>}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={ADMIN.muted} />
            </PressableScale>
          ))}
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: ADMIN.card, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  searchInput: { flex: 1, color: colors.white, paddingVertical: 10, fontSize: 15 },
  createBtn: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: ADMIN.muted, fontSize: 14, textAlign: "center", marginTop: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  rowIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  name: { color: colors.white, fontSize: 15, fontWeight: "800" },
  meta: { color: ADMIN.muted, fontSize: 12.5, marginTop: 2 },
  tagsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgePub: { backgroundColor: "rgba(34,197,94,0.2)" },
  badgeDraft: { backgroundColor: "rgba(148,163,184,0.2)" },
  badgeFeat: { backgroundColor: "rgba(251,191,36,0.2)" },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
});

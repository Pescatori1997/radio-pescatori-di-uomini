import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { crewPortrait } from "@/src/crewAssets";
import { colors, spacing, radius } from "@/src/theme";

const STATUS = [
  { key: "", label: "Tutte" },
  { key: "pending", label: "In attesa" },
  { key: "approved", label: "Approvate" },
  { key: "rejected", label: "Rifiutate" },
];
const STATUS_COLOR: Record<string, string> = { pending: "#F59E0B", approved: colors.success, rejected: colors.error };

export default function AdminTeam() {
  const router = useRouter();
  const [tab, setTab] = useState<"apps" | "members">("apps");
  const [apps, setApps] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.adminApplications(status || undefined, sort, search || undefined),
      api.adminCrew(),
    ]).then(([a, m]) => { setApps(a); setMembers(m); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [status, sort, search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <AdminShell title="Gestione Team" activeKey="team">
      <View style={styles.tabs}>
        <Pressable testID="tab-apps" style={[styles.tab, tab === "apps" && styles.tabActive]} onPress={() => setTab("apps")}>
          <Text style={[styles.tabText, tab === "apps" && styles.tabTextActive]}>Candidature ({apps.length})</Text>
        </Pressable>
        <Pressable testID="tab-members" style={[styles.tab, tab === "members" && styles.tabActive]} onPress={() => setTab("members")}>
          <Text style={[styles.tabText, tab === "members" && styles.tabTextActive]}>Membri ({members.length})</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : tab === "apps" ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
        >
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={ADMIN.muted} />
            <TextInput testID="app-search" value={search} onChangeText={setSearch} placeholder="Cerca per nome o email..." placeholderTextColor={ADMIN.muted} style={styles.searchInput} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {STATUS.map((s) => (
              <Pressable key={s.key} testID={`filter-${s.key || "all"}`} onPress={() => setStatus(s.key)} style={[styles.chip, status === s.key && styles.chipActive]}>
                <Text style={[styles.chipText, status === s.key && styles.chipTextActive]}>{s.label}</Text>
              </Pressable>
            ))}
            <Pressable testID="sort-toggle" onPress={() => setSort(sort === "newest" ? "oldest" : "newest")} style={[styles.chip, styles.sortChip]}>
              <MaterialCommunityIcons name={sort === "newest" ? "sort-descending" : "sort-ascending"} size={14} color={colors.white} />
              <Text style={styles.chipTextActive}>{sort === "newest" ? "Recenti" : "Vecchie"}</Text>
            </Pressable>
          </ScrollView>

          {apps.length === 0 ? (
            <Text style={styles.empty}>Nessuna candidatura</Text>
          ) : apps.map((a) => (
            <PressableScale key={a.id} testID={`app-row-${a.id}`} style={styles.row} onPress={() => router.push(`/admin/application/${a.id}`)}>
              {a.portrait ? (
                <Image source={{ uri: a.portrait }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="person" size={22} color={ADMIN.muted} /></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{a.name} {a.surname}</Text>
                <Text style={styles.rowRole}>{a.desired_role}</Text>
                <Text style={styles.rowMeta}>{new Date(a.created_at).toLocaleDateString("it-IT")}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[a.status] || ADMIN.muted) + "22" }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLOR[a.status] || ADMIN.muted }]}>
                  {a.status === "pending" ? "In attesa" : a.status === "approved" ? "Approvata" : "Rifiutata"}
                </Text>
              </View>
            </PressableScale>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {members.length === 0 ? (
            <Text style={styles.empty}>Nessun membro</Text>
          ) : members.map((m) => (
            <PressableScale key={m.id} testID={`member-row-${m.id}`} style={styles.row} onPress={() => router.push(`/admin/member/${m.id}`)}>
              <Image source={crewPortrait(m)} style={styles.thumb} contentFit="cover" contentPosition="top" />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{m.name}</Text>
                <Text style={styles.rowRole}>{m.role}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: (m.published ? colors.success : ADMIN.muted) + "22" }]}>
                <Text style={[styles.badgeText, { color: m.published ? colors.success : ADMIN.muted }]}>{m.published ? "Pubblico" : "Nascosto"}</Text>
              </View>
            </PressableScale>
          ))}
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, paddingBottom: 0 },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: ADMIN.card, alignItems: "center" },
  tabActive: { backgroundColor: colors.brandPrimary },
  tabText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: colors.white },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: ADMIN.card, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, borderWidth: 1, borderColor: ADMIN.border },
  searchInput: { flex: 1, color: colors.white, fontSize: 15 },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.md },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center", flexShrink: 0, borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.navy, fontSize: 13, fontWeight: "700" },
  sortChip: { flexDirection: "row", gap: 4, backgroundColor: ADMIN.surface },
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: spacing["2xl"], fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  thumb: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: ADMIN.surface },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  rowName: { color: colors.white, fontSize: 15, fontWeight: "800" },
  rowRole: { color: colors.brandSecondary, fontSize: 13, marginTop: 2 },
  rowMeta: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { fontSize: 11, fontWeight: "800" },
});

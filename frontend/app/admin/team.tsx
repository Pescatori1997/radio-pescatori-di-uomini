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
  const [tab, setTab] = useState<"apps" | "members" | "ranks">("apps");
  const [apps, setApps] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.adminApplications(status || undefined, sort, search || undefined),
      api.adminCrew(),
      api.adminCrewRanks(),
    ]).then(([a, m, r]) => { setApps(a); setMembers(m); setRanks(r || []); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [status, sort, search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rankName = (rid?: string) => ranks.find((r) => r.id === rid)?.name || null;
  const addRank = async () => { await api.adminCreateRank({ name: "Nuovo grado", level: (ranks.length || 0) + 1 }).catch(() => {}); load(); };
  const saveRank = async (r: any) => { await api.adminEditRank(r.id, { name: r.name, level: parseInt(String(r.level), 10) || 1 }).catch(() => {}); load(); };
  const delRank = async (rid: string) => { await api.adminDeleteRank(rid).catch(() => {}); load(); };
  const setRankField = (id: string, k: string, v: any) => setRanks((prev) => prev.map((r) => (r.id === id ? { ...r, [k]: v } : r)));

  return (
    <AdminShell title="Gestione Team" activeKey="team">
      <View style={styles.tabs}>
        <Pressable testID="tab-apps" style={[styles.tab, tab === "apps" && styles.tabActive]} onPress={() => setTab("apps")}>
          <Text style={[styles.tabText, tab === "apps" && styles.tabTextActive]}>Candidature ({apps.length})</Text>
        </Pressable>
        <Pressable testID="tab-members" style={[styles.tab, tab === "members" && styles.tabActive]} onPress={() => setTab("members")}>
          <Text style={[styles.tabText, tab === "members" && styles.tabTextActive]}>Membri ({members.length})</Text>
        </Pressable>
        <Pressable testID="tab-ranks" style={[styles.tab, tab === "ranks" && styles.tabActive]} onPress={() => setTab("ranks")}>
          <Text style={[styles.tabText, tab === "ranks" && styles.tabTextActive]}>Gradi ({ranks.length})</Text>
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
      ) : tab === "members" ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {members.length === 0 ? (
            <Text style={styles.empty}>Nessun membro</Text>
          ) : members.map((m) => (
            <PressableScale key={m.id} testID={`member-row-${m.id}`} style={styles.row} onPress={() => router.push(`/admin/member/${m.id}`)}>
              <Image source={crewPortrait(m)} style={styles.thumb} contentFit="cover" contentPosition="top" />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{m.name}</Text>
                <Text style={styles.rowRole}>{m.role}{rankName(m.rank_id) ? ` · ${rankName(m.rank_id)}` : ""}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: (m.published ? colors.success : ADMIN.muted) + "22" }]}>
                <Text style={[styles.badgeText, { color: m.published ? colors.success : ADMIN.muted }]}>{m.published ? "Pubblico" : "Nascosto"}</Text>
              </View>
            </PressableScale>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.rankIntro}>Crea i gradi (livelli) del team. I membri vengono raggruppati per grado nella pagina Equipaggio, in ordine di livello (1 in alto). Assegna il grado dalla scheda di ogni membro.</Text>
          {ranks.map((r) => (
            <View key={r.id} style={styles.rankRow}>
              <View style={styles.levelBox}>
                <Text style={styles.levelLabel}>Liv.</Text>
                <TextInput testID={`rank-level-${r.id}`} value={String(r.level ?? "")} onChangeText={(v) => setRankField(r.id, "level", v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" style={styles.levelInput} />
              </View>
              <TextInput testID={`rank-name-${r.id}`} value={r.name} onChangeText={(v) => setRankField(r.id, "name", v)} placeholder="Nome grado" placeholderTextColor={ADMIN.muted} style={styles.rankInput} />
              <PressableScale testID={`rank-save-${r.id}`} onPress={() => saveRank(r)} style={styles.rankSave}><Ionicons name="checkmark" size={18} color={colors.white} /></PressableScale>
              <PressableScale testID={`rank-del-${r.id}`} onPress={() => delRank(r.id)} style={styles.rankDel}><Ionicons name="trash" size={16} color={colors.error} /></PressableScale>
            </View>
          ))}
          <PressableScale testID="rank-add" onPress={addRank} style={styles.rankAdd}>
            <Ionicons name="add" size={20} color={colors.white} /><Text style={styles.rankAddText}>Aggiungi grado</Text>
          </PressableScale>
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
  rankIntro: { color: ADMIN.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  rankRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  levelBox: { alignItems: "center", backgroundColor: ADMIN.card, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border, paddingHorizontal: 8, paddingVertical: 4 },
  levelLabel: { color: ADMIN.muted, fontSize: 9, fontWeight: "700" },
  levelInput: { color: colors.white, fontSize: 16, fontWeight: "800", width: 34, textAlign: "center", padding: 0 },
  rankInput: { flex: 1, backgroundColor: ADMIN.card, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: ADMIN.border },
  rankSave: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  rankDel: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.error + "22", alignItems: "center", justifyContent: "center" },
  rankAdd: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.sm },
  rankAddText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function AdminVersesList() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.adminVerses(search || undefined).then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, [search]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <AdminShell title="Versetto del Giorno" activeKey="verses">
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={ADMIN.muted} />
          <TextInput testID="verse-search" value={search} onChangeText={setSearch} placeholder="Cerca versetti..." placeholderTextColor={ADMIN.muted} style={styles.searchInput} />
        </View>
        <PressableScale testID="verse-create" style={styles.createBtn} onPress={() => router.push("/admin/verses/new")}>
          <Ionicons name="add" size={22} color={colors.white} />
        </PressableScale>
      </View>

      <Text style={styles.hint}>I versetti ruotano automaticamente, uno al giorno (fuso orario Italia). Nessuna ripetizione finché non sono stati mostrati tutti.</Text>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {items.length === 0 ? <Text style={styles.empty}>Nessun versetto. Tocca + per aggiungerne uno.</Text> : items.map((v) => (
            <PressableScale key={v.id} testID={`verse-row-${v.id}`} style={[styles.row, v.active === false && { opacity: 0.5 }]} onPress={() => router.push(`/admin/verses/${v.id}`)}>
              <View style={styles.refBadge}><Text style={styles.refBadgeText} numberOfLines={1}>{v.reference}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.text} numberOfLines={2}>{v.text}</Text>
                {v.active === false && <Text style={styles.inactive}>Disattivato</Text>}
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
  hint: { color: ADMIN.muted, fontSize: 12.5, lineHeight: 18, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: spacing["2xl"], fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  refBadge: { backgroundColor: colors.brandPrimary + "22", paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm, maxWidth: 110 },
  refBadgeText: { color: colors.brandSecondary, fontSize: 12, fontWeight: "800" },
  text: { color: colors.white, fontSize: 14, fontWeight: "600", lineHeight: 19 },
  inactive: { color: colors.warning, fontSize: 11, fontWeight: "700", marginTop: 4 },
});

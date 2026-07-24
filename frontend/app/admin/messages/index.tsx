import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const TYPES = [{ key: "", label: "Tutti" }, { key: "message", label: "Messaggi" }, { key: "testimony", label: "Testimonianze" }];
const STATUS = [
  { key: "", label: "Tutti" },
  { key: "new", label: "Nuovi" },
  { key: "reviewed", label: "Revisionati" },
  { key: "published", label: "Pubblicati" },
  { key: "archived", label: "Archiviati" },
];
export const MSG_LABEL: Record<string, string> = { new: "Nuovo", reviewed: "Revisionato", published: "Pubblicato", archived: "Archiviato" };
export const MSG_COLOR: Record<string, string> = { new: "#F59E0B", reviewed: colors.brandPrimary, published: colors.success, archived: ADMIN.muted };

export default function AdminMessages() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.adminMessages(status || undefined, type || undefined, search || undefined).then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, [status, type, search]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <AdminShell title="Messaggi & Testimonianze" activeKey="messages">
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={ADMIN.muted} />
          <TextInput testID="msg-search" value={search} onChangeText={setSearch} placeholder="Cerca..." placeholderTextColor={ADMIN.muted} style={styles.searchInput} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ maxHeight: 52 }}>
        {TYPES.map((s) => (
          <Pressable key={s.key} testID={`msg-type-${s.key || "all"}`} onPress={() => setType(s.key)} style={[styles.chip, type === s.key && styles.chipActive]}>
            <Text style={[styles.chipText, type === s.key && styles.chipTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ maxHeight: 52 }}>
        {STATUS.map((s) => (
          <Pressable key={s.key} testID={`msg-filter-${s.key || "all"}`} onPress={() => setStatus(s.key)} style={[styles.chip, status === s.key && styles.chipActive]}>
            <Text style={[styles.chipText, status === s.key && styles.chipTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {items.length === 0 ? <Text style={styles.empty}>Nessun messaggio.</Text> : items.map((m) => (
            <PressableScale key={m.id} testID={`msg-row-${m.id}`} style={styles.row} onPress={() => router.push(`/admin/messages/${m.id}`)}>
              <View style={styles.icon}><MaterialCommunityIcons name={m.type === "testimony" ? "message-star" : "message-text"} size={20} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{m.name || "Senza nome"} · {m.type === "testimony" ? "Testimonianza" : "Messaggio"}</Text>
                <Text style={styles.text} numberOfLines={2}>{m.text}</Text>
                <View style={[styles.badge, { backgroundColor: (MSG_COLOR[m.status] || ADMIN.muted) + "22", alignSelf: "flex-start", marginTop: 6 }]}>
                  <Text style={[styles.badgeText, { color: MSG_COLOR[m.status] || ADMIN.muted }]}>{MSG_LABEL[m.status] || m.status}</Text>
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
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  chip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center", flexShrink: 0, borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.navy, fontWeight: "700" },
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: spacing["2xl"], fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary + "22", alignItems: "center", justifyContent: "center" },
  name: { color: colors.white, fontSize: 14, fontWeight: "800" },
  text: { color: ADMIN.muted, fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: "800" },
});

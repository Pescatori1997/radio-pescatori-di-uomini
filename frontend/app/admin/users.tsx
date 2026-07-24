import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, RefreshControl, Alert, Platform } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function AdminUsers() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.adminUsers(search || undefined).then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, [search]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doDelete = async (u: any) => {
    try { await api.adminDeleteUser(u.user_id); load(); }
    catch (e: any) { if (Platform.OS === "web") window.alert(e.message); else Alert.alert("Errore", e.message); }
  };
  const confirmDelete = (u: any) => {
    if (Platform.OS === "web") { if (window.confirm(`Eliminare ${u.name || u.email}?`)) doDelete(u); }
    else Alert.alert("Elimina utente", `Eliminare ${u.name || u.email}?`, [{ text: "Annulla", style: "cancel" }, { text: "Elimina", style: "destructive", onPress: () => doDelete(u) }]);
  };

  return (
    <AdminShell title="Utenti" activeKey="users">
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={ADMIN.muted} />
          <TextInput testID="user-search" value={search} onChangeText={setSearch} placeholder="Cerca per nome o email..." placeholderTextColor={ADMIN.muted} style={styles.searchInput} />
        </View>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          <Text style={styles.count}>{items.length} utenti registrati</Text>
          {items.map((u) => (
            <View key={u.user_id} testID={`user-row-${u.user_id}`} style={styles.row}>
              {u.picture ? <Image source={{ uri: u.picture }} style={styles.avatar} contentFit="cover" /> : (
                <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.avatarText}>{(u.name || u.email || "?").charAt(0).toUpperCase()}</Text></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{u.name || "Senza nome"}</Text>
                <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
                <View style={styles.tags}>
                  <View style={styles.badge}><Text style={styles.badgeText}>{u.provider === "google" ? "Google" : "Email"}</Text></View>
                  {u.is_admin && <View style={[styles.badge, { backgroundColor: colors.warning + "22" }]}><Text style={[styles.badgeText, { color: colors.warning }]}>Admin</Text></View>}
                </View>
              </View>
              {!u.is_admin && (
                <PressableScale testID={`user-delete-${u.user_id}`} onPress={() => confirmDelete(u)} style={styles.delBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </PressableScale>
              )}
            </View>
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
  count: { color: ADMIN.muted, fontSize: 13, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: ADMIN.surface },
  avatarEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary + "22" },
  avatarText: { color: colors.brandPrimary, fontSize: 18, fontWeight: "800" },
  name: { color: colors.white, fontSize: 15, fontWeight: "800" },
  email: { color: ADMIN.muted, fontSize: 13, marginTop: 1 },
  tags: { flexDirection: "row", gap: 6, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: ADMIN.surface },
  badgeText: { fontSize: 10, fontWeight: "800", color: ADMIN.muted },
  delBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.error + "18", alignItems: "center", justifyContent: "center" },
});

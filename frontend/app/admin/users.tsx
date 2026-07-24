import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, RefreshControl, Alert, Platform, Modal, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const ROLES = [
  { key: "listener", label: "Ascoltatore" },
  { key: "collaborator", label: "Collaboratore" },
];
const SECTIONS: { key: string; label: string }[] = [
  { key: "podcasts", label: "Podcast" },
  { key: "news", label: "News" },
  { key: "merch", label: "Merchandising" },
  { key: "schedule", label: "Palinsesto" },
  { key: "prayers", label: "Preghiere" },
  { key: "messages", label: "Messaggi" },
  { key: "radio", label: "Radio" },
  { key: "users", label: "Utenti" },
];

function roleLabel(u: any) {
  if (u.is_admin || u.role === "administrator") return "Admin";
  if (u.role === "collaborator") return "Collaboratore";
  return "Ascoltatore";
}

export default function AdminUsers() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [selRole, setSelRole] = useState("listener");
  const [selPerms, setSelPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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

  const openManage = (u: any) => {
    setEditing(u);
    setSelRole(u.role === "collaborator" ? "collaborator" : "listener");
    setSelPerms(u.permissions || []);
  };
  const togglePerm = (k: string) => setSelPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const saveRole = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.adminSetUserRole(editing.user_id, { role: selRole, permissions: selRole === "collaborator" ? selPerms : [] });
      setEditing(null);
      load();
    } catch (e: any) {
      if (Platform.OS === "web") window.alert(e.message); else Alert.alert("Errore", e.message);
    } finally { setSaving(false); }
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
          {items.map((u) => {
            const rl = roleLabel(u);
            const isCollab = u.role === "collaborator";
            return (
              <View key={u.user_id} testID={`user-row-${u.user_id}`} style={styles.row}>
                {u.picture ? <Image source={{ uri: u.picture }} style={styles.avatar} contentFit="cover" /> : (
                  <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.avatarText}>{(u.name || u.email || "?").charAt(0).toUpperCase()}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{u.name || "Senza nome"}</Text>
                  <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
                  <View style={styles.tags}>
                    <View style={styles.badge}><Text style={styles.badgeText}>{u.provider === "google" ? "Google" : "Email"}</Text></View>
                    <View style={[styles.badge, u.is_admin ? { backgroundColor: colors.warning + "22" } : isCollab ? { backgroundColor: colors.brandPrimary + "22" } : null]}>
                      <Text style={[styles.badgeText, u.is_admin ? { color: colors.warning } : isCollab ? { color: colors.brandPrimary } : null]}>{rl}</Text>
                    </View>
                    {isCollab && (u.permissions || []).length > 0 && (
                      <View style={styles.badge}><Text style={styles.badgeText}>{(u.permissions || []).length} sezioni</Text></View>
                    )}
                  </View>
                </View>
                {!u.is_admin && (
                  <>
                    <PressableScale testID={`user-role-${u.user_id}`} onPress={() => openManage(u)} style={styles.roleBtn}>
                      <Ionicons name="shield-outline" size={18} color={colors.brandPrimary} />
                    </PressableScale>
                    <PressableScale testID={`user-delete-${u.user_id}`} onPress={() => confirmDelete(u)} style={styles.delBtn}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </PressableScale>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>Ruolo · {editing?.name || editing?.email}</Text>
              <Pressable testID="role-modal-close" onPress={() => setEditing(null)} hitSlop={10}><Ionicons name="close" size={22} color={ADMIN.muted} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: spacing.lg }}>
              <Text style={styles.modalLabel}>Ruolo</Text>
              <View style={styles.roleRow}>
                {ROLES.map((r) => (
                  <PressableScale key={r.key} testID={`role-opt-${r.key}`} onPress={() => setSelRole(r.key)} style={[styles.roleChip, selRole === r.key && styles.roleChipActive]}>
                    <Text style={[styles.roleChipText, selRole === r.key && styles.roleChipTextActive]}>{r.label}</Text>
                  </PressableScale>
                ))}
              </View>

              {selRole === "collaborator" && (
                <>
                  <Text style={[styles.modalLabel, { marginTop: spacing.lg }]}>Permessi sezioni</Text>
                  <Text style={styles.modalHint}>Seleziona le sezioni del pannello che il collaboratore può gestire.</Text>
                  <View style={styles.permGrid}>
                    {SECTIONS.map((s) => {
                      const on = selPerms.includes(s.key);
                      return (
                        <PressableScale key={s.key} testID={`perm-${s.key}`} onPress={() => togglePerm(s.key)} style={[styles.permChip, on && styles.permChipActive]}>
                          <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={16} color={on ? colors.white : ADMIN.muted} />
                          <Text style={[styles.permChipText, on && styles.permChipTextActive]}>{s.label}</Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <PressableScale testID="role-save" onPress={saveRole} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Salva ruolo</Text>}
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>
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
  tags: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: ADMIN.surface },
  badgeText: { fontSize: 10, fontWeight: "800", color: ADMIN.muted },
  roleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary + "18", alignItems: "center", justifyContent: "center" },
  delBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.error + "18", alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: 440, backgroundColor: ADMIN.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: ADMIN.border, overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  modalTitle: { flex: 1, color: colors.white, fontSize: 16, fontWeight: "800", marginRight: spacing.md },
  modalLabel: { color: colors.white, fontSize: 14, fontWeight: "800", marginBottom: spacing.sm },
  modalHint: { color: ADMIN.muted, fontSize: 12, marginBottom: spacing.md },
  roleRow: { flexDirection: "row", gap: spacing.sm },
  roleChip: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  roleChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  roleChipText: { color: ADMIN.muted, fontSize: 14, fontWeight: "800" },
  roleChipTextActive: { color: colors.white },
  permGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  permChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  permChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  permChipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  permChipTextActive: { color: colors.white },
  modalFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: ADMIN.border },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center" },
  saveText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});

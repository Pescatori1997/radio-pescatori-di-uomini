import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, RefreshControl, Alert, Platform, Modal, Pressable, Dimensions, Switch } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const SECTIONS: { key: string; label: string }[] = [
  { key: "podcasts", label: "Podcast" },
  { key: "news", label: "News" },
  { key: "merch", label: "Merchandising" },
  { key: "schedule", label: "Palinsesto" },
  { key: "prayers", label: "Preghiere" },
  { key: "messages", label: "Messaggi" },
  { key: "team", label: "Team" },
  { key: "radio", label: "Radio" },
];

const ROLE_FILTERS = [
  { key: "", label: "Tutti" },
  { key: "administrator", label: "Admin" },
  { key: "collaborator", label: "Collaboratori" },
  { key: "listener", label: "Ascoltatori" },
];
const STATUS_FILTERS = [
  { key: "", label: "Tutti" },
  { key: "active", label: "Attivi" },
  { key: "suspended", label: "Sospesi" },
];
const SORTS = [
  { key: "recent", label: "Recenti" },
  { key: "name", label: "Nome" },
  { key: "last_login", label: "Ultimo accesso" },
];

function roleLabel(u: any) {
  if (u.is_admin || u.role === "administrator") return "Amministratore";
  if (u.role === "collaborator") return "Collaboratore";
  return "Ascoltatore";
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; }
}
function fmtDateTime(iso?: string) {
  if (!iso) return "Mai";
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) + " · " + new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); } catch { return "Mai"; }
}

export default function AdminUsers() {
  const [items, setItems] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const wide = Dimensions.get("window").width >= 900;

  // action sheet
  const [actionUser, setActionUser] = useState<any | null>(null);
  // permissions modal
  const [editing, setEditing] = useState<any | null>(null);
  const [selRole, setSelRole] = useState("collaborator");
  const [selPerms, setSelPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("collaborator");
  const [invPerms, setInvPerms] = useState<string[]>([]);
  const [invBusy, setInvBusy] = useState(false);
  const [invMsg, setInvMsg] = useState("");

  const load = useCallback(() => {
    api.adminUsersFiltered({ search: search || undefined, role: roleFilter || undefined, status: statusFilter || undefined, sort })
      .then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
    api.adminInvitations().then((d) => setInvites(d.filter((i: any) => i.status === "pending"))).catch(() => {});
  }, [search, roleFilter, statusFilter, sort]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const notify = (m: string) => { if (Platform.OS === "web") window.alert(m); else Alert.alert("", m); };

  const doDelete = async (u: any) => {
    try { await api.adminDeleteUser(u.user_id); setActionUser(null); load(); }
    catch (e: any) { notify(e.message); }
  };
  const confirmDelete = (u: any) => {
    if (Platform.OS === "web") { if (window.confirm(`Eliminare ${u.name || u.email}?`)) doDelete(u); }
    else Alert.alert("Elimina utente", `Eliminare ${u.name || u.email}?`, [{ text: "Annulla", style: "cancel" }, { text: "Elimina", style: "destructive", onPress: () => doDelete(u) }]);
  };
  const setStatus = async (u: any, status: string) => {
    try { await api.adminSetUserStatus(u.user_id, status); setActionUser(null); load(); }
    catch (e: any) { notify(e.message); }
  };
  const quickRole = async (u: any, role: string) => {
    try { await api.adminSetUserRole(u.user_id, { role, permissions: [] }); setActionUser(null); load(); }
    catch (e: any) { notify(e.message); }
  };

  const openManage = (u: any) => {
    setActionUser(null);
    setEditing(u);
    setSelRole(u.role === "collaborator" ? "collaborator" : "collaborator");
    setSelPerms(u.permissions || []);
  };
  const togglePerm = (k: string) => setSelPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const saveRole = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.adminSetUserRole(editing.user_id, { role: "collaborator", permissions: selPerms });
      setEditing(null); load();
    } catch (e: any) { notify(e.message); } finally { setSaving(false); }
  };

  const toggleInvPerm = (k: string) => setInvPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const sendInvite = async () => {
    if (!invEmail.trim() || !invEmail.includes("@")) { setInvMsg("Inserisci un'email valida"); return; }
    setInvBusy(true); setInvMsg("");
    try {
      const res = await api.adminCreateInvitation({ email: invEmail.trim(), role: invRole, permissions: invRole === "collaborator" ? invPerms : [] });
      setInvEmail(""); setInvPerms([]);
      setInvMsg(res.email_sent ? "Invito inviato via email ✓" : "Invito creato. L'email non è ancora attiva: copia il link dall'elenco qui sotto.");
      load();
    } catch (e: any) { setInvMsg(e.message); } finally { setInvBusy(false); }
  };
  const copyLink = async (url: string) => {
    await Clipboard.setStringAsync(url);
    notify("Link copiato negli appunti");
  };
  const revokeInvite = async (id: string) => {
    try { await api.adminDeleteInvitation(id); load(); } catch (e: any) { notify(e.message); }
  };

  const Avatar = ({ u, size = 44 }: { u: any; size?: number }) => (
    u.picture ? <Image source={{ uri: u.picture }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      : <View style={[styles.avatarEmpty, { width: size, height: size, borderRadius: size / 2 }]}><Text style={styles.avatarText}>{(u.name || u.email || "?").charAt(0).toUpperCase()}</Text></View>
  );

  const RoleBadge = ({ u }: { u: any }) => {
    const admin = u.is_admin || u.role === "administrator";
    const collab = u.role === "collaborator";
    return (
      <View style={[styles.badge, admin ? { backgroundColor: colors.warning + "22" } : collab ? { backgroundColor: colors.brandPrimary + "22" } : { backgroundColor: ADMIN.surface }]}>
        <Text style={[styles.badgeText, admin ? { color: colors.warning } : collab ? { color: colors.brandPrimary } : { color: ADMIN.muted }]}>{roleLabel(u)}</Text>
      </View>
    );
  };
  const StatusBadge = ({ u }: { u: any }) => {
    const suspended = u.status === "suspended";
    return (
      <View style={[styles.statusPill, { backgroundColor: (suspended ? colors.error : colors.success) + "1F" }]}>
        <View style={[styles.statusDot, { backgroundColor: suspended ? colors.error : colors.success }]} />
        <Text style={[styles.statusText, { color: suspended ? colors.error : colors.success }]}>{suspended ? "Sospeso" : "Attivo"}</Text>
      </View>
    );
  };

  return (
    <AdminShell title="Gestione Utenti" activeKey="users">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>

          {/* Toolbar */}
          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={ADMIN.muted} />
              <TextInput testID="user-search" value={search} onChangeText={setSearch} placeholder="Cerca nome o email..." placeholderTextColor={ADMIN.muted} style={styles.searchInput} />
            </View>
            <PressableScale testID="invite-open" onPress={() => { setInviteOpen(true); setInvMsg(""); }} style={styles.inviteBtn}>
              <Ionicons name="mail-open-outline" size={18} color={colors.white} />
              <Text style={styles.inviteBtnText}>Invita</Text>
            </PressableScale>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }} contentContainerStyle={{ gap: 6, alignItems: "center" }}>
            {ROLE_FILTERS.map((f) => (
              <Pressable key={f.key} testID={`filter-role-${f.key || "all"}`} onPress={() => setRoleFilter(f.key)} style={[styles.chip, roleFilter === f.key && styles.chipActive]}>
                <Text style={[styles.chipText, roleFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
            <View style={styles.sep} />
            {STATUS_FILTERS.map((f) => (
              <Pressable key={f.key} testID={`filter-status-${f.key || "all"}`} onPress={() => setStatusFilter(f.key)} style={[styles.chip, statusFilter === f.key && styles.chipActive]}>
                <Text style={[styles.chipText, statusFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
            <View style={styles.sep} />
            {SORTS.map((f) => (
              <Pressable key={f.key} testID={`sort-${f.key}`} onPress={() => setSort(f.key)} style={[styles.chip, sort === f.key && styles.chipActive]}>
                <Ionicons name="swap-vertical" size={13} color={sort === f.key ? colors.white : ADMIN.muted} />
                <Text style={[styles.chipText, sort === f.key && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.count}>{items.length} utenti</Text>

          {/* Table header (wide) */}
          {wide && (
            <View style={styles.tHead}>
              <Text style={[styles.th, { flex: 2.4 }]}>Utente</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>Ruolo</Text>
              <Text style={[styles.th, { flex: 1 }]}>Stato</Text>
              <Text style={[styles.th, { flex: 1.3 }]}>Ultimo accesso</Text>
              <Text style={[styles.th, { flex: 1 }]}>Registrato</Text>
              <Text style={[styles.th, { width: 44, textAlign: "right" }]}> </Text>
            </View>
          )}

          {items.map((u) => (
            wide ? (
              <View key={u.user_id} testID={`user-row-${u.user_id}`} style={styles.tRow}>
                <View style={[styles.tCell, { flex: 2.4, flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
                  <Avatar u={u} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{u.name || "Senza nome"}</Text>
                    <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
                  </View>
                </View>
                <View style={[styles.tCell, { flex: 1.2 }]}><RoleBadge u={u} /></View>
                <View style={[styles.tCell, { flex: 1 }]}><StatusBadge u={u} /></View>
                <Text style={[styles.tCell, styles.cellText, { flex: 1.3 }]}>{fmtDateTime(u.last_login)}</Text>
                <Text style={[styles.tCell, styles.cellText, { flex: 1 }]}>{fmtDate(u.created_at)}</Text>
                <View style={[styles.tCell, { width: 44, alignItems: "flex-end" }]}>
                  {!u.is_admin && (
                    <Pressable testID={`user-actions-${u.user_id}`} onPress={() => setActionUser(u)} hitSlop={8} style={styles.kebab}>
                      <Ionicons name="ellipsis-vertical" size={18} color={ADMIN.muted} />
                    </Pressable>
                  )}
                </View>
              </View>
            ) : (
              <View key={u.user_id} testID={`user-row-${u.user_id}`} style={styles.card}>
                <Avatar u={u} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{u.name || "Senza nome"}</Text>
                  <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
                  <View style={styles.cardTags}>
                    <RoleBadge u={u} />
                    <StatusBadge u={u} />
                  </View>
                  <Text style={styles.metaLine}>Ultimo accesso: {fmtDateTime(u.last_login)}</Text>
                  <Text style={styles.metaLine}>Registrato: {fmtDate(u.created_at)}</Text>
                </View>
                {!u.is_admin && (
                  <Pressable testID={`user-actions-${u.user_id}`} onPress={() => setActionUser(u)} hitSlop={8} style={styles.kebab}>
                    <Ionicons name="ellipsis-vertical" size={20} color={ADMIN.muted} />
                  </Pressable>
                )}
              </View>
            )
          ))}
          {items.length === 0 && <Text style={styles.empty}>Nessun utente trovato.</Text>}
        </ScrollView>
      )}

      {/* Action sheet */}
      <Modal visible={!!actionUser} transparent animationType="fade" onRequestClose={() => setActionUser(null)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setActionUser(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>{actionUser?.name || actionUser?.email}</Text>
            {actionUser?.role !== "collaborator" ? (
              <SheetItem testID="act-promote" icon="arrow-up-circle-outline" label="Promuovi a Collaboratore" onPress={() => openManage(actionUser)} />
            ) : (
              <>
                <SheetItem testID="act-perms" icon="options-outline" label="Gestisci permessi" onPress={() => openManage(actionUser)} />
                <SheetItem testID="act-demote" icon="arrow-down-circle-outline" label="Riporta ad Ascoltatore" onPress={() => quickRole(actionUser, "listener")} />
              </>
            )}
            {actionUser?.status === "suspended" ? (
              <SheetItem testID="act-reactivate" icon="checkmark-circle-outline" label="Riattiva account" color={colors.success} onPress={() => setStatus(actionUser, "active")} />
            ) : (
              <SheetItem testID="act-suspend" icon="pause-circle-outline" label="Sospendi account" color={colors.warning} onPress={() => setStatus(actionUser, "suspended")} />
            )}
            <SheetItem testID="act-delete" icon="trash-outline" label="Elimina utente" color={colors.error} onPress={() => confirmDelete(actionUser)} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Permissions modal */}
      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>Permessi · {editing?.name || editing?.email}</Text>
              <Pressable testID="perms-close" onPress={() => setEditing(null)} hitSlop={10}><Ionicons name="close" size={22} color={ADMIN.muted} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: spacing.lg }}>
              <Text style={styles.modalHint}>L'utente diventerà Collaboratore e potrà gestire solo le sezioni attive.</Text>
              {SECTIONS.map((s) => {
                const on = selPerms.includes(s.key);
                return (
                  <View key={s.key} style={styles.permRow}>
                    <Text style={styles.permRowLabel}>{s.label}</Text>
                    <Switch testID={`perm-${s.key}`} value={on} onValueChange={() => togglePerm(s.key)} trackColor={{ true: colors.brandPrimary, false: ADMIN.border }} thumbColor={colors.white} />
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.modalFooter}>
              <PressableScale testID="perms-save" onPress={saveRole} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Salva Collaboratore</Text>}
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite modal */}
      <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invita un collaboratore</Text>
              <Pressable testID="invite-close" onPress={() => setInviteOpen(false)} hitSlop={10}><Ionicons name="close" size={22} color={ADMIN.muted} /></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: spacing.lg }}>
              <TextInput testID="invite-email" value={invEmail} onChangeText={setInvEmail} placeholder="email@esempio.it" placeholderTextColor={ADMIN.muted} autoCapitalize="none" keyboardType="email-address" style={styles.invInput} />
              <View style={styles.roleRow}>
                {[{ k: "collaborator", l: "Collaboratore" }, { k: "listener", l: "Ascoltatore" }].map((r) => (
                  <PressableScale key={r.k} testID={`inv-role-${r.k}`} onPress={() => setInvRole(r.k)} style={[styles.roleChip, invRole === r.k && styles.roleChipActive]}>
                    <Text style={[styles.roleChipText, invRole === r.k && styles.roleChipTextActive]}>{r.l}</Text>
                  </PressableScale>
                ))}
              </View>
              {invRole === "collaborator" && (
                <>
                  <Text style={[styles.modalHint, { marginTop: spacing.md }]}>Permessi assegnati all'accettazione</Text>
                  {SECTIONS.map((s) => (
                    <View key={s.key} style={styles.permRow}>
                      <Text style={styles.permRowLabel}>{s.label}</Text>
                      <Switch testID={`inv-perm-${s.key}`} value={invPerms.includes(s.key)} onValueChange={() => toggleInvPerm(s.key)} trackColor={{ true: colors.brandPrimary, false: ADMIN.border }} thumbColor={colors.white} />
                    </View>
                  ))}
                </>
              )}
              {invMsg ? <Text style={styles.invMsg}>{invMsg}</Text> : null}

              <PressableScale testID="invite-send" onPress={sendInvite} disabled={invBusy} style={[styles.saveBtn, { marginTop: spacing.md }, invBusy && { opacity: 0.6 }]}>
                {invBusy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Invia invito</Text>}
              </PressableScale>

              {invites.length > 0 && (
                <View style={{ marginTop: spacing.xl }}>
                  <Text style={styles.pendingTitle}>Inviti in attesa ({invites.length})</Text>
                  {invites.map((iv) => (
                    <View key={iv.id} style={styles.inviteItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inviteEmail} numberOfLines={1}>{iv.email}</Text>
                        <Text style={styles.inviteMeta}>{iv.role === "collaborator" ? "Collaboratore" : "Ascoltatore"} · da {iv.invited_by}</Text>
                      </View>
                      <Pressable testID={`invite-copy-${iv.id}`} onPress={() => copyLink(iv.accept_url)} hitSlop={8} style={styles.iconBtn}><Ionicons name="copy-outline" size={18} color={colors.brandPrimary} /></Pressable>
                      <Pressable testID={`invite-revoke-${iv.id}`} onPress={() => revokeInvite(iv.id)} hitSlop={8} style={styles.iconBtn}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

function SheetItem({ icon, label, onPress, color, testID }: { icon: any; label: string; onPress: () => void; color?: string; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.sheetItem}>
      <Ionicons name={icon} size={20} color={color || colors.white} />
      <Text style={[styles.sheetItemText, color ? { color } : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toolbar: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: ADMIN.card, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 46, borderWidth: 1, borderColor: ADMIN.border },
  searchInput: { flex: 1, color: colors.white, fontSize: 15 },
  inviteBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, height: 46, borderRadius: radius.md },
  inviteBtnText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: ADMIN.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  sep: { width: 1, height: 22, backgroundColor: ADMIN.border, marginHorizontal: 4 },
  count: { color: ADMIN.muted, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm },
  tHead: { flexDirection: "row", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  th: { color: ADMIN.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  tRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  tCell: { justifyContent: "center", paddingRight: spacing.sm },
  cellText: { color: ADMIN.muted, fontSize: 13 },
  card: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  cardTags: { flexDirection: "row", gap: 6, marginTop: 6, marginBottom: 4, flexWrap: "wrap" },
  metaLine: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  avatarEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary + "22" },
  avatarText: { color: colors.brandPrimary, fontSize: 18, fontWeight: "800" },
  name: { color: colors.white, fontSize: 15, fontWeight: "800" },
  email: { color: ADMIN.muted, fontSize: 13, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, alignSelf: "flex-start" },
  badgeText: { fontSize: 10, fontWeight: "800" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: "flex-start" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "800" },
  kebab: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  empty: { color: ADMIN.muted, fontSize: 14, textAlign: "center", marginTop: spacing.xl },
  // sheet
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: ADMIN.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing["2xl"], borderTopWidth: 1, borderColor: ADMIN.border },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: ADMIN.border, alignSelf: "center", marginBottom: spacing.md },
  sheetTitle: { color: colors.white, fontSize: 16, fontWeight: "800", marginBottom: spacing.sm },
  sheetItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  sheetItemText: { color: colors.white, fontSize: 15, fontWeight: "600" },
  // modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: 460, backgroundColor: ADMIN.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: ADMIN.border, overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  modalTitle: { flex: 1, color: colors.white, fontSize: 16, fontWeight: "800", marginRight: spacing.md },
  modalHint: { color: ADMIN.muted, fontSize: 12, marginBottom: spacing.md },
  permRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  permRowLabel: { color: colors.white, fontSize: 15, fontWeight: "600" },
  modalFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: ADMIN.border },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center" },
  saveText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  invInput: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.white, borderWidth: 1, borderColor: ADMIN.border, marginBottom: spacing.md },
  roleRow: { flexDirection: "row", gap: spacing.sm },
  roleChip: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  roleChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  roleChipText: { color: ADMIN.muted, fontSize: 14, fontWeight: "800" },
  roleChipTextActive: { color: colors.white },
  invMsg: { color: colors.brandSecondary, fontSize: 13, marginTop: spacing.md, lineHeight: 18 },
  pendingTitle: { color: colors.white, fontSize: 14, fontWeight: "800", marginBottom: spacing.sm },
  inviteItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: ADMIN.border },
  inviteEmail: { color: colors.white, fontSize: 14, fontWeight: "700" },
  inviteMeta: { color: ADMIN.muted, fontSize: 12, marginTop: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: ADMIN.surface },
});

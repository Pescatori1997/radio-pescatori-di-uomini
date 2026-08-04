import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, RefreshControl, Switch, Pressable } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { confirmAsync, alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

const WOOD_OPTS = [
  { key: "walnut", label: "Noce" },
  { key: "oak", label: "Rovere" },
  { key: "mahogany", label: "Mogano" },
  { key: "ebony", label: "Ebano" },
];

const TIER_COLORS: Record<string, string> = { bronze: "#CD7F32", silver: "#AEB6C2", gold: "#E0B23C" };
const TIER_LABEL: Record<string, string> = { bronze: "Bronzo", silver: "Argento", gold: "Oro" };

export default function AdminAchievements() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [board, setBoard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingBoard, setSavingBoard] = useState(false);
  const [showBoard, setShowBoard] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.adminAchievements(), api.adminWalkBoard()])
      .then(([a, b]: any) => { setItems(a); setBoard(b); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveBoard = async () => {
    setSavingBoard(true);
    try {
      await api.adminEditWalkBoard(board);
      alertMessage("Salvato", "Impostazioni della bacheca aggiornate.");
    } catch { alertMessage("Errore", "Impossibile salvare le impostazioni."); }
    finally { setSavingBoard(false); }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    try { await api.adminAchievementsOrder(next.map((x) => x.id)); } catch {}
  };

  const duplicate = async (a: any) => {
    try {
      const body = { category: a.category, tier: a.tier, title: `${a.title} (copia)`, description: a.description, metric: a.metric, threshold: a.threshold, back_label: a.back_label, emoji: a.emoji, image: a.image, active: false };
      await api.adminCreateAchievement(body);
      load();
    } catch { alertMessage("Errore", "Impossibile duplicare."); }
  };

  const toggleActive = async (a: any) => {
    setItems((list) => list.map((x) => x.id === a.id ? { ...x, active: !x.active } : x));
    try { await api.adminEditAchievement(a.id, { active: !a.active }); } catch { load(); }
  };

  const remove = async (a: any) => {
    const ok = await confirmAsync("Elimina traguardo", `Vuoi eliminare "${a.title}"? Lo storico degli utenti verrà rimosso.`, "Elimina", true);
    if (!ok) return;
    try { await api.adminDeleteAchievement(a.id); load(); } catch { alertMessage("Errore", "Impossibile eliminare."); }
  };

  const setB = (k: string, v: any) => setBoard((b: any) => ({ ...b, [k]: v }));

  return (
    <AdminShell title="Traguardi del Cammino" activeKey="achievements">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>

          {/* Board settings */}
          <Pressable style={styles.boardHeader} onPress={() => setShowBoard((s) => !s)}>
            <MaterialCommunityIcons name="wardrobe" size={20} color={colors.brandSecondary} />
            <Text style={styles.boardHeaderText}>Impostazioni della Bacheca</Text>
            <Ionicons name={showBoard ? "chevron-up" : "chevron-down"} size={20} color={ADMIN.muted} />
          </Pressable>
          {showBoard && board && (
            <View style={styles.boardBox}>
              <Field label="Titolo" value={board.title} onChangeText={(t) => setB("title", t)} />
              <Field label="Principio riga 1" value={board.principle_line1} onChangeText={(t) => setB("principle_line1", t)} />
              <Field label="Principio riga 2" value={board.principle_line2} onChangeText={(t) => setB("principle_line2", t)} />
              <Field label="Testo introduttivo" value={board.intro_text} onChangeText={(t) => setB("intro_text", t)} multiline />
              <Field label="Testo slot vuoti" value={board.continue_text} onChangeText={(t) => setB("continue_text", t)} />
              <Text style={styles.fieldLabel}>Legno</Text>
              <View style={styles.woodRow}>
                {WOOD_OPTS.map((w) => (
                  <PressableScale key={w.key} style={[styles.woodChip, board.wood === w.key && styles.woodChipActive]} onPress={() => setB("wood", w.key)}>
                    <Text style={[styles.woodChipText, board.wood === w.key && styles.woodChipTextActive]}>{w.label}</Text>
                  </PressableScale>
                ))}
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Animazione ante</Text>
                <Switch value={board.animation_enabled !== false} onValueChange={(v) => setB("animation_enabled", v)} trackColor={{ true: colors.brandPrimary, false: "#475569" }} thumbColor={colors.white} />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Bacheca attiva</Text>
                <Switch value={board.enabled !== false} onValueChange={(v) => setB("enabled", v)} trackColor={{ true: colors.brandPrimary, false: "#475569" }} thumbColor={colors.white} />
              </View>
              <PressableScale testID="board-save" style={styles.saveBtn} onPress={saveBoard} disabled={savingBoard}>
                {savingBoard ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Salva impostazioni</Text>}
              </PressableScale>
            </View>
          )}

          {/* Medals list */}
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Medaglie ({items.length})</Text>
            <PressableScale testID="ach-create" style={styles.createBtn} onPress={() => router.push("/admin/achievements/new")}>
              <Ionicons name="add" size={20} color={colors.white} />
              <Text style={styles.createBtnText}>Nuova</Text>
            </PressableScale>
          </View>

          {items.length === 0 ? <Text style={styles.empty}>Nessuna medaglia. Tocca "Nuova" per crearne una.</Text> : items.map((a, idx) => (
            <View key={a.id} style={[styles.row, !a.active && styles.rowInactive]} testID={`ach-row-${a.id}`}>
              <View style={styles.orderCol}>
                <Pressable onPress={() => move(idx, -1)} hitSlop={6}><Ionicons name="chevron-up" size={18} color={idx === 0 ? "#3B4658" : ADMIN.muted} /></Pressable>
                <Pressable onPress={() => move(idx, 1)} hitSlop={6}><Ionicons name="chevron-down" size={18} color={idx === items.length - 1 ? "#3B4658" : ADMIN.muted} /></Pressable>
              </View>
              <Pressable style={styles.rowMain} onPress={() => router.push(`/admin/achievements/${a.id}`)}>
                <View style={[styles.tierDot, { backgroundColor: TIER_COLORS[a.tier] || "#94A3B8" }]}><Text style={styles.tierEmoji}>{a.emoji || "🎖️"}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{a.title}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{a.category} · {TIER_LABEL[a.tier] || a.tier} · {a.metric === "manual" ? "Manuale" : `${a.metric} ≥ ${a.threshold}`}</Text>
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Pressable onPress={() => toggleActive(a)} hitSlop={6}><Ionicons name={a.active ? "eye" : "eye-off"} size={18} color={a.active ? colors.success : ADMIN.muted} /></Pressable>
                <Pressable onPress={() => duplicate(a)} hitSlop={6}><Ionicons name="copy-outline" size={17} color={ADMIN.muted} /></Pressable>
                <Pressable onPress={() => remove(a)} hitSlop={6}><Ionicons name="trash-outline" size={17} color={colors.error} /></Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </AdminShell>
  );
}

function Field({ label, value, onChangeText, multiline }: { label: string; value: string; onChangeText: (t: string) => void; multiline?: boolean }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value || ""} onChangeText={onChangeText} placeholder={label} placeholderTextColor={ADMIN.muted} multiline={multiline} style={[styles.input, multiline && { minHeight: 64, textAlignVertical: "top" }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  boardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  boardHeaderText: { flex: 1, color: colors.white, fontSize: 15, fontWeight: "800" },
  boardBox: { backgroundColor: ADMIN.surface, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.sm, borderWidth: 1, borderColor: ADMIN.border },
  fieldLabel: { color: ADMIN.muted, fontSize: 12.5, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.white, fontSize: 14.5, borderWidth: 1, borderColor: ADMIN.border },
  woodRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  woodChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  woodChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  woodChipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  woodChipTextActive: { color: colors.white },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  toggleLabel: { color: colors.white, fontSize: 14.5, fontWeight: "600" },
  saveBtn: { backgroundColor: colors.brandPrimary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md },
  saveBtnText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl, marginBottom: spacing.md },
  listTitle: { color: colors.white, fontSize: 17, fontWeight: "800" },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  createBtnText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  empty: { color: ADMIN.muted, fontSize: 14, textAlign: "center", marginTop: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  rowInactive: { opacity: 0.55 },
  orderCol: { alignItems: "center", justifyContent: "center" },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  tierDot: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  tierEmoji: { fontSize: 20 },
  name: { color: colors.white, fontSize: 14.5, fontWeight: "800" },
  meta: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingLeft: spacing.sm },
});

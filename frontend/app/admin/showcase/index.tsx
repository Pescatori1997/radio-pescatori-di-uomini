import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Switch } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

function fmt(d?: string) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "2-digit" }); } catch { return d; }
}

export default function AdminShowcaseList() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.adminShowcase().then((d: any[]) => setItems(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const persistOrder = async (list: any[]) => {
    setItems(list);
    setSaving(true);
    try { await api.adminShowcaseOrder(list.map((i) => i.id)); } catch { /* ignore */ } finally { setSaving(false); }
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const copy = items.slice();
    const [it] = copy.splice(idx, 1);
    copy.splice(j, 0, it);
    persistOrder(copy);
  };

  const toggleActive = async (item: any, v: boolean) => {
    setItems((p) => p.map((x) => (x.id === item.id ? { ...x, active: v } : x)));
    try { await api.adminEditShowcase(item.id, { active: v }); } catch { load(); }
  };

  return (
    <AdminShell title="Vetrina" activeKey="showcase">
      <View style={styles.topBar}>
        <Text style={styles.hint}>Contenuti in evidenza nella Home. Trascina l&apos;ordine con le frecce.</Text>
        <PressableScale testID="showcase-create" style={styles.createBtn} onPress={() => router.push("/admin/showcase/new")}>
          <Ionicons name="add" size={22} color={colors.white} />
        </PressableScale>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {saving && <Text style={styles.saving}>Salvataggio ordine…</Text>}
          {items.length === 0 ? <Text style={styles.empty}>Nessuna card. Tocca + per crearne una.</Text> : items.map((n, idx) => (
            <View key={n.id} testID={`showcase-row-${n.id}`} style={styles.row}>
              <View style={styles.orderCol}>
                <Pressable testID={`showcase-up-${n.id}`} onPress={() => move(idx, -1)} hitSlop={8} style={[styles.arrow, idx === 0 && styles.arrowOff]}>
                  <Ionicons name="chevron-up" size={18} color={idx === 0 ? ADMIN.muted : colors.white} />
                </Pressable>
                <Pressable testID={`showcase-down-${n.id}`} onPress={() => move(idx, 1)} hitSlop={8} style={[styles.arrow, idx === items.length - 1 && styles.arrowOff]}>
                  <Ionicons name="chevron-down" size={18} color={idx === items.length - 1 ? ADMIN.muted : colors.white} />
                </Pressable>
              </View>
              <PressableScale style={styles.main} onPress={() => router.push(`/admin/showcase/${n.id}`)}>
                {n.image ? <Image source={{ uri: n.image }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="sparkles" size={20} color={ADMIN.muted} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={2}>{n.title}</Text>
                  <View style={styles.tagsRow}>
                    {!!n.category && <View style={styles.catBadge}><Text style={styles.catText}>{String(n.category).toUpperCase()}</Text></View>}
                    {(n.start_date || n.end_date) ? <Text style={styles.dates}>{fmt(n.start_date) || "…"} → {fmt(n.end_date) || "∞"}</Text> : null}
                  </View>
                </View>
              </PressableScale>
              <View style={styles.actions}>
                <Switch testID={`showcase-active-${n.id}`} value={!!n.active} onValueChange={(v) => toggleActive(n, v)} trackColor={{ true: colors.brandPrimary }} />
                <Ionicons name="chevron-forward" size={18} color={ADMIN.muted} />
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  hint: { flex: 1, color: ADMIN.muted, fontSize: 13 },
  createBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  saving: { color: colors.brandSecondary, fontSize: 12, marginBottom: spacing.sm },
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: spacing["2xl"], fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  orderCol: { alignItems: "center", justifyContent: "center", gap: 2 },
  arrow: { width: 30, height: 26, borderRadius: 8, backgroundColor: ADMIN.surface, alignItems: "center", justifyContent: "center" },
  arrowOff: { opacity: 0.4 },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 64, height: 56, borderRadius: radius.md, backgroundColor: ADMIN.surface },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  name: { color: colors.white, fontSize: 15, fontWeight: "800" },
  tagsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  catBadge: { backgroundColor: colors.brandPrimary + "22", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  catText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800" },
  dates: { color: ADMIN.muted, fontSize: 12 },
  actions: { alignItems: "center", gap: 4 },
});

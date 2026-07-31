import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import { colors, spacing, radius } from "@/src/theme";

const ICONS: Record<string, string> = {
  agenda_invite: "calendar", agenda_update: "create", agenda_delete: "trash",
  agenda_rsvp: "checkmark-done", agenda_task: "list", agenda_comment: "chatbubble-ellipses",
};

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "ora";
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export default function InboxScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.inboxList(50, 0);
      setItems(data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = async (n: any) => {
    if (!n.read) { api.inboxRead(n.id).catch(() => {}); setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x)); }
    if (n.route) router.push(n.route as any);
  };

  const markAll = async () => {
    await api.inboxReadAll().catch(() => {});
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
  };

  return (
    <AdminShell title="Notifiche" activeKey="inbox">
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.white} />}
      >
        <View style={styles.topRow}>
          <Text style={styles.count}>{items.filter((i) => !i.read).length} non lette</Text>
          <Pressable testID="inbox-read-all" onPress={markAll} style={styles.readAll}>
            <Ionicons name="checkmark-done" size={16} color={colors.brandPrimary} />
            <Text style={styles.readAllText}>Segna tutte come lette</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={40} color={ADMIN.muted} />
            <Text style={styles.emptyText}>Nessuna notifica</Text>
          </View>
        ) : (
          items.map((n) => (
            <Pressable key={n.id} testID={`inbox-item-${n.id}`} onPress={() => open(n)} style={[styles.card, !n.read && styles.cardUnread]}>
              <View style={[styles.iconWrap, !n.read && { backgroundColor: colors.brandPrimary }]}>
                <Ionicons name={(ICONS[n.type] || "notifications") as any} size={18} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{n.title}</Text>
                {!!n.body && <Text style={styles.body} numberOfLines={2}>{n.body}</Text>}
                <Text style={styles.time}>{timeAgo(n.created_at)}{n.actor_name ? ` · ${n.actor_name}` : ""}</Text>
              </View>
              {!n.read && <View style={styles.dot} />}
            </Pressable>
          ))
        )}
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  count: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  readAll: { flexDirection: "row", alignItems: "center", gap: 6 },
  readAllText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: ADMIN.border },
  cardUnread: { borderColor: colors.brandPrimary },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: ADMIN.border, alignItems: "center", justifyContent: "center" },
  title: { color: colors.white, fontSize: 15, fontWeight: "700" },
  body: { color: ADMIN.muted, fontSize: 13, marginTop: 2 },
  time: { color: ADMIN.muted, fontSize: 11, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
  empty: { alignItems: "center", marginTop: 60, gap: 10 },
  emptyText: { color: ADMIN.muted, fontSize: 15 },
});

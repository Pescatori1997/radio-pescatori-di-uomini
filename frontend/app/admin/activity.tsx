import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import { colors, spacing, radius } from "@/src/theme";

const TARGET_ICON: Record<string, string> = {
  utenti: "account-cog", inviti: "email-fast", podcasts: "microphone",
  news: "newspaper-variant", schedule: "calendar-month", merch: "storefront",
};

function iconFor(target: string) {
  return TARGET_ICON[target] || "history";
}
function fmtDay(iso: string) {
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }); } catch { return ""; }
}
function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export default function AdminActivity() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.adminActivity(200).then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // group by day
  const groups: { day: string; entries: any[] }[] = [];
  for (const it of items) {
    const day = fmtDay(it.created_at);
    const g = groups.find((x) => x.day === day);
    if (g) g.entries.push(it); else groups.push({ day, entries: [it] });
  }

  return (
    <AdminShell title="Registro Attività" activeKey="activity">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          <Text style={styles.intro}>Cronologia delle azioni svolte dagli amministratori e collaboratori.</Text>
          {items.length === 0 && <Text style={styles.empty}>Nessuna attività registrata per ora.</Text>}
          {groups.map((g, gi) => (
            <View key={g.day} style={{ marginBottom: spacing.lg }}>
              <Text style={styles.day}>{g.day}</Text>
              {g.entries.map((it, i) => (
                <Animated.View key={it.id} entering={FadeInDown.delay(Math.min((gi * 3 + i) * 30, 300))} style={styles.row} testID={`activity-${it.id}`}>
                  <View style={styles.iconWrap}><Ionicons name="ellipse" size={8} color={colors.brandPrimary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.text}>
                      <Text style={styles.actor}>{it.actor_name}</Text> {it.action}
                    </Text>
                    <Text style={styles.time}>{fmtTime(it.created_at)}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: ADMIN.muted, fontSize: 14, marginBottom: spacing.lg, lineHeight: 20 },
  empty: { color: ADMIN.muted, fontSize: 14, textAlign: "center", marginTop: spacing.xl },
  day: { color: colors.white, fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: ADMIN.border },
  iconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandPrimary + "22", alignItems: "center", justifyContent: "center", marginTop: 2 },
  text: { color: "#E2E8F0", fontSize: 14, lineHeight: 20 },
  actor: { color: colors.white, fontWeight: "800" },
  time: { color: ADMIN.muted, fontSize: 12, marginTop: 3 },
});

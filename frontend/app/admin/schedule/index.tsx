import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

export default function AdminSchedule() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [day, setDay] = useState(DAYS[todayIdx]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.adminPrograms().then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dayPrograms = items.filter((p) => p.day === day).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  return (
    <AdminShell title="Palinsesto" activeKey="schedule">
      <View style={styles.topBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flex: 1 }}>
          {DAYS.map((d) => (
            <Pressable key={d} testID={`sched-day-${d}`} onPress={() => setDay(d)} style={[styles.chip, day === d && styles.chipActive]}>
              <Text style={[styles.chipText, day === d && styles.chipTextActive]}>{d.slice(0, 3)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <PressableScale testID="sched-create" style={styles.createBtn} onPress={() => router.push(`/admin/schedule/new?day=${encodeURIComponent(day)}`)}>
          <Ionicons name="add" size={22} color={colors.white} />
        </PressableScale>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {dayPrograms.length === 0 ? <Text style={styles.empty}>Nessun programma per {day}. Tocca + per aggiungere.</Text> : dayPrograms.map((p) => (
            <PressableScale key={p.id} testID={`sched-row-${p.id}`} style={styles.row} onPress={() => router.push(`/admin/schedule/${p.id}`)}>
              <View style={styles.timeCol}><Text style={styles.time}>{p.time}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                {!!p.host && <Text style={styles.host} numberOfLines={1}>{p.host}</Text>}
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
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.md },
  chips: { gap: spacing.sm, paddingRight: spacing.sm },
  chip: { height: 36, minWidth: 52, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center", flexShrink: 0, borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.navy, fontWeight: "700" },
  createBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: spacing["2xl"], fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  timeCol: { width: 54 },
  time: { color: colors.brandPrimary, fontSize: 15, fontWeight: "800" },
  name: { color: colors.white, fontSize: 15, fontWeight: "800" },
  host: { color: ADMIN.muted, fontSize: 13, marginTop: 2 },
});

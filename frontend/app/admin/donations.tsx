import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import { colors, spacing, radius } from "@/src/theme";

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }); } catch { return ""; }
}

const STAT_CARDS = [
  { key: "total", label: "Totale raccolto", icon: "cash-multiple", color: colors.success, money: true },
  { key: "last_30_days", label: "Ultimi 30 giorni", icon: "calendar-clock", color: colors.brandPrimary, money: true },
  { key: "count", label: "Offerte", icon: "gift", color: "#8B5CF6", money: false },
  { key: "average", label: "Offerta media", icon: "chart-line", color: "#EC4899", money: true },
];

export default function AdminDonations() {
  const [stats, setStats] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.adminDonationStats(), api.adminDonations()])
      .then(([s, list]) => { setStats(s); setItems(list); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <AdminShell title="Donazioni" activeKey="donations">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          <View style={styles.grid}>
            {STAT_CARDS.map((c, i) => (
              <Animated.View key={c.key} entering={FadeInDown.duration(400).delay(i * 60)} style={styles.cardWrap}>
                <View style={styles.card} testID={`don-stat-${c.key}`}>
                  <View style={[styles.iconBox, { backgroundColor: c.color + "22" }]}>
                    <MaterialCommunityIcons name={c.icon as any} size={22} color={c.color} />
                  </View>
                  <Text style={styles.cardValue}>{c.money ? `€${(stats?.[c.key] ?? 0).toFixed(2)}` : (stats?.[c.key] ?? 0)}</Text>
                  <Text style={styles.cardLabel}>{c.label}</Text>
                </View>
              </Animated.View>
            ))}
          </View>

          <Text style={styles.section}>Storico offerte</Text>
          {items.length === 0 && <Text style={styles.empty}>Nessuna donazione registrata al momento.</Text>}
          {items.map((d, i) => (
            <Animated.View key={d.id} entering={FadeInDown.delay(Math.min(i * 30, 300))} style={styles.row} testID={`admin-donation-${d.id}`}>
              <View style={styles.iconWrap}><MaterialCommunityIcons name="gift" size={18} color={colors.success} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.donor}>{d.anonymous ? "Anonimo" : (d.donor_name || d.donor_email || "Donatore")}</Text>
                <Text style={styles.date}>{fmtDate(d.paid_at || d.created_at)}</Text>
                {!!d.message && <Text style={styles.msg} numberOfLines={2}>"{d.message}"</Text>}
              </View>
              <Text style={styles.amount}>€{(d.amount || 0).toFixed(2)}</Text>
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  cardWrap: { width: "47%", flexGrow: 1 },
  card: { backgroundColor: ADMIN.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: ADMIN.border },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  cardValue: { color: colors.white, fontSize: 26, fontWeight: "800" },
  cardLabel: { color: ADMIN.muted, fontSize: 13, marginTop: 2 },
  section: { color: colors.white, fontSize: 17, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.md },
  empty: { color: ADMIN.muted, fontSize: 14, textAlign: "center", marginTop: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: ADMIN.border },
  iconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.success + "22", alignItems: "center", justifyContent: "center" },
  donor: { color: colors.white, fontSize: 15, fontWeight: "700" },
  date: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  msg: { color: "#CBD5E1", fontSize: 13, fontStyle: "italic", marginTop: 4 },
  amount: { color: colors.success, fontSize: 18, fontWeight: "800" },
});

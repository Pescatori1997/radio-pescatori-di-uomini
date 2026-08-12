import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl, Alert, Platform } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }); } catch { return ""; }
}

export default function DonationsHistory() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.myDonations().catch(() => []),
      api.mySubscription().catch(() => null),
    ]).then(([d, s]) => { setItems(d || []); setSub(s?.subscription || null); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = items.reduce((s, d) => s + (d.amount || 0), 0);
  const isMonthly = (d: any) => d.frequency === "monthly";

  const doCancel = async () => {
    setCancelling(true);
    try { const r = await api.cancelSubscription(); setSub(r?.subscription || null); }
    catch (e: any) { Alert.alert("Errore", e?.message || "Impossibile annullare l'abbonamento."); }
    finally { setCancelling(false); }
  };
  const confirmCancel = () => {
    if (Platform.OS === "web") { if (typeof window !== "undefined" && window.confirm("Vuoi disattivare l'abbonamento mensile? Resterà attivo fino alla fine del periodo già pagato.")) doCancel(); return; }
    Alert.alert("Disattiva abbonamento", "L'abbonamento resterà attivo fino alla fine del periodo già pagato, poi non verrà più rinnovato.", [
      { text: "Annulla", style: "cancel" },
      { text: "Disattiva", style: "destructive", onPress: doCancel },
    ]);
  };

  const subActive = sub && (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due");
  const willCancel = sub?.cancel_at_period_end;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="history-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>Le mie offerte</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {items.length > 0 && (
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>Totale donato</Text>
              <Text style={styles.summaryValue}>€{total.toFixed(2)}</Text>
              <Text style={styles.summaryCount}>{items.length} {items.length === 1 ? "offerta" : "offerte"}</Text>
            </View>
          )}

          {subActive && (
            <View style={styles.subCard} testID="subscription-card">
              <View style={styles.subHead}>
                <MaterialCommunityIcons name="autorenew" size={20} color={colors.brandPrimary} />
                <Text style={styles.subTitle}>Abbonamento mensile{sub.plan ? ` · €${sub.plan}` : ""}</Text>
              </View>
              {willCancel ? (
                <Text style={styles.subInfo}>Attivo fino al {fmtDate(sub.current_period_end)}. Non verrà rinnovato.</Text>
              ) : (
                <Text style={styles.subInfo}>Rinnovo automatico{sub.current_period_end ? ` il ${fmtDate(sub.current_period_end)}` : ""}.</Text>
              )}
              {!willCancel && (
                <PressableScale testID="cancel-subscription" style={styles.cancelBtn} onPress={confirmCancel} disabled={cancelling}>
                  {cancelling ? <ActivityIndicator color={colors.error} /> : <><Ionicons name="close-circle-outline" size={18} color={colors.error} /><Text style={styles.cancelText}>Disattiva abbonamento</Text></>}
                </PressableScale>
              )}
            </View>
          )}

          {items.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="gift-outline" size={54} color={colors.muted} />
              <Text style={styles.emptyText}>Non hai ancora effettuato offerte.</Text>
              <PressableScale testID="empty-donate" style={styles.donateBtn} onPress={() => router.push("/donate" as any)}>
                <Ionicons name="heart" size={16} color={colors.white} />
                <Text style={styles.donateText}>Fai un'offerta</Text>
              </PressableScale>
            </View>
          ) : items.map((d, i) => (
            <Animated.View key={d.id} entering={FadeInDown.delay(Math.min(i * 40, 300))} style={styles.row} testID={`donation-${d.id}`}>
              <View style={[styles.iconWrap, isMonthly(d) && { backgroundColor: colors.brandPrimary + "22" }]}>
                <MaterialCommunityIcons name={isMonthly(d) ? "autorenew" : "gift"} size={20} color={isMonthly(d) ? colors.brandPrimary : colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.amount}>€{(d.amount || 0).toFixed(2)}</Text>
                <View style={styles.typeRow}>
                  <View style={[styles.typeBadge, { backgroundColor: (isMonthly(d) ? colors.brandPrimary : colors.success) + "22" }]}>
                    <Text style={[styles.typeText, { color: isMonthly(d) ? colors.brandPrimary : colors.success }]}>{isMonthly(d) ? "Abbonamento mensile" : "Una tantum"}</Text>
                  </View>
                  <Text style={styles.date}>{fmtDate(d.paid_at || d.created_at)}</Text>
                </View>
                {!!d.message && <Text style={styles.msg} numberOfLines={2}>"{d.message}"</Text>}
              </View>
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  summary: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", marginBottom: spacing.lg },
  summaryLabel: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700" },
  summaryValue: { color: colors.white, fontSize: 38, fontWeight: "800", marginVertical: 4 },
  summaryCount: { color: colors.muted, fontSize: 13 },
  empty: { alignItems: "center", paddingTop: spacing["3xl"], gap: spacing.md },
  emptyText: { color: colors.onSurfaceSecondary, fontSize: 15 },
  donateBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.navy, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.sm },
  donateText: { color: colors.white, fontWeight: "800", fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.success + "22", alignItems: "center", justifyContent: "center" },
  amount: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  date: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 2 },
  msg: { color: colors.onSurfaceSecondary, fontSize: 13, fontStyle: "italic", marginTop: 4 },
  typeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4, flexWrap: "wrap" },
  typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  typeText: { fontSize: 11, fontWeight: "800" },
  subCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.brandPrimary + "44" },
  subHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  subTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800", flex: 1 },
  subInfo: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 6 },
  cancelBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.error },
  cancelText: { color: colors.error, fontSize: 14, fontWeight: "800" },
  badge: { backgroundColor: colors.success + "22", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: colors.success, fontSize: 11, fontWeight: "700" },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const CARDS = [
  { key: "pending_applications", label: "Candidature in attesa", icon: "account-clock", color: "#F59E0B", route: "/admin/team" },
  { key: "approved_members", label: "Membri approvati", icon: "anchor", color: colors.brandPrimary, route: "/admin/team" },
  { key: "total_users", label: "Utenti totali", icon: "account-group", color: "#8B5CF6", route: "/admin/users" },
  { key: "prayer_requests", label: "Richieste di preghiera", icon: "hands-pray", color: "#10B981", route: "/admin/prayers" },
  { key: "testimonies", label: "Testimonianze", icon: "message-star", color: "#EC4899", route: "/admin/messages" },
  { key: "messages", label: "Messaggi", icon: "message-text", color: "#F97316", route: "/admin/messages" },
  { key: "programs", label: "Programmi", icon: "calendar-month", color: "#14B8A6", route: "/admin/schedule" },
  { key: "news", label: "Articoli Notizie", icon: "newspaper-variant", color: "#38BDF8", route: "/admin/news" },
  { key: "showcase", label: "Vetrina", icon: "star-circle", color: "#F59E0B", route: "/admin/showcase" },
  { key: "verses", label: "Versetti del Giorno", icon: "book-cross", color: "#F59E0B", route: "/admin/verses" },
  { key: "podcasts", label: "Podcast", icon: "microphone", color: "#EF4444", route: "/admin/podcasts" },
  { key: "meditations", label: "Meditazioni", icon: "book-open-variant", color: "#14B8A6", route: "/admin/meditations" },
  { key: "products", label: "Prodotti", icon: "storefront", color: "#22C55E", route: "/admin/products" },
  { key: "donations", label: "Donazioni", icon: "gift", color: colors.success, route: "/admin/donations" },
  { key: "notifications", label: "Notifiche", icon: "bell-ring", color: "#F59E0B", route: "/admin/notifications" },
  { key: "reports", label: "Segnalazioni", icon: "message-alert", color: "#EF4444", route: "/admin/reports" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.adminStats().then(setStats).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <AdminShell title="Dashboard" activeKey="dash">
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
        >
          <Text style={styles.hello}>Benvenuto nel pannello di controllo</Text>
          <Text style={styles.helloSub}>Panoramica in tempo reale della piattaforma.</Text>
          <View style={styles.grid}>
            {CARDS.map((c, i) => (
              <Animated.View key={c.key} entering={FadeInDown.duration(400).delay(i * 70)} style={styles.cardWrap}>
                <PressableScale testID={`stat-${c.key}`} style={styles.card} onPress={() => router.push(c.route as any)}>
                  <View style={[styles.iconBox, { backgroundColor: c.color + "22" }]}>
                    <MaterialCommunityIcons name={c.icon as any} size={22} color={c.color} />
                  </View>
                  {c.key === "reports" && (stats?.reports_new ?? 0) > 0 && (
                    <View style={styles.newBadge}><Text style={styles.newBadgeText}>{stats.reports_new} nuove</Text></View>
                  )}
                  <Text style={styles.cardValue}>{stats?.[c.key] ?? 0}</Text>
                  <Text style={styles.cardLabel}>{c.label}</Text>
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hello: { color: colors.white, fontSize: 22, fontWeight: "800" },
  helloSub: { color: ADMIN.muted, fontSize: 14, marginTop: 4, marginBottom: spacing.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  cardWrap: { width: "47%", flexGrow: 1 },
  card: { backgroundColor: ADMIN.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: ADMIN.border },
  newBadge: { position: "absolute", top: spacing.md, right: spacing.md, backgroundColor: "#EF4444", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  newBadgeText: { color: colors.white, fontSize: 10, fontWeight: "800" },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  cardValue: { color: colors.white, fontSize: 30, fontWeight: "800" },
  cardLabel: { color: ADMIN.muted, fontSize: 13, marginTop: 2 },
});

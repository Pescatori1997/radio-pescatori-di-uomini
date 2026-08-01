import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import MiniLineChart from "@/src/components/analytics/MiniLineChart";
import { colors, spacing, radius } from "@/src/theme";

const RANGES = [
  { key: "7", label: "7 giorni" },
  { key: "30", label: "30 giorni" },
  { key: "90", label: "90 giorni" },
  { key: "all", label: "Tutto" },
];

function StatCard({ icon, color, value, label, sub }: any) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: color + "22" }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
      {sub != null && <Text style={styles.cardSub}>{sub}</Text>}
    </View>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function AdminStatistiche() {
  const [range, setRange] = useState("30");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((r: string) => {
    api.adminAnalytics(r).then(setData).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(range); }, [load, range]));

  const u = data?.users || {};
  const radio = data?.radio || {};
  const content = data?.content || {};
  const community = data?.community || {};
  const growth = u.growth_30_pct;

  return (
    <AdminShell title="Statistiche" activeKey="stats">
      {loading && !data ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(range); }} tintColor={colors.brandPrimary} />}
        >
          <Text style={styles.hello}>Statistiche della piattaforma</Text>
          <Text style={styles.helloSub}>Dati reali raccolti dall'attività degli utenti.</Text>

          {/* time range filter */}
          <View style={styles.filterRow}>
            {RANGES.map((r) => (
              <Pressable key={r.key} testID={`range-${r.key}`} onPress={() => { setRange(r.key); setLoading(true); load(r.key); }}
                style={[styles.chip, range === r.key && styles.chipActive]}>
                <Text style={[styles.chipText, range === r.key && styles.chipTextActive]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* USERS */}
          <Section title="👥 Utenti">
            <View style={styles.grid}>
              <StatCard icon="account-group" color="#8B5CF6" value={u.total ?? 0} label="Utenti registrati" />
              <StatCard icon="circle-slice-8" color="#10B981" value={u.online_now ?? 0} label="Online adesso" sub="ultimi 5 min" />
              <StatCard icon="account-plus" color="#0EA5E9" value={u.new_today ?? 0} label="Nuovi oggi" />
              <StatCard icon="fire" color="#F59E0B" value={u.active_today ?? 0} label="Attivi oggi" />
              <StatCard icon="calendar-week" color="#38BDF8" value={u.new_7 ?? 0} label="Nuovi (7 gg)" />
              <StatCard icon="pulse" color="#EC4899" value={u.active_7 ?? 0} label="Attivi (7 gg)" />
              <StatCard icon="calendar-month" color="#14B8A6" value={u.new_30 ?? 0} label="Nuovi (30 gg)"
                sub={growth != null ? `${growth > 0 ? "+" : ""}${growth}% vs prec.` : undefined} />
              <StatCard icon="chart-line" color="#22C55E" value={u.active_30 ?? 0} label="Attivi (30 gg)" />
            </View>
          </Section>

          {/* CHARTS */}
          <Section title="📈 Andamento">
            <MiniLineChart label="Nuove registrazioni" color="#0EA5E9" data={data?.registrations_series || []} />
            <View style={{ height: spacing.md }} />
            <MiniLineChart label="Utenti attivi al giorno" color="#22C55E" data={data?.active_series || []}
              empty="Il tracking degli attivi parte da ora" />
          </Section>

          {/* RADIO */}
          <Section title="📻 Radio">
            <View style={styles.grid}>
              <StatCard icon="headphones" color="#EF4444" value={radio.current ?? 0} label="In ascolto ora" sub="utenti registrati" />
              <StatCard icon="access-point" color="#F59E0B" value={radio.stream_listeners ?? "—"} label="Stream (AzuraCast)" />
              <StatCard icon="account-clock" color="#0EA5E9" value={radio.unique_today ?? 0} label="Ascoltatori unici oggi" />
              <StatCard icon="account-multiple" color="#8B5CF6" value={radio.unique_range ?? 0} label="Unici nel periodo" />
              <StatCard icon="chart-bell-curve" color="#EC4899" value={radio.peak_concurrent ?? 0} label="Picco contemporanei" />
              <StatCard icon="timer-sand" color="#14B8A6" value={`${radio.avg_minutes ?? 0}m`} label="Durata media" />
              <StatCard icon="clock-outline" color="#22C55E" value={`${radio.total_hours ?? 0}h`} label="Ore totali ascolto" />
              <StatCard icon="radio" color="#38BDF8" value={radio.sessions ?? 0} label="Sessioni" />
            </View>
          </Section>

          {/* CONTENT */}
          <Section title="📖 Contenuti">
            <View style={styles.grid}>
              <StatCard icon="book-open-variant" color="#14B8A6" value={content?.meditations?.views ?? 0} label="Viste Meditazioni" sub={`${content?.meditations?.unique_users ?? 0} utenti unici`} />
              <StatCard icon="microphone" color="#EF4444" value={content?.podcasts?.plays ?? 0} label="Riproduzioni Predicazioni" sub={`${content?.podcasts?.unique_users ?? 0} ascoltatori unici`} />
            </View>
            <TopList title="Meditazioni più viste" items={content?.meditations?.top} unit="viste" />
            <TopList title="Predicazioni più ascoltate" items={content?.podcasts?.top} unit="ascolti" />
          </Section>

          {/* COMMUNITY */}
          <Section title="🙏 Community">
            <View style={styles.grid}>
              <StatCard icon="hands-pray" color="#10B981" value={community.prayer_requests ?? 0} label="Richieste di preghiera" />
              <StatCard icon="hand-heart" color="#EC4899" value={community.amen_total ?? 0} label="Amen totali" />
              <StatCard icon="message-star" color="#F59E0B" value={community.testimonies ?? 0} label="Testimonianze" />
              <StatCard icon="message-text" color="#38BDF8" value={community.messages ?? 0} label="Messaggi" />
            </View>
          </Section>
        </ScrollView>
      )}
    </AdminShell>
  );
}

function TopList({ title, items, unit }: { title: string; items?: any[]; unit: string }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.topWrap}>
      <Text style={styles.topTitle}>{title}</Text>
      {items.map((it, i) => (
        <Animated.View key={it.id} entering={FadeInDown.duration(300).delay(i * 60)} style={styles.topRow}>
          <Text style={styles.topRank}>{i + 1}</Text>
          <Text style={styles.topName} numberOfLines={1}>{it.title}</Text>
          <Text style={styles.topCount}>{it.count} {unit}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hello: { color: colors.white, fontSize: 22, fontWeight: "800" },
  helloSub: { color: ADMIN.muted, fontSize: 14, marginTop: 4 },
  filterRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: ADMIN.border, backgroundColor: ADMIN.card },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  sectionTitle: { color: colors.white, fontSize: 16, fontWeight: "800", marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: { width: "47%", flexGrow: 1, backgroundColor: ADMIN.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: ADMIN.border },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  cardValue: { color: colors.white, fontSize: 26, fontWeight: "800" },
  cardLabel: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  cardSub: { color: colors.brandSecondary, fontSize: 11, fontWeight: "700", marginTop: 2 },
  topWrap: { backgroundColor: ADMIN.card, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border, padding: spacing.md, marginTop: spacing.md },
  topTitle: { color: "#E2E8F0", fontSize: 13, fontWeight: "800", marginBottom: spacing.sm },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 6 },
  topRank: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800", width: 18 },
  topName: { color: "#E2E8F0", fontSize: 13, flex: 1 },
  topCount: { color: ADMIN.muted, fontSize: 12, fontWeight: "700" },
});

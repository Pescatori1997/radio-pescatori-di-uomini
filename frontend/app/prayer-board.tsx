import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { getClientId } from "@/src/utils/clientId";
import { FishingNet, SeaWaves, SunriseGlow } from "@/src/components/marine";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function PrayerBoard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [praying, setPraying] = useState<Record<string, boolean>>({});
  const [w, setW] = useState(0);

  const load = useCallback(async () => {
    const cid = await getClientId();
    api.prayerBoard(cid).then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pray = async (id: string) => {
    setPraying((p) => ({ ...p, [id]: true }));
    // optimistic
    setItems((list) => list.map((it) => it.id === id ? { ...it, prayed: true, praying_count: (it.praying_count || 0) + 1 } : it));
    try {
      const cid = await getClientId();
      const r = await api.prayFor(id, cid);
      setItems((list) => list.map((it) => it.id === id ? { ...it, prayed: true, praying_count: r.praying_count } : it));
    } catch {
      // revert on failure
      setItems((list) => list.map((it) => it.id === id ? { ...it, prayed: false, praying_count: Math.max(0, (it.praying_count || 1) - 1) } : it));
    } finally {
      setPraying((p) => ({ ...p, [id]: false }));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <LinearGradient colors={["#0B2A4A", "#0A1B3A", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {w > 0 && (<><SunriseGlow width={w} height={150} /><FishingNet width={w} height={150} gap={28} opacity={0.06} /><SeaWaves width={w} height={54} /></>)}
        <View style={styles.topBar}>
          <PressableScale testID="board-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
          <Text style={styles.topTitle}>Bacheca di Preghiera</Text>
          <PressableScale testID="board-add" onPress={() => router.push("/prayer")} style={styles.iconBtn}><Ionicons name="add" size={22} color={colors.white} /></PressableScale>
        </View>
        <Text style={styles.heroSub}>❤️ Preghiamo gli uni per gli altri</Text>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {items.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="heart-outline" size={48} color={colors.muted} />
              <Text style={styles.empty}>Ancora nessuna richiesta sulla Bacheca.</Text>
              <PressableScale testID="board-empty-add" style={styles.addBtn} onPress={() => router.push("/prayer")}>
                <Text style={styles.addBtnText}>Condividi una richiesta</Text>
              </PressableScale>
            </View>
          ) : items.map((p, i) => (
            <Animated.View key={p.id} entering={FadeInDown.delay(i * 40)} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.heartBadge}><Ionicons name="heart" size={16} color={colors.white} /></View>
                <Text style={styles.author}>{p.display_name}</Text>
                <Text style={styles.date}>{p.created_at ? new Date(p.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short" }) : ""}</Text>
              </View>
              <Text style={styles.body}>{p.text}</Text>
              <View style={styles.footer}>
                <PressableScale testID={`pray-btn-${p.id}`} disabled={p.prayed || praying[p.id]} onPress={() => pray(p.id)}
                  style={[styles.prayBtn, p.prayed && styles.prayBtnDone]}>
                  <Ionicons name={p.prayed ? "checkmark-circle" : "hand-left"} size={18} color={p.prayed ? colors.white : colors.brandPrimary} />
                  <Text style={[styles.prayText, p.prayed && { color: colors.white }]}>{p.prayed ? "Stai pregando" : "🙏 Sto pregando"}</Text>
                </PressableScale>
                <Text style={styles.count}>{p.praying_count} {p.praying_count === 1 ? "persona prega" : "stanno pregando"}</Text>
              </View>
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, overflow: "hidden" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  topTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  heroSub: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700", marginTop: spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: spacing["2xl"], gap: spacing.md },
  empty: { color: colors.muted, fontSize: 15, textAlign: "center" },
  addBtn: { backgroundColor: colors.navy, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.pill, marginTop: spacing.sm },
  addBtnText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heartBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  author: { flex: 1, color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  date: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  body: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 22, marginTop: spacing.md },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg, gap: spacing.sm },
  prayBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, paddingVertical: 10, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  prayBtnDone: { backgroundColor: colors.brandPrimary },
  prayText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800" },
  count: { color: colors.muted, fontSize: 12.5, fontWeight: "700", flexShrink: 1, textAlign: "right" },
});

import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import PressableScale from "@/src/components/PressableScale";
import BookCover from "@/src/components/plans/BookCover";
import { colors, spacing, radius } from "@/src/theme";

const CAT_ICON = (name: string): any => {
  const n = (name || "").toLowerCase();
  if (n.includes("crescita") || n.includes("spirit")) return "bookmark";
  if (n.includes("vita")) return "heart";
  if (n.includes("temat")) return "pricetags";
  if (n.includes("famigl")) return "people";
  if (n.includes("special")) return "star";
  if (n.includes("promess") || n.includes("speranza")) return "sunny";
  return "library";
};

// A single wooden shelf: a horizontal row of standing books + a wooden plank.
function Shelf({ plans, mineMap, onOpen }: { plans: any[]; mineMap: Map<string, any>; onOpen: (p: any) => void }) {
  return (
    <View style={styles.shelf}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
        {plans.map((p) => {
          const pr = mineMap.get(p.id);
          return (
            <BookCover
              key={p.id}
              testID={`plan-${p.id}`}
              plan={p}
              onPress={() => onOpen(p)}
              enrolled={!!pr}
              percent={pr?.progress?.percent || 0}
              completed={pr?.progress?.status === "completed"}
            />
          );
        })}
      </ScrollView>
      <LinearGradient colors={["#7A5636", "#4A3320", "#291B0F"]} style={styles.plank}>
        <View style={styles.plankLip} />
      </LinearGradient>
    </View>
  );
}

export default function ReadingPlans() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { cat } = useLocalSearchParams<{ cat?: string }>();
  const [plans, setPlans] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mineOnly, setMineOnly] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.readingPlans().catch(() => []),
      user ? api.myReadingPlans().catch(() => []) : Promise.resolve([]),
    ]).then(([all, my]) => { setPlans(all); setMine(my); }).finally(() => setLoading(false));
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mineMap = useMemo(() => new Map(mine.map((m) => [m.id, m])), [mine]);
  const mineIds = useMemo(() => new Set(mine.map((m) => m.id)), [mine]);

  const openPlan = (p: any) => router.push(`/lettore/piano/${p.id}`);

  // Group plans by category, preserving backend order.
  const groups = useMemo(() => {
    let src = plans;
    if (mineOnly) src = plans.filter((p) => mineIds.has(p.id));
    const map = new Map<string, any[]>();
    for (const p of src) {
      const key = p.category && String(p.category).trim() ? String(p.category).trim() : "Altri piani";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [plans, mineOnly, mineIds]);

  // Single-category view ("Vedi tutti").
  if (cat) {
    const list = plans.filter((p) => (p.category || "Altri piani") === cat);
    return (
      <View style={{ flex: 1, backgroundColor: "#070C18" }}>
        <View style={[styles.catHead, { paddingTop: insets.top + 6 }]}>
          <PressableScale onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={22} color={colors.white} /></PressableScale>
          <Text style={styles.catHeadTitle}>{cat}</Text>
          <View style={{ width: 40 }} />
        </View>
        {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
            <View style={styles.grid}>
              {list.map((p) => {
                const pr = mineMap.get(p.id);
                return (
                  <View key={p.id} style={styles.gridCell}>
                    <BookCover testID={`plan-${p.id}`} plan={p} width={150} onPress={() => openPlan(p)} enrolled={!!pr} percent={pr?.progress?.percent || 0} completed={pr?.progress?.status === "completed"} />
                    <Text numberOfLines={2} style={styles.gridTitle}>{p.title}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#070C18" }}>
      <LinearGradient colors={["#0B1A30", "#070C18"]} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <PressableScale onPress={() => router.back()} hitSlop={8} style={styles.backMini}><Ionicons name="chevron-back" size={22} color={colors.white} /></PressableScale>
          <Ionicons name="book" size={26} color="#F6C560" />
          <Text style={styles.title}>Piani Biblici</Text>
          <View style={{ flex: 1 }} />
          <PressableScale testID="my-plans-toggle" onPress={() => setMineOnly((v) => !v)} style={[styles.myBtn, mineOnly && styles.myBtnOn]}>
            <Ionicons name="bookmark" size={14} color={mineOnly ? colors.navy : colors.white} />
            <Text style={[styles.myBtnText, mineOnly && { color: colors.navy }]}>{mineOnly ? "Tutti" : "I miei piani"}</Text>
          </PressableScale>
        </View>
        <Text style={styles.subtitle}>Percorsi di lettura e meditazione per crescere nella Parola ogni giorno.</Text>
      </LinearGradient>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
          {groups.length === 0 && (
            <Text style={styles.empty}>{mineOnly ? "Non hai ancora iniziato nessun piano." : "Nessun piano disponibile al momento."}</Text>
          )}
          {groups.map(([category, list], gi) => (
            <Animated.View key={category} entering={FadeInDown.delay(gi * 60)} style={styles.section}>
              <View style={styles.sectionHead}>
                <Ionicons name={CAT_ICON(category)} size={17} color="#F6C560" />
                <Text style={styles.sectionTitle}>{category}</Text>
                <View style={{ flex: 1 }} />
                {list.length > 4 && (
                  <PressableScale onPress={() => router.push(`/lettore/piani?cat=${encodeURIComponent(category)}`)}>
                    <Text style={styles.seeAll}>Vedi tutti</Text>
                  </PressableScale>
                )}
              </View>
              <Shelf plans={list} mineMap={mineMap} onOpen={openPlan} />
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backMini: { marginRight: 2 },
  title: { color: colors.white, fontSize: 24, fontWeight: "900", marginLeft: 2 },
  subtitle: { color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 18, marginTop: spacing.sm, maxWidth: 320 },
  myBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  myBtnOn: { backgroundColor: "#F6C560", borderColor: "#F6C560" },
  myBtnText: { color: colors.white, fontSize: 12.5, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  empty: { color: colors.muted, fontSize: 14, textAlign: "center", marginTop: spacing.xl },

  section: { marginBottom: spacing.xl },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  seeAll: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "700" },

  shelf: {},
  shelfRow: { paddingHorizontal: spacing.lg, paddingBottom: 2 },
  plank: { height: 20, marginHorizontal: spacing.md, borderRadius: 3, marginTop: -2,
    ...Platform.select({ web: { boxShadow: "0 10px 16px rgba(0,0,0,0.55)" } as any, default: { shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 6 } }) },
  plankLip: { height: 3, backgroundColor: "rgba(255,220,170,0.25)", borderTopLeftRadius: 3, borderTopRightRadius: 3 },

  catHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  catHeadTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.lg },
  gridCell: { width: "47%", alignItems: "center" },
  gridTitle: { color: colors.white, fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 8 },
});

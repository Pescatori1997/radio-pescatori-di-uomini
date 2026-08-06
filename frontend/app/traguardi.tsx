import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { goBackOrHome } from "@/src/utils/nav";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import BachecaDelCammino from "@/src/components/bacheca/BachecaDelCammino";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function Traguardi() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    api.myAchievements()
      .then((d: any) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const title = data?.settings?.title || "Traguardi del Cammino";

  return (
    <View style={{ flex: 1, backgroundColor: "#F4EFE7" }}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
        <LinearGradient colors={["#0B2A4A", "#0A1B3A", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.topBar}>
          <PressableScale testID="traguardi-back" onPress={() => goBackOrHome()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
          <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
          <View style={styles.iconBtn} />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : !user ? (
        <View style={styles.center}>
          <View style={styles.lockIcon}><Ionicons name="ribbon-outline" size={40} color={colors.brandPrimary} /></View>
          <Text style={styles.gateTitle}>La tua Bacheca del Cammino</Text>
          <Text style={styles.gateSub}>Accedi per custodire i tuoi traguardi e continuare il cammino.</Text>
          <Pressable testID="traguardi-login" style={styles.gateBtn} onPress={() => router.push("/login")}>
            <Text style={styles.gateBtnText}>Accedi</Text>
          </Pressable>
        </View>
      ) : data ? (
        <ScrollView contentContainerStyle={{ paddingVertical: spacing.xl, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          <BachecaDelCammino settings={data.settings || {}} achievements={data.achievements || []} />
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Text style={styles.gateSub}>Nessun traguardo disponibile al momento.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: spacing.md, overflow: "hidden" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  topTitle: { flex: 1, textAlign: "center", color: colors.white, fontSize: 18, fontWeight: "800", marginHorizontal: spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  lockIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(14,165,233,0.14)", alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  gateTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800", textAlign: "center" },
  gateSub: { color: colors.onSurfaceTertiary, fontSize: 14.5, lineHeight: 21, textAlign: "center", marginTop: spacing.sm },
  gateBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing["2xl"], paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.xl },
  gateBtnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

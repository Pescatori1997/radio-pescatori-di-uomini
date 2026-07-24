import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { crewPortrait } from "@/src/crewAssets";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function Equipaggio() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [crew, setCrew] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      api.crew().then(setCrew).catch(() => {}).finally(() => setLoading(false));
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="equipaggio-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </PressableScale>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="anchor" size={20} color={colors.brandSecondary} />
          <Text style={styles.headerTitle}>{"L'Equipaggio"}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>Le persone che servono in Pescatori di Uomini. Uomini e donne chiamati ad annunciare il Vangelo.</Text>

          {crew.map((m, i) => (
            <Animated.View key={m.id} entering={FadeInDown.duration(450).delay(i * 90)}>
              <PressableScale testID={`crew-card-${m.id}`} scaleTo={0.98} style={styles.card} onPress={() => router.push(`/equipaggio/${m.id}`)}>
                {m.poster ? (
                  <Image source={crewPortrait(m)} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
                ) : (
                  <>
                    <Image source={crewPortrait(m)} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
                    <LinearGradient colors={["transparent", "rgba(10,17,40,0.35)", "rgba(10,17,40,0.96)"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
                    <View style={styles.cardBody}>
                      <View style={styles.roleTag}>
                        <MaterialCommunityIcons name="anchor" size={12} color={colors.white} />
                        <Text style={styles.roleTagText}>{m.role}</Text>
                      </View>
                      <Text style={styles.name}>{m.name}</Text>
                      <Text style={styles.mission} numberOfLines={2}>{`"${m.mission}"`}</Text>
                    </View>
                  </>
                )}
              </PressableScale>
            </Animated.View>
          ))}

          {/* Join the team */}
          <LinearGradient colors={[colors.brandPrimary, "#0369A1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.joinCard}>
            <MaterialCommunityIcons name="anchor" size={34} color={colors.white} />
            <Text style={styles.joinTitle}>{"Entra nell'Equipaggio"}</Text>
            <Text style={styles.joinSub}>Dio può usare anche te per annunciare il Vangelo.</Text>
            <PressableScale testID="join-crew-button" style={styles.joinBtn} onPress={() => router.push("/join")}>
              <Text style={styles.joinBtnText}>Collabora con noi</Text>
            </PressableScale>
          </LinearGradient>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: spacing.lg },
  card: { width: "100%", aspectRatio: 0.72, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.navyCard, marginBottom: spacing.lg, shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  cardBody: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.xl },
  roleTag: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  roleTagText: { color: colors.white, fontSize: 11, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  name: { color: colors.white, fontSize: 30, fontWeight: "800", marginTop: spacing.sm, letterSpacing: -0.5 },
  mission: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontStyle: "italic", marginTop: 4, lineHeight: 20 },
  viewMore: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.md },
  viewMoreText: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700" },
  joinCard: { borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", marginTop: spacing.sm, shadowColor: colors.brandPrimary, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  joinTitle: { color: colors.white, fontSize: 24, fontWeight: "800", marginTop: spacing.md, textAlign: "center" },
  joinSub: { color: "rgba(255,255,255,0.9)", fontSize: 15, textAlign: "center", marginTop: spacing.sm, lineHeight: 21 },
  joinBtn: { backgroundColor: colors.white, paddingHorizontal: spacing["2xl"], paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.xl },
  joinBtnText: { color: colors.brandPrimary, fontSize: 16, fontWeight: "800" },
});

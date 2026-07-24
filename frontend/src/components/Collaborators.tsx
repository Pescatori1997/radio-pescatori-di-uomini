import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { crewPortrait } from "@/src/crewAssets";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function Collaborators({ title = "L'Equipaggio" }: { title?: string }) {
  const router = useRouter();
  const [team, setTeam] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      api.crew().then(setTeam).catch(() => {});
    }, [])
  );

  if (team.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.xl }} testID="collaborators-section">
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={() => router.push("/equipaggio")} hitSlop={8}><Text style={styles.seeAll}>Vedi tutti</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {team.map((c) => (
          <PressableScale key={c.id} testID={`collaborator-${c.id}`} style={styles.card} onPress={() => router.push(`/equipaggio/${c.id}`)}>
            <Image source={crewPortrait(c)} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
            <LinearGradient colors={["transparent", "rgba(10,17,40,0.95)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.body}>
              <Text numberOfLines={1} style={styles.name}>{c.name}</Text>
              <Text numberOfLines={1} style={styles.role}>{c.role}</Text>
            </View>
          </PressableScale>
        ))}
        <PressableScale testID="crew-join-teaser" style={[styles.card, styles.joinCard]} onPress={() => router.push("/join")}>
          <Ionicons name="boat" size={26} color={colors.brandPrimary} />
          <Text style={styles.joinText}>Entra nell'Equipaggio</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  title: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  seeAll: { color: colors.brandPrimary, fontSize: 13, fontWeight: "600" },
  row: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: 140, height: 190, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.navyCard, shadowColor: colors.navy, shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  body: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md },
  name: { color: colors.white, fontSize: 15, fontWeight: "800" },
  role: { color: colors.brandSecondary, fontSize: 12, fontWeight: "600", marginTop: 2 },
  joinCard: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.md },
  joinText: { color: colors.onBrandTertiary, fontSize: 14, fontWeight: "800", textAlign: "center" },
});

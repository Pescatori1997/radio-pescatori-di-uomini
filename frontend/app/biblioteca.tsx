import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import PressableScale from "@/src/components/PressableScale";
import { LIBRARY_CATEGORIES } from "@/src/utils/sections";
import { colors, spacing, radius } from "@/src/theme";

export default function Biblioteca() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="lib-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.topTitle}>Biblioteca</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Contenuti</Text>
        <Text style={styles.sub}>Podcast, meditazioni, studi biblici, predicazioni e video per nutrire la tua fede.</Text>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {LIBRARY_CATEGORIES.map((c, i) => (
            <Animated.View key={c.key} entering={FadeInDown.delay(Math.min(i * 60, 300))}>
              <PressableScale testID={`lib-cat-${c.key}`} style={styles.card} onPress={() => router.push(c.route as any)}>
                <View style={styles.iconWrap}><MaterialCommunityIcons name={c.icon as any} size={26} color={colors.white} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{c.label}</Text>
                  <Text style={styles.cardDesc}>{c.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  topTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  h1: { fontSize: 30, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: 14, color: colors.onSurfaceSecondary, marginTop: 6, lineHeight: 20 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
  cardDesc: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 3 },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import PressableScale from "@/src/components/PressableScale";
import { LIBRARY_CATEGORIES } from "@/src/utils/sections";
import { useLabel } from "@/src/utils/labels";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

export default function Biblioteca() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useLabel();
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) api.myLibrary().then((d: any) => setGroups(d?.groups || [])).catch(() => setGroups([]));
      else setGroups([]);
    }, [user?.user_id]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="lib-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.topTitle}>Biblioteca</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
        {/* I tuoi preferiti */}
        {user && groups.length > 0 && (
          <View style={styles.favWrap}>
            <View style={styles.favHead}>
              <Ionicons name="heart" size={18} color={colors.brandPrimary} />
              <Text style={styles.favTitle}>{t("favorites_title")}</Text>
            </View>
            {groups.map((g) => (
              <View key={g.key} style={{ marginTop: spacing.md }}>
                <Text style={styles.favGroupTitle}>{t(`cat_${g.key}`, g.label)}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favRow}>
                  {g.items.map((it: any) => (
                    <Pressable key={`${g.key}-${it.id}`} testID={`fav-${g.key}-${it.id}`} style={styles.favCard} onPress={() => router.push(it.route as any)}>
                      {it.image ? (
                        <Image source={{ uri: it.image }} style={styles.favArt} contentFit="cover" />
                      ) : (
                        <View style={[styles.favArt, styles.favArtEmpty]}><Ionicons name="musical-notes" size={22} color={colors.muted} /></View>
                      )}
                      <Text numberOfLines={2} style={styles.favCardTitle}>{it.title}</Text>
                      {!!it.subtitle && <Text numberOfLines={1} style={styles.favCardSub}>{it.subtitle}</Text>}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.h1}>{t("library_title")}</Text>
        <Text style={styles.sub}>Podcast, meditazioni, studi biblici, predicazioni e video per nutrire la tua fede.</Text>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {LIBRARY_CATEGORIES.map((c, i) => (
            <Animated.View key={c.key} entering={FadeInDown.delay(Math.min(i * 60, 300))}>
              <PressableScale testID={`lib-cat-${c.key}`} style={styles.card} onPress={() => router.push(c.route as any)}>
                <View style={styles.iconWrap}><MaterialCommunityIcons name={c.icon as any} size={26} color={colors.white} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{t(`cat_${c.key}`, c.label)}</Text>
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
  favWrap: { marginBottom: spacing.xl },
  favHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  favTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  favGroupTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurfaceSecondary, marginBottom: spacing.sm },
  favRow: { gap: spacing.md, paddingRight: spacing.lg },
  favCard: { width: 120 },
  favArt: { width: 120, height: 120, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  favArtEmpty: { alignItems: "center", justifyContent: "center" },
  favCardTitle: { fontSize: 13, fontWeight: "700", color: colors.onSurface, marginTop: spacing.sm },
  favCardSub: { fontSize: 12, color: colors.onSurfaceTertiary, marginTop: 1 },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import PressableScale from "@/src/components/PressableScale";
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
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user) api.myLibrary().then((d: any) => { setGroups(d?.groups || []); setLoaded(true); }).catch(() => setLoaded(true));
      else { setGroups([]); setLoaded(true); }
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
        <Text style={styles.h1}>{t("library_title")}</Text>
        <Text style={styles.sub}>Qui trovi i contenuti che hai messo tra i preferiti, ordinati per cartella.</Text>

        {!user ? (
          <View style={styles.empty}>
            <Ionicons name="lock-closed-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>Accedi per salvare i tuoi contenuti preferiti nella Biblioteca.</Text>
            <PressableScale testID="lib-login" style={styles.loginBtn} onPress={() => router.push("/auth" as any)}>
              <Text style={styles.loginBtnText}>Accedi</Text>
            </PressableScale>
          </View>
        ) : groups.length === 0 && loaded ? (
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>Non hai ancora preferiti. Tocca il cuore ❤️ su un podcast, una meditazione o un contenuto per salvarlo qui.</Text>
          </View>
        ) : (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {groups.map((g, i) => (
              <Animated.View key={g.folder_id} entering={FadeInDown.delay(Math.min(i * 60, 300))}>
                <PressableScale testID={`lib-folder-${g.folder_id}`} style={styles.card}
                  onPress={() => router.push({ pathname: "/biblioteca/folder/[id]", params: { id: g.folder_id, name: g.label } } as any)}>
                  <View style={styles.iconWrap}><MaterialCommunityIcons name={(g.icon || "folder") as any} size={26} color={colors.white} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{g.label}</Text>
                    <Text style={styles.cardDesc}>{g.items.length} {g.items.length === 1 ? "preferito" : "preferiti"}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        )}
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
  empty: { alignItems: "center", gap: spacing.md, marginTop: 60, paddingHorizontal: spacing.xl },
  emptyText: { color: colors.onSurfaceSecondary, fontSize: 15, textAlign: "center", lineHeight: 22 },
  loginBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.pill },
  loginBtnText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});

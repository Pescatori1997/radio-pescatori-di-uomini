import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

export default function FolderDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(() => {
    api.myLibrary().then((d: any) => {
      const g = (d?.groups || []).find((x: any) => x.folder_id === id);
      setItems(g?.items || []);
    }).catch(() => {});
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const removeFav = async (it: any) => {
    setItems((prev) => prev.filter((x) => x.id !== it.id));
    try {
      if (it.type === "podcast") await api.toggleFavorite(it.id);
      else if (it.type === "programma") await api.toggleFavoriteProgram(it.id);
      else await api.toggleContentFav(it.type, it.id);
    } catch { load(); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="folder-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{name || "Cartella"}</Text>
        <View style={{ width: 24 }} />
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={40} color={colors.muted} />
          <Text style={styles.emptyText}>Nessun preferito in questa cartella.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
          {items.map((it) => (
            <Pressable key={`${it.type}-${it.id}`} testID={`folder-item-${it.id}`} style={styles.row} onPress={() => router.push(it.route as any)}>
              {it.image ? (
                <Image source={{ uri: it.image }} style={styles.art} contentFit="cover" />
              ) : (
                <View style={[styles.art, styles.artEmpty]}><Ionicons name="musical-notes" size={22} color={colors.muted} /></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={2}>{it.title}</Text>
                {!!it.subtitle && <Text style={styles.rowSub} numberOfLines={1}>{it.subtitle}</Text>}
              </View>
              <Pressable testID={`folder-remove-${it.id}`} hitSlop={10} onPress={() => removeFav(it)} style={styles.removeBtn}>
                <Ionicons name="heart" size={22} color={colors.brandPrimary} />
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  topTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800", flex: 1, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  art: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  artEmpty: { alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  rowSub: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  removeBtn: { padding: spacing.xs },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyText: { color: colors.onSurfaceSecondary, fontSize: 15, textAlign: "center" },
});

import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      api.news().then(setItems).catch(() => {}).finally(() => setLoading(false));
    }, [])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.h1}>News</Text>
        <Text style={styles.sub}>Notizie, missioni ed eventi dal mondo cristiano</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable testID={`news-card-${item.id}`} style={styles.card} onPress={() => router.push(`/news/${item.id}`)}>
              <Image source={{ uri: item.image }} style={styles.img} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(10,17,40,0.92)"]} style={styles.scrim} />
              <View style={styles.badge}><Text style={styles.badgeText}>{item.category}</Text></View>
              <View style={styles.textBox}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.excerpt} numberOfLines={2}>{item.excerpt}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  h1: { fontSize: 30, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: 14, color: colors.onSurfaceTertiary, marginTop: spacing.xs },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { height: 220, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.navy },
  img: { ...StyleSheet.absoluteFillObject },
  scrim: { ...StyleSheet.absoluteFillObject },
  badge: { position: "absolute", top: spacing.md, left: spacing.md, backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  textBox: { position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  title: { color: colors.white, fontSize: 19, fontWeight: "800" },
  excerpt: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: spacing.xs },
});

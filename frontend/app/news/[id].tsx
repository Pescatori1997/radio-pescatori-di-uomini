import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { goBackOrHome } from "@/src/utils/nav";
import { colors, spacing, radius } from "@/src/theme";

export default function NewsDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);

  useEffect(() => {
    if (id) api.newsItem(id).then(setItem).catch(() => {});
  }, [id]);

  if (!item) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  }

  const date = new Date(item.date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(10,17,40,0.4)", "rgba(10,17,40,0.9)"]} style={StyleSheet.absoluteFill} />
          <Pressable testID="news-back" onPress={() => goBackOrHome()} style={[styles.backBtn, { top: insets.top + spacing.sm }]} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </Pressable>
          <View style={styles.heroText}>
            <View style={styles.badge}><Text style={styles.badgeText}>{item.category}</Text></View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>{item.author} · {date}{item.reading_time ? ` · ${item.reading_time} min` : ""}</Text>
          </View>
        </View>
        <Text style={styles.body}>{item.body}</Text>
        <Pressable testID="news-share" style={styles.shareBtn} onPress={() => Share.share({ message: `${item.title} — Pescatori di Uomini` })}>
          <Ionicons name="share-social-outline" size={18} color={colors.navy} />
          <Text style={styles.shareText}>Condividi</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  hero: { height: 320, justifyContent: "flex-end" },
  backBtn: { position: "absolute", left: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  heroText: { padding: spacing.xl },
  badge: { backgroundColor: colors.brandPrimary, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  title: { color: colors.white, fontSize: 24, fontWeight: "800", marginTop: spacing.md },
  meta: { color: colors.muted, fontSize: 13, marginTop: spacing.sm },
  body: { padding: spacing.xl, fontSize: 16, lineHeight: 26, color: colors.onSurfaceSecondary },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "center", borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill },
  shareText: { color: colors.navy, fontWeight: "700" },
});

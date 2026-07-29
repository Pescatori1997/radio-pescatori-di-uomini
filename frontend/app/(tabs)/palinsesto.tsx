import React, { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { DAYS, isOnAir, romeNow } from "@/src/utils/onair";
import { colors, spacing, radius } from "@/src/theme";


function Avatars({ presenters, images, color }: { presenters: any[]; images: string[]; color?: string }) {
  const pics = (images && images.length ? images : (presenters || []).map((p) => p.image)).filter(Boolean);
  const accent = color || colors.brandPrimary;
  if (!pics.length) {
    return (
      <View style={[styles.avatar, styles.avatarEmpty, { borderColor: accent }]}>
        <Ionicons name="mic" size={22} color={accent} />
      </View>
    );
  }
  return (
    <View style={styles.avatarStack}>
      {pics.slice(0, 3).map((uri: string, i: number) => (
        <Image key={i} source={{ uri }} style={[styles.avatar, { marginLeft: i === 0 ? 0 : -16, borderColor: colors.surface, zIndex: 10 - i }]} contentFit="cover" />
      ))}
    </View>
  );
}

export default function Palinsesto() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const todayIdx = romeNow().idx;
  const [day, setDay] = useState(DAYS[todayIdx]);

  useFocusEffect(
    useCallback(() => {
      api.programs().then((list: any[]) => setPrograms(list || [])).catch(() => {}).finally(() => setLoading(false));
    }, [])
  );

  const dayPrograms = useMemo(
    () => programs
      .filter((p) => p.active !== false && (p.weekdays || []).includes(day))
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
    [programs, day]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.h1}>Palinsesto</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={styles.chipsScroll}>
          {DAYS.map((d) => (
            <Pressable key={d} testID={`day-chip-${d}`} onPress={() => setDay(d)} style={[styles.chip, day === d && styles.chipActive]}>
              <Text style={[styles.chipText, day === d && styles.chipTextActive]}>{d.slice(0, 3)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 180, maxWidth: isWide ? 720 : undefined, width: "100%", alignSelf: "center" }} showsVerticalScrollIndicator={false}>
          {dayPrograms.length === 0 ? (
            <Text style={styles.empty}>Nessun programma per questo giorno</Text>
          ) : (
            <View style={styles.timeline}>
              {/* continuous vertical line */}
              <View style={styles.spine} />
              {dayPrograms.map((p) => {
                const live = isOnAir(p);
                const accent = p.color || colors.brandPrimary;
                return (
                  <View key={p.id} testID={`program-${p.id}`} style={styles.item}>
                    <View style={styles.timeCol}>
                      <Text style={[styles.time, live && { color: accent }]}>{p.start_time}</Text>
                      <View style={[styles.node, { borderColor: accent }, live && { backgroundColor: accent }]} />
                    </View>
                    <View style={[styles.card, live && [styles.cardLive, { borderColor: accent, backgroundColor: accent + "14" }]]}>
                      <Avatars presenters={p.presenters} images={p.images} color={p.color} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        {live && (
                          <View style={[styles.liveBadge, { backgroundColor: accent }]}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveText}>IN ONDA</Text>
                          </View>
                        )}
                        <Text style={styles.name}>{p.title}</Text>
                        {!!p.host && (
                          <View style={styles.hostRow}>
                            <Ionicons name="mic-outline" size={13} color={accent} />
                            <Text style={styles.host} numberOfLines={1}>{p.host}</Text>
                          </View>
                        )}
                        {!!p.end_time && <Text style={styles.range}>{p.start_time} – {p.end_time}</Text>}
                        {!!p.description && <Text style={styles.desc} numberOfLines={3}>{p.description}</Text>}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const AV = 56;
const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  h1: { fontSize: 30, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.md },
  chipsScroll: { marginHorizontal: -spacing.lg },
  chipsRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: { height: 36, minWidth: 52, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.navy },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.muted, fontSize: 15, textAlign: "center", marginTop: spacing["2xl"] },
  timeline: { position: "relative", paddingLeft: 4 },
  spine: { position: "absolute", left: 30, top: 12, bottom: 12, width: 2, backgroundColor: colors.border, borderRadius: 1 },
  item: { flexDirection: "row", marginBottom: spacing.lg },
  timeCol: { width: 58, alignItems: "center" },
  time: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800" },
  node: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, backgroundColor: colors.surface, marginTop: 6 },
  card: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: "transparent" },
  cardLive: { borderWidth: 2 },
  avatar: { width: AV, height: AV, borderRadius: AV / 2, borderWidth: 2, backgroundColor: colors.navy },
  avatarEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  liveBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginBottom: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  liveText: { color: colors.white, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  name: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  host: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600", flex: 1 },
  range: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: "600" },
  desc: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: spacing.sm, lineHeight: 18 },
});

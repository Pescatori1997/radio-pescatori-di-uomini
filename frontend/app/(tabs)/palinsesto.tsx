import React, { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

export default function Palinsesto() {
  const insets = useSafeAreaInsets();
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [day, setDay] = useState(DAYS[todayIdx]);

  useFocusEffect(
    useCallback(() => {
      api.programs().then(setPrograms).catch(() => {}).finally(() => setLoading(false));
    }, [])
  );

  const dayPrograms = useMemo(
    () => programs.filter((p) => p.day === day).sort((a, b) => a.time.localeCompare(b.time)),
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
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
          {dayPrograms.length === 0 ? (
            <Text style={styles.empty}>Nessun programma per questo giorno</Text>
          ) : (
            dayPrograms.map((p) => (
              <View key={p.id} testID={`program-${p.id}`} style={styles.row}>
                <View style={styles.timeCol}>
                  <Text style={styles.time}>{p.time}</Text>
                </View>
                <View style={styles.line} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <View style={styles.hostRow}>
                    <Ionicons name="mic-outline" size={13} color={colors.brandPrimary} />
                    <Text style={styles.host}>{p.host}</Text>
                  </View>
                  <Text style={styles.desc}>{p.description}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

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
  row: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg },
  timeCol: { width: 48 },
  time: { color: colors.brandPrimary, fontSize: 15, fontWeight: "800" },
  line: { width: 2, backgroundColor: colors.border, borderRadius: 1 },
  name: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  host: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  desc: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: spacing.sm, lineHeight: 18 },
});

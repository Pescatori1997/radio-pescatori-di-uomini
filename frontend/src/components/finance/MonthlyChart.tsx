import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { euro, monthLabel } from "@/src/utils/euro";
import { colors, spacing, radius } from "@/src/theme";

const ADMIN = { card: "#1E293B", border: "#243049", muted: "#94A3B8" };

/** Lightweight monthly income/expense bar chart (no external chart lib). */
export default function MonthlyChart({ data }: { data: { month: string; income: number; expense: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  const H = 130;
  return (
    <View style={styles.wrap}>
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.success }]} /><Text style={styles.legendText}>Entrate</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.error }]} /><Text style={styles.legendText}>Uscite</Text></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chart}>
        {data.map((d) => {
          const ih = Math.round((d.income / max) * H);
          const eh = Math.round((d.expense / max) * H);
          return (
            <View key={d.month} style={styles.col}>
              <View style={[styles.barsRow, { height: H }]}>
                <View style={[styles.bar, { height: Math.max(2, ih), backgroundColor: colors.success }]} />
                <View style={[styles.bar, { height: Math.max(2, eh), backgroundColor: colors.error }]} />
              </View>
              <Text style={styles.label}>{monthLabel(d.month)}</Text>
            </View>
          );
        })}
      </ScrollView>
      <Text style={styles.hint}>Max mese: {euro(max)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  legend: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: ADMIN.muted, fontSize: 12, fontWeight: "700" },
  chart: { alignItems: "flex-end", gap: spacing.md, paddingHorizontal: spacing.xs },
  col: { alignItems: "center", width: 46 },
  barsRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  bar: { width: 14, borderRadius: 4 },
  label: { color: ADMIN.muted, fontSize: 10, fontWeight: "700", marginTop: 6 },
  hint: { color: ADMIN.muted, fontSize: 11, marginTop: spacing.sm, textAlign: "right" },
});

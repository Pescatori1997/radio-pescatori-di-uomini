import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ADMIN } from "@/src/components/AdminShell";
import { colors, spacing, radius } from "@/src/theme";

const WD = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const todayStr = () => { const d = new Date(); return ymd(d.getFullYear(), d.getMonth(), d.getDate()); };

export default function MonthGrid({ year, month, eventsByDate, selected, onSelectDay, onPrev, onNext }: {
  year: number; month: number; eventsByDate: Record<string, any[]>; selected: string;
  onSelectDay: (d: string) => void; onPrev: () => void; onNext: () => void;
}) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const today = todayStr();

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable testID="cal-prev" onPress={onPrev} hitSlop={10} style={styles.navBtn}><Ionicons name="chevron-back" size={20} color={colors.white} /></Pressable>
        <Text style={styles.title}>{MONTHS[month]} {year}</Text>
        <Pressable testID="cal-next" onPress={onNext} hitSlop={10} style={styles.navBtn}><Ionicons name="chevron-forward" size={20} color={colors.white} /></Pressable>
      </View>
      <View style={styles.row}>
        {WD.map((w) => <Text key={w} style={styles.wd}>{w}</Text>)}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={i} style={styles.cell} />;
          const ds = ymd(year, month, d);
          const evs = eventsByDate[ds] || [];
          const isToday = ds === today;
          const isSel = ds === selected;
          return (
            <Pressable key={i} testID={`cal-day-${ds}`} onPress={() => onSelectDay(ds)} style={[styles.cell, isSel && styles.cellSel, isToday && !isSel && styles.cellToday]}>
              <Text style={[styles.day, isSel && styles.dayOn, isToday && !isSel && styles.dayToday]}>{d}</Text>
              <View style={styles.dots}>
                {evs.slice(0, 3).map((e, j) => <View key={j} style={[styles.dot, { backgroundColor: e.color || colors.brandPrimary }]} />)}
                {evs.length > 3 && <Text style={styles.more}>+{evs.length - 3}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: ADMIN.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  navBtn: { padding: 6 },
  title: { color: colors.white, fontSize: 17, fontWeight: "800" },
  row: { flexDirection: "row" },
  wd: { flex: 1, textAlign: "center", color: ADMIN.muted, fontSize: 11, fontWeight: "700", marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "flex-start", paddingTop: 4, borderRadius: radius.sm },
  cellSel: { backgroundColor: colors.brandPrimary },
  cellToday: { backgroundColor: ADMIN.border },
  day: { color: colors.white, fontSize: 13, fontWeight: "600" },
  dayOn: { fontWeight: "800" },
  dayToday: { color: colors.brandSecondary, fontWeight: "800" },
  dots: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 3, flexWrap: "wrap", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  more: { color: ADMIN.muted, fontSize: 8, fontWeight: "700" },
});

export { MONTHS };

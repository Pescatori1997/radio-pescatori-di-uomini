import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { spacing, radius } from "@/src/theme";

const ADMIN = { card: "#1E293B", border: "#243049", muted: "#94A3B8" };

type Point = { date: string; count: number };

/**
 * Lightweight responsive line/area chart (react-native-svg — already a project
 * dependency, no heavy chart library). Renders a series of daily counts with a
 * soft gradient area, matching the admin dark theme.
 */
export default function MiniLineChart({
  data, color = "#0EA5E9", height = 150, label, empty = "Nessun dato ancora",
}: { data: Point[]; color?: string; height?: number; label?: string; empty?: string }) {
  const W = 320;               // logical width (SVG scales to container)
  const H = height;
  const padL = 6, padR = 6, padT = 12, padB = 20;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  if (!data || data.length === 0) {
    return (
      <View style={[styles.wrap, { height }]}>
        {label && <Text style={styles.title}>{label}</Text>}
        <View style={styles.emptyBox}><Text style={styles.emptyText}>{empty}</Text></View>
      </View>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  const x = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const pts = data.map((d, i) => ({ px: x(i), py: y(d.count) }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${pts[pts.length - 1].px.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].px.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const total = data.reduce((s, d) => s + d.count, 0);
  const first = data[0]?.date?.slice(5);
  const last = data[data.length - 1]?.date?.slice(5);

  return (
    <View style={styles.wrap}>
      {label && (
        <View style={styles.header}>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.total}>{total} tot.</Text>
        </View>
      )}
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.32" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        {[0.5, 1].map((f, i) => (
          <Line key={i} x1={padL} y1={padT + innerH * (1 - f)} x2={W - padR} y2={padT + innerH * (1 - f)}
                stroke={ADMIN.border} strokeWidth="1" />
        ))}
        <Path d={areaPath} fill="url(#area)" />
        <Path d={linePath} stroke={color} strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {n <= 31 && pts.map((p, i) => <Circle key={i} cx={p.px} cy={p.py} r="2.4" fill={color} />)}
      </Svg>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{first}</Text>
        <Text style={styles.axisText}>picco {max}</Text>
        <Text style={styles.axisText}>{last}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  title: { color: "#E2E8F0", fontSize: 13, fontWeight: "800" },
  total: { color: ADMIN.muted, fontSize: 12, fontWeight: "700" },
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  axisText: { color: ADMIN.muted, fontSize: 10, fontWeight: "600" },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: ADMIN.muted, fontSize: 12 },
});

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { api } from "@/src/api";
import { colors, spacing } from "@/src/theme";

/**
 * Discreet contextual social proof for a single content item ("326 letture",
 * "215 ascolti"). Real aggregated data only; renders nothing until there's a
 * meaningful count so a brand-new item never shows "0".
 */
export default function ContentSocialProof({
  kind, id, metric = "views",
}: { kind: string; id: string; metric?: "views" | "plays" }) {
  const [stats, setStats] = useState<{ views: number; plays: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (id) api.contentStats(kind, id).then((r: any) => { if (!cancelled) setStats(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [kind, id]);

  const n = metric === "plays" ? stats?.plays : stats?.views;
  if (!n || n <= 0) return null;
  const emoji = metric === "plays" ? "🎧" : "👁";
  const word = metric === "plays" ? (n === 1 ? "ascolto" : "ascolti") : (n === 1 ? "lettura" : "letture");

  return (
    <View style={styles.row}>
      <Text style={styles.text}>{emoji} {n.toLocaleString("it-IT")} {word}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  text: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
});

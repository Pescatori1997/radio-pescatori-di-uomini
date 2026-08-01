import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { api } from "@/src/api";
import { colors, spacing } from "@/src/theme";

/**
 * "🎧 N persone stanno ascoltando con te" — real count of REGISTERED users
 * currently listening (from the radio session tracker). Polls gently while
 * mounted; renders nothing when the count isn't meaningful (never fake data).
 */
export default function LiveListeners({ compact = false }: { compact?: boolean }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () => api.radioListeners()
      .then((r: any) => { if (!cancelled) setCount(r?.listening ?? 0); })
      .catch(() => {});
    tick();
    const iv = setInterval(tick, 20000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (count === null || count <= 0) return null;
  const label = count === 1
    ? "1 persona sta ascoltando con te"
    : `${count} persone stanno ascoltando con te`;

  return (
    <View style={[styles.row, compact && styles.compact]}>
      <Text style={styles.emoji}>🎧</Text>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  compact: { marginTop: 2 },
  emoji: { fontSize: 14 },
  text: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700" },
});

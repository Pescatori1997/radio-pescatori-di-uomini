import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import { colors, spacing } from "@/src/theme";

export default function ComingSoon() {
  const { s } = useLocalSearchParams<{ s: string }>();
  return (
    <AdminShell title={s || "Sezione"} activeKey="">
      <View style={styles.center}>
        <MaterialCommunityIcons name="hammer-wrench" size={48} color={colors.brandPrimary} />
        <Text style={styles.title}>Prossimamente</Text>
        <Text style={styles.sub}>La sezione "{s}" sarà disponibile presto. Al momento è attiva la gestione del Team.</Text>
      </View>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  title: { color: colors.white, fontSize: 22, fontWeight: "800", marginTop: spacing.lg },
  sub: { color: ADMIN.muted, fontSize: 15, textAlign: "center", marginTop: spacing.md, lineHeight: 22 },
});

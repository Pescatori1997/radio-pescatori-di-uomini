import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function CreatePlanChooser() {
  const router = useRouter();
  return (
    <AdminShell title="Nuovo piano" activeKey="plans">
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.intro}>Come vuoi creare il piano di lettura?</Text>

        <PressableScale testID="create-manual" style={styles.card} onPress={() => router.replace("/admin/reading-plans/new")}>
          <View style={[styles.icon, { backgroundColor: "rgba(59,130,246,0.15)" }]}><Ionicons name="create-outline" size={26} color={colors.brandPrimary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>✍️  Crea manualmente</Text>
            <Text style={styles.cardSub}>Inserisci copertina, titolo e ogni giorno a mano (lettura, preghiera, meditazione).</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={ADMIN.muted} />
        </PressableScale>

        <PressableScale testID="create-import" style={styles.card} onPress={() => router.replace("/admin/reading-plans/import")}>
          <View style={[styles.icon, { backgroundColor: "rgba(246,197,96,0.15)" }]}><Ionicons name="cube-outline" size={26} color="#F6C560" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>📦  Importa piano completo</Text>
            <Text style={styles.cardSub}>Carica un file ZIP con piano.json + copertina: l'app crea tutto automaticamente.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={ADMIN.muted} />
        </PressableScale>
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.white, fontSize: 16, fontWeight: "700", marginBottom: spacing.lg },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.white, fontSize: 16, fontWeight: "800" },
  cardSub: { color: ADMIN.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
});

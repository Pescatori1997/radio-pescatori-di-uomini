import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";

export default function Donate() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const amounts = ["5€", "10€", "25€", "50€"];
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[colors.navy, colors.navySoft]} style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
          <Pressable testID="donate-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.white} /></Pressable>
          <View style={styles.heartCircle}><Ionicons name="gift" size={34} color={colors.white} /></View>
          <Text style={styles.title}>Sostieni Pescatori di Uomini</Text>
          <Text style={styles.subtitle}>Un progetto senza scopo di lucro, sostenuto dalle offerte.</Text>
        </LinearGradient>

        <Text style={styles.body}>
          Pescatori di Uomini è un'opera senza fini di lucro. Ogni contenuto, ogni diretta e ogni podcast sono resi possibili grazie alla generosità di chi crede in questa missione. Il tuo sostegno ci permette di continuare ad annunciare il Vangelo e raggiungere sempre più cuori.
        </Text>

        <Text style={styles.sectionTitle}>Scegli un importo</Text>
        <View style={styles.amounts}>
          {amounts.map((a) => (
            <Pressable key={a} testID={`donate-${a}`} style={styles.amountChip}>
              <Text style={styles.amountText}>{a}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable testID="donate-button" style={styles.primaryBtn}>
          <Ionicons name="heart" size={18} color={colors.white} />
          <Text style={styles.primaryText}>Fai un'offerta</Text>
        </Pressable>
        <Text style={styles.note}>I pagamenti online saranno disponibili al lancio di settembre. Per offerte immediate, contattaci.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { padding: spacing.xl, alignItems: "flex-start" },
  heartCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  title: { color: colors.white, fontSize: 24, fontWeight: "800", marginTop: spacing.lg },
  subtitle: { color: colors.brandSecondary, fontSize: 14, marginTop: spacing.sm },
  body: { padding: spacing.xl, fontSize: 16, lineHeight: 26, color: colors.onSurfaceSecondary },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface, paddingHorizontal: spacing.xl },
  amounts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, padding: spacing.xl },
  amountChip: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, borderColor: colors.border },
  amountText: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  primaryBtn: { flexDirection: "row", gap: spacing.sm, marginHorizontal: spacing.xl, backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  note: { padding: spacing.xl, fontSize: 13, color: colors.muted, textAlign: "center", lineHeight: 19 },
});

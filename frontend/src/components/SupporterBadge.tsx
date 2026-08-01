import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius } from "@/src/theme";

/**
 * "Sostenitore" recognition badge for users with an ACTIVE subscription.
 * Marine identity of Pescatori di Uomini (navy → sky gradient medal + check),
 * intentionally discreet — a thank-you for supporting the project, NOT a status
 * of superiority, a level, or a spiritual certification.
 */
export function SupporterMedal({ size = 18 }: { size?: number }) {
  return (
    <LinearGradient
      colors={["#0B2A4A", "#0EA5E9"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.medal, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Ionicons name="checkmark-sharp" size={Math.round(size * 0.62)} color={colors.white} />
    </LinearGradient>
  );
}

/** Full inline tag: medal + "Sostenitore attivo" label. */
export function SupporterTag({ label = "Sostenitore attivo" }: { label?: string }) {
  return (
    <View testID="supporter-tag" style={styles.tag}>
      <SupporterMedal size={16} />
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  medal: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0EA5E9",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(14,165,233,0.12)",
    borderColor: "rgba(14,165,233,0.35)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  tagText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },
});

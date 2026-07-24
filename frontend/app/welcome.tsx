import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { useAuth } from "@/src/context/AuthContext";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const LOGO = require("@/assets/images/logo.png");

type Card = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
  onPress: (nav: ReturnType<typeof useRouter>, guest: () => void) => void;
};

const CARDS: Card[] = [
  {
    key: "login",
    title: "Accedi",
    subtitle: "Hai già un account",
    icon: "log-in-outline",
    colors: ["#1E3A8A", "#0EA5E9"],
    onPress: (nav) => nav.push("/auth?mode=login"),
  },
  {
    key: "register",
    title: "Registrati",
    subtitle: "Crea il tuo account",
    icon: "person-add-outline",
    colors: ["#0EA5E9", "#22D3EE"],
    onPress: (nav) => nav.push("/auth?mode=register"),
  },
  {
    key: "guest",
    title: "Ospite",
    subtitle: "Esplora senza account",
    icon: "eye-outline",
    colors: ["#334155", "#475569"],
    onPress: (_nav, guest) => guest(),
  },
  {
    key: "admin",
    title: "Amministrazione",
    subtitle: "Area riservata al team",
    icon: "shield-checkmark-outline",
    colors: ["#7C3AED", "#A855F7"],
    onPress: (nav) => nav.push("/auth?mode=admin"),
  },
];

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { continueAsGuest } = useAuth();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logoBadge}><Image source={LOGO} style={styles.logoImg} contentFit="contain" /></View>
          <Text style={styles.brand}>Pescatori di Uomini</Text>
          <Text style={styles.tagline}>Radio Evangelica Cristiana</Text>
        </View>

        <Text style={styles.prompt}>Chi sei?</Text>
        <Text style={styles.promptSub}>Scegli come vuoi accedere</Text>

        <View style={styles.grid}>
          {CARDS.map((c, i) => (
            <Animated.View key={c.key} entering={FadeInDown.delay(i * 70).springify().damping(16)} style={styles.cardWrap}>
              <PressableScale testID={`welcome-card-${c.key}`} onPress={() => c.onPress(router, continueAsGuest)} style={styles.cardPress}>
                <LinearGradient colors={c.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
                  <View style={styles.cardIcon}><Ionicons name={c.icon} size={26} color={colors.white} /></View>
                  <View>
                    <Text style={styles.cardTitle}>{c.title}</Text>
                    <Text style={styles.cardSub}>{c.subtitle}</Text>
                  </View>
                </LinearGradient>
              </PressableScale>
            </Animated.View>
          ))}
        </View>

        <Text style={styles.footnote}>Potrai accedere o registrarti in qualsiasi momento dal tuo profilo.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy },
  hero: { alignItems: "center", marginBottom: spacing["2xl"] },
  logoBadge: { width: 88, height: 88, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  logoImg: { width: 70, height: 70 },
  brand: { fontSize: 24, fontWeight: "800", color: colors.white, marginTop: spacing.md },
  tagline: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  prompt: { fontSize: 26, fontWeight: "800", color: colors.white },
  promptSub: { fontSize: 15, color: "rgba(255,255,255,0.6)", marginTop: 4, marginBottom: spacing.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  cardWrap: { width: "48.5%", marginBottom: spacing.md },
  cardPress: { borderRadius: radius.lg },
  card: { height: 150, borderRadius: radius.lg, padding: spacing.lg, justifyContent: "space-between" },
  cardIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 18, fontWeight: "800", color: colors.white },
  cardSub: { fontSize: 12, color: "rgba(255,255,255,0.82)", marginTop: 2 },
  footnote: { textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: spacing.xl, lineHeight: 18 },
});

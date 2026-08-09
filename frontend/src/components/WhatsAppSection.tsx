import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Linking, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import PressableScale from "@/src/components/PressableScale";
import { FishingNet, SeaWaves, Bubbles, Blob } from "@/src/components/marine";
import { colors, spacing, radius } from "@/src/theme";

const WHATSAPP_URL =
  "https://wa.me/393517556255?text=Ciao%20Radio%20Pescatori%20di%20Uomini!%20Vi%20scrivo...";
const WA_GREEN = "#25D366";
const WA_GREEN_DARK = "#1EBE5D";

const FEATURES: { icon: any; label: string }[] = [
  { icon: "book-open-variant", label: "Domande Bibliche" },
  { icon: "hands-pray", label: "Richieste di Preghiera" },
  { icon: "message-star", label: "Testimonianze" },
];

export default function WhatsAppSection() {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.35);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const btnAnim = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    shadowOpacity: glow.value,
  }));

  const open = () => {
    Linking.openURL(WHATSAPP_URL).catch(() => {});
  };

  return (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.wrap}>
      <View style={styles.panel} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {/* Ocean background */}
        <LinearGradient colors={["#0B3B63", "#0C2C51", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {size.w > 0 && (
          <>
            <FishingNet width={size.w} height={size.h} gap={24} opacity={0.07} />
            <SeaWaves width={size.w} height={Math.min(80, size.h * 0.3)} opacity={[0.14, 0.1, 0.07]} />
            <Bubbles height={size.h} count={6} />
          </>
        )}
        <Blob color={colors.brandPrimary} style={{ top: -70, right: -50, opacity: 0.12 }} />
        <Blob color="#7DD3FC" style={{ bottom: -80, left: -60, opacity: 0.1 }} />
        {/* nautical rope accent along the top */}
        <View style={styles.rope} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.waBadge}>
            <Ionicons name="logo-whatsapp" size={24} color={WA_GREEN} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>PESCATORI DI UOMINI</Text>
            <Text style={styles.title}>Scrivici su WhatsApp</Text>
            <Text style={styles.subtitle}>Gettiamo le reti insieme — siamo a un messaggio di distanza</Text>
          </View>
        </View>

        {/* Feature cards (glassmorphism) */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <BlurView key={f.label} intensity={Platform.OS === "android" ? 30 : 22} tint="light" style={styles.featureCard}>
              <View style={styles.featureInner}>
                <View style={styles.featureIcon}>
                  <MaterialCommunityIcons name={f.icon} size={20} color={WA_GREEN} />
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            </BlurView>
          ))}
        </View>

        {/* Big pulsing WhatsApp button */}
        <Animated.View style={[styles.btnShadow, btnAnim]}>
          <PressableScale testID="whatsapp-button" onPress={open} style={styles.btnTouch}>
            <LinearGradient
              colors={[WA_GREEN, WA_GREEN_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              <Ionicons name="logo-whatsapp" size={26} color={colors.white} />
              <Text style={styles.btnText}>Apri WhatsApp</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Durante le dirette dedicate a questa tipologia di programma leggeremo alcuni dei vostri
          messaggi e ascolteremo i vostri vocali (previo consenso).
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing["2xl"],
    borderRadius: radius.lg,
    overflow: "hidden",
    shadowColor: colors.navy,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  panel: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.22)",
    overflow: "hidden",
  },
  rope: { position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(251,191,36,0.35)", borderStyle: "dashed", borderTopWidth: 1, borderColor: "rgba(251,191,36,0.5)" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  waBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(37,211,102,0.15)",
    borderWidth: 1, borderColor: "rgba(37,211,102,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  brand: { color: "#7DD3FC", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.white, fontSize: 19, fontWeight: "800", letterSpacing: -0.3, marginTop: 2 },
  subtitle: { color: "#CBD5E1", fontSize: 12.5, marginTop: 2 },
  features: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  featureCard: {
    flex: 1, borderRadius: radius.md, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  featureInner: { alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: 6, gap: spacing.sm },
  featureIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(37,211,102,0.16)",
    alignItems: "center", justifyContent: "center",
  },
  featureLabel: { color: colors.white, fontSize: 11.5, fontWeight: "700", textAlign: "center", lineHeight: 15 },
  btnShadow: {
    marginTop: spacing.xl,
    borderRadius: radius.pill,
    shadowColor: WA_GREEN,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  btnTouch: { borderRadius: radius.pill },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, paddingVertical: spacing.md + 2, borderRadius: radius.pill,
  },
  btnText: { color: colors.white, fontSize: 17, fontWeight: "800", letterSpacing: 0.2 },
  disclaimer: { color: "#94A3B8", fontSize: 12.5, lineHeight: 19, textAlign: "center", marginTop: spacing.lg },
});

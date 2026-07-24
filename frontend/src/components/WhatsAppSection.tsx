import React, { useEffect } from "react";
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
      <LinearGradient
        colors={["#101C3D", "#0A1128"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.panel}
      >
        {/* soft green glow accents */}
        <View style={[styles.blob, styles.blobTop]} />
        <View style={[styles.blob, styles.blobBottom]} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.waBadge}>
            <Ionicons name="logo-whatsapp" size={24} color={WA_GREEN} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Scrivici su WhatsApp</Text>
            <Text style={styles.subtitle}>Siamo a un messaggio di distanza</Text>
          </View>
        </View>

        {/* Feature cards */}
        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <BlurView key={f.label} intensity={Platform.OS === "android" ? 25 : 18} tint="light" style={styles.featureCard}>
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
          Durante le dirette del lunedì, mercoledì e domenica leggeremo alcuni dei vostri messaggi e
          ascolteremo i vostri vocali (previo consenso).
        </Text>
      </LinearGradient>
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
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  panel: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(37,211,102,0.25)",
    overflow: "hidden",
  },
  blob: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: WA_GREEN, opacity: 0.12 },
  blobTop: { top: -70, right: -50 },
  blobBottom: { bottom: -80, left: -60, backgroundColor: colors.brandPrimary, opacity: 0.14 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  waBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(37,211,102,0.15)",
    borderWidth: 1, borderColor: "rgba(37,211,102,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  title: { color: colors.white, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { color: colors.brandSecondary, fontSize: 13, marginTop: 2 },
  features: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  featureCard: {
    flex: 1, borderRadius: radius.md, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  featureInner: { alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: 6, gap: spacing.sm },
  featureIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(37,211,102,0.14)",
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
  disclaimer: { color: colors.muted, fontSize: 12.5, lineHeight: 19, textAlign: "center", marginTop: spacing.lg },
});

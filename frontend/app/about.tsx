import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function About() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const values = [
    { icon: "book", title: "La Parola al centro", text: "Ogni contenuto nasce dalla Scrittura e per la Scrittura." },
    { icon: "people", title: "Comunità", text: "Un punto di riferimento per giovani, famiglie e chiunque cerca." },
    { icon: "globe", title: "Missione", text: "Annunciare il Vangelo attraverso la radio e il digitale." },
  ];
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=940&q=80" }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(10,17,40,0.5)", "rgba(10,17,40,0.95)"]} style={StyleSheet.absoluteFill} />
          <Pressable testID="about-back" onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + spacing.sm }]} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </Pressable>
          <View style={styles.heroText}>
            <Text style={styles.brand}>Pescatori di Uomini</Text>
            <Text style={styles.slogan}>"Vi farò pescatori di uomini" — Matteo 4:19</Text>
          </View>
        </View>
        <Text style={styles.body}>
          Pescatori di Uomini nasce con un obiettivo chiaro: annunciare il Vangelo attraverso la radio, i podcast e i contenuti digitali.
          {"\n\n"}Le trasmissioni iniziano a settembre. Vogliamo creare una vera piattaforma cristiana moderna, un punto di riferimento per chiunque desideri ascoltare musica cristiana, studi biblici, testimonianze e seguire le dirette, con la fluidità e la semplicità delle migliori piattaforme, ma interamente pensata per la fede evangelica.
        </Text>
        <View style={styles.values}>
          {values.map((v) => (
            <View key={v.title} style={styles.valueRow}>
              <View style={styles.valueIcon}><Ionicons name={v.icon as any} size={20} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.valueTitle}>{v.title}</Text>
                <Text style={styles.valueText}>{v.text}</Text>
              </View>
            </View>
          ))}
        </View>
        <PressableScale testID="about-crew-cta" style={styles.crewCta} onPress={() => router.push("/equipaggio")}>
          <View style={styles.crewIcon}><Ionicons name="boat" size={22} color={colors.white} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.crewTitle}>Scopri l'Equipaggio</Text>
            <Text style={styles.crewSub}>Le persone che servono in Pescatori di Uomini</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 280, justifyContent: "flex-end" },
  backBtn: { position: "absolute", left: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  heroText: { padding: spacing.xl },
  brand: { color: colors.white, fontSize: 26, fontWeight: "800" },
  slogan: { color: colors.brandSecondary, fontSize: 14, marginTop: spacing.sm, fontStyle: "italic" },
  body: { padding: spacing.xl, fontSize: 16, lineHeight: 26, color: colors.onSurfaceSecondary },
  values: { paddingHorizontal: spacing.xl, gap: spacing.md },
  valueRow: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg },
  valueIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  valueTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  valueText: { fontSize: 14, color: colors.onSurfaceSecondary, marginTop: 2, lineHeight: 20 },
  crewCta: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.xl, marginTop: spacing.xl, backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg },
  crewIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  crewTitle: { color: colors.white, fontSize: 16, fontWeight: "800" },
  crewSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
});

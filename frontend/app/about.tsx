import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const DEFAULTS = {
  about_title: "Pescatori di Uomini",
  about_verse: '"Venite dietro a me e vi farò pescatori di uomini." — Matteo 4:19',
  about_description:
    "Pescatori di Uomini è una web radio cristiana nata per annunciare il Vangelo attraverso la musica, la Parola di Dio, i podcast e le dirette.\n\nIl nostro desiderio è utilizzare gli strumenti digitali per raggiungere chiunque abbia bisogno di speranza, incoraggiamento e di un incontro autentico con Gesù Cristo.\n\nOgni giorno vogliamo offrire contenuti che edificano la fede, accompagnano il cammino spirituale e fanno sentire ogni ascoltatore parte di una grande famiglia cristiana.\n\nLa radio è aperta a tutti: a chi già vive la fede, a chi è in ricerca e a chi desidera semplicemente fermarsi qualche minuto per ascoltare una parola di speranza.",
  about_card1_title: "La Parola al centro",
  about_card1_text:
    "Ogni trasmissione nasce dalla Sacra Scrittura e desidera mettere Gesù Cristo al centro di ogni messaggio, perché la Bibbia è la nostra guida e il fondamento di tutto ciò che condividiamo.",
  about_card2_title: "Una comunità per tutti",
  about_card2_text:
    "Pescatori di Uomini è un luogo di incontro, ascolto e condivisione. Giovani, famiglie, bambini e adulti possono trovare musica cristiana, insegnamenti biblici, testimonianze, momenti di preghiera e dirette pensate per crescere insieme nella fede.",
  about_card3_title: "La nostra missione",
  about_card3_text:
    "Annunciare il Vangelo attraverso la radio e i mezzi digitali, portando un messaggio di speranza, amore e salvezza ovunque ci sia una persona pronta ad ascoltare.",
  about_quote: '"Una voce che porta il Vangelo, una radio che unisce nella fede."',
};

export default function About() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [s, setS] = useState<Record<string, string>>(DEFAULTS);

  useFocusEffect(
    useCallback(() => {
      api.settings().then((d: any) => {
        setS({ ...DEFAULTS, ...Object.fromEntries(Object.entries(d || {}).filter(([, v]) => !!v)) });
      }).catch(() => {});
    }, [])
  );

  const values = [
    { icon: "book", title: s.about_card1_title, text: s.about_card1_text },
    { icon: "people", title: s.about_card2_title, text: s.about_card2_text },
    { icon: "globe", title: s.about_card3_title, text: s.about_card3_text },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={s.about_image ? { uri: s.about_image } : { uri: "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=940&q=80" }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(10,17,40,0.5)", "rgba(10,17,40,0.95)"]} style={StyleSheet.absoluteFill} />
          <Pressable testID="about-back" onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + spacing.sm }]} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </Pressable>
          <View style={styles.heroText}>
            <Text style={styles.brand}>{s.about_title}</Text>
            <Text style={styles.slogan}>{s.about_verse}</Text>
          </View>
        </View>
        <Text style={styles.body}>{s.about_description}</Text>
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

        <View style={styles.quoteCard}>
          <Ionicons name="chatbox-ellipses" size={22} color={colors.brandSecondary} />
          <Text style={styles.quoteText}>{s.about_quote}</Text>
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
  quoteCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.xl, marginTop: spacing.xl, backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg },
  quoteText: { flex: 1, color: colors.white, fontSize: 15, fontStyle: "italic", lineHeight: 22, fontWeight: "600" },
  crewCta: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.xl, marginTop: spacing.xl, backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg },
  crewIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  crewTitle: { color: colors.white, fontSize: 16, fontWeight: "800" },
  crewSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
});

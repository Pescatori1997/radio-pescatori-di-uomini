import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { goBackOrHome } from "@/src/utils/nav";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { crewPortrait } from "@/src/crewAssets";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

function Section({ icon, title, children, delay }: any) {
  return (
    <Animated.View entering={FadeInDown.duration(400).delay(delay)} style={styles.section}>
      <View style={styles.sectionHead}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.brandPrimary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

export default function CrewProfile() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [m, setM] = useState<any>(null);

  useEffect(() => {
    if (id) api.crewMember(id).then(setM).catch(() => {});
  }, [id]);

  if (!m) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, m.poster && { height: 560 }]}>
          {m.poster ? (
            <Image source={crewPortrait(m)} style={StyleSheet.absoluteFill} contentFit="contain" />
          ) : (
            <>
              <Image source={crewPortrait(m)} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
              <LinearGradient colors={["rgba(10,17,40,0.15)", "transparent", "rgba(10,17,40,0.98)"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
              <View style={styles.heroText}>
                <View style={styles.roleTag}>
                  <MaterialCommunityIcons name="anchor" size={12} color={colors.white} />
                  <Text style={styles.roleTagText}>{m.role}</Text>
                </View>
                <Text style={styles.name}>{m.name}</Text>
                <Text style={styles.mission}>{`"${m.mission}"`}</Text>
              </View>
            </>
          )}
          <PressableScale testID="crew-profile-back" onPress={() => goBackOrHome()} style={[styles.backBtn, { top: insets.top + spacing.sm }]}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </PressableScale>
        </View>

        {m.poster && (
          <View style={styles.posterHeading}>
            <View style={styles.roleTag}>
              <MaterialCommunityIcons name="anchor" size={12} color={colors.white} />
              <Text style={styles.roleTagText}>{m.role}</Text>
            </View>
            <Text style={styles.posterName}>{m.name}</Text>
            <Text style={styles.posterMission}>{`"${m.mission}"`}</Text>
          </View>
        )}

        <View style={styles.content}>
          {!m.poster && (
            <Section icon="account-heart" title="Biografia" delay={60}>
              <Text style={styles.body}>{m.bio}</Text>
            </Section>
          )}

          <Section icon="hand-heart" title="Ministero" delay={120}>
            <Text style={styles.body}>{m.ministry}</Text>
          </Section>

          {m.programs?.length > 0 && (
            <Section icon="radio" title="Programmi condotti" delay={180}>
              <View style={styles.chips}>
                {m.programs.map((p: string) => (
                  <View key={p} style={styles.chip}><Text style={styles.chipText}>{p}</Text></View>
                ))}
              </View>
            </Section>
          )}

          {m.verse && !m.poster && (
            <Animated.View entering={FadeInDown.duration(400).delay(240)} style={styles.verseCard}>
              <MaterialCommunityIcons name="format-quote-open" size={28} color={colors.brandPrimary} />
              <Text style={styles.verseText}>{m.verse}</Text>
              <Text style={styles.verseRef}>{m.verse_ref}</Text>
            </Animated.View>
          )}

          {m.testimony && (
            <Section icon="star-four-points" title="Testimonianza" delay={300}>
              <Text style={styles.body}>{m.testimony}</Text>
            </Section>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  hero: { height: 520, justifyContent: "flex-end", backgroundColor: colors.navy },
  backBtn: { position: "absolute", left: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  heroText: { padding: spacing.xl },
  roleTag: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  roleTagText: { color: colors.white, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  name: { color: colors.white, fontSize: 34, fontWeight: "800", marginTop: spacing.sm, letterSpacing: -0.5 },
  mission: { color: "rgba(255,255,255,0.88)", fontSize: 15, fontStyle: "italic", marginTop: 4, lineHeight: 22 },
  content: { padding: spacing.xl, gap: spacing.xl },
  posterHeading: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.sm },
  posterName: { color: colors.onSurface, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  posterMission: { color: colors.onSurfaceSecondary, fontSize: 15, fontStyle: "italic", lineHeight: 22 },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  body: { fontSize: 15, lineHeight: 24, color: colors.onSurfaceSecondary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  chipText: { color: colors.onBrandTertiary, fontSize: 13, fontWeight: "700" },
  verseCard: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.xl },
  verseText: { color: colors.white, fontSize: 18, fontWeight: "600", fontStyle: "italic", lineHeight: 28, marginTop: spacing.sm },
  verseRef: { color: colors.brandSecondary, fontSize: 13, fontWeight: "800", marginTop: spacing.md, letterSpacing: 0.5 },
});

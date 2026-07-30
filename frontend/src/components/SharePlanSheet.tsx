import React, { useRef } from "react";
import { View, Text, StyleSheet, Modal, Platform, useWindowDimensions, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { FishingNet, SeaWaves, SunriseGlow, LightRays } from "@/src/components/marine";
import Logo from "@/src/components/Logo";
import PressableScale from "@/src/components/PressableScale";
import { useShareCard, siteBaseUrl } from "@/src/utils/shareImage";
import { colors, spacing, radius } from "@/src/theme";

/**
 * Shareable, marine-themed card for a reading plan (mode "plan") or a single day
 * of a plan (mode "day"). Same visual language as the Verse-of-the-Day card:
 * navy gradient, sunrise glow, fishing net, sea waves and the radio logo.
 */
export default function SharePlanSheet({
  visible, onClose, plan, day,
}: {
  visible: boolean;
  onClose: () => void;
  plan: any;
  day?: any; // when provided, renders the single-day card
}) {
  const { width } = useWindowDimensions();
  const cardRef = useRef<View>(null);

  const cardW = Math.min(width - 48, 360);
  const cardH = Math.round(cardW * 1.25);

  const isDay = !!day;
  const duration = plan?.duration_days || (plan?.days?.length ?? 0);
  const readingsLabel = isDay ? (day.readings || []).map((r: any) => r.label || `${r.book_name} ${r.chapter}`).join(" · ") : "";

  const linkUrl = plan
    ? (isDay ? `${siteBaseUrl()}/lettore/piano/${plan.id}?day=${day.day}` : `${siteBaseUrl()}/lettore/piano/${plan.id}`)
    : siteBaseUrl();

  const message = !plan ? "" : (isDay
    ? `📖 ${plan.title}\nGiorno ${day.day} di ${duration}${day.title ? ` — ${day.title}` : ""}\n${readingsLabel ? `📚 ${readingsLabel}\n` : ""}\nSegui il piano su Radio Pescatori di Uomini:\n${linkUrl}`
    : `📖 ${plan.title}\n${plan.subtitle || `${duration} giorni`}\n${plan.description ? `\n${plan.description}\n` : ""}\nInizia il piano su Radio Pescatori di Uomini:\n${linkUrl}`);

  const filename = isDay ? `piano-giorno-${day?.day}.png` : "piano-di-lettura.png";

  const { onShare, onSave, sharing, saving, ready } = useShareCard(cardRef, {
    visible, filename, message, captureSize: { width: 1080, height: 1350 },
  });

  if (!plan) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <PressableScale style={styles.closeBtn} onPress={onClose} testID="share-plan-close">
          <Ionicons name="close" size={24} color={colors.white} />
        </PressableScale>

        <View ref={cardRef} collapsable={false} style={[styles.card, { width: cardW, height: cardH }]}>
          <LinearGradient colors={["#0B2A4A", "#0A1B3A", "#0A1128"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <SunriseGlow width={cardW} height={cardH} />
          <LightRays width={cardW} height={cardH} />
          <FishingNet width={cardW} height={cardH} gap={26} opacity={0.06} />
          <SeaWaves width={cardW} height={Math.round(cardH * 0.32)} />

          <View style={styles.cardContent}>
            <View style={styles.brandRow}>
              <Logo size={30} />
              <Text style={styles.brandText}>Radio Pescatori di Uomini</Text>
            </View>

            {isDay ? (
              <View style={styles.body}>
                <Text style={styles.label}>PIANO DI LETTURA</Text>
                <Text style={styles.planTitleSmall} numberOfLines={2}>{plan.title}</Text>
                <Text style={styles.dayBig}>Giorno {day.day}<Text style={styles.dayOf}> di {duration}</Text></Text>
                {!!day.title && <Text style={styles.dayTitle} numberOfLines={2}>{day.title}</Text>}
                {!!readingsLabel && (
                  <View style={styles.refRow}>
                    <View style={styles.refLine} />
                    <Text style={styles.reference} numberOfLines={2}>{readingsLabel}</Text>
                  </View>
                )}
                {!!day.meditation && <Text style={styles.meditation} numberOfLines={4}>“{day.meditation}”</Text>}
              </View>
            ) : (
              <View style={styles.body}>
                <Text style={styles.label}>PIANO DI LETTURA</Text>
                {plan.cover ? (
                  <Image source={{ uri: plan.cover }} style={styles.cover} contentFit="cover" />
                ) : (
                  <View style={styles.coverEmpty}><Ionicons name="book" size={40} color={colors.white} /></View>
                )}
                <Text style={styles.planTitle} numberOfLines={2}>{plan.title}</Text>
                {!!plan.subtitle && <Text style={styles.planSub} numberOfLines={2}>{plan.subtitle}</Text>}
                {!!plan.description && <Text style={styles.planDesc} numberOfLines={3}>{plan.description}</Text>}
                <View style={styles.daysBadge}>
                  <Ionicons name="calendar-outline" size={14} color={colors.navy} />
                  <Text style={styles.daysBadgeText}>{duration} giorni</Text>
                </View>
              </View>
            )}

            <Text style={styles.footer}>Un cammino nella Parola di Dio 🌅</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <PressableScale testID="share-plan-action" style={[styles.shareBtn, !ready && { opacity: 0.6 }]} onPress={onShare} disabled={sharing || !ready}>
            {(sharing || !ready) ? <ActivityIndicator color={colors.navy} /> : (<>
              <Ionicons name="share-social" size={20} color={colors.navy} />
              <Text style={styles.shareText}>Condividi</Text>
            </>)}
          </PressableScale>
          <PressableScale testID="share-plan-save" style={styles.saveBtn} onPress={onSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.white} /> : (<>
              <Ionicons name={Platform.OS === "web" ? "download-outline" : "image-outline"} size={20} color={colors.white} />
              <Text style={styles.saveText}>{Platform.OS === "web" ? "Scarica" : "Salva"}</Text>
            </>)}
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(6,10,26,0.9)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  closeBtn: { position: "absolute", top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  card: { borderRadius: radius.lg, overflow: "hidden" },
  cardContent: { flex: 1, padding: spacing.xl, justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandText: { color: colors.white, fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },
  body: { flex: 1, justifyContent: "center" },
  label: { color: "#FDE68A", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: spacing.md },
  cover: { width: "100%", height: 130, borderRadius: radius.md, marginBottom: spacing.md },
  coverEmpty: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  planTitle: { color: colors.white, fontSize: 26, fontWeight: "800", lineHeight: 32 },
  planSub: { color: colors.brandSecondary, fontSize: 15, fontWeight: "700", marginTop: spacing.sm },
  planDesc: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginTop: spacing.md },
  daysBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, marginTop: spacing.lg },
  daysBadgeText: { color: colors.navy, fontSize: 13, fontWeight: "800" },
  planTitleSmall: { color: colors.brandSecondary, fontSize: 15, fontWeight: "700", marginBottom: spacing.sm },
  dayBig: { color: colors.white, fontSize: 32, fontWeight: "800" },
  dayOf: { color: "#94A3B8", fontSize: 20, fontWeight: "700" },
  dayTitle: { color: colors.white, fontSize: 19, fontWeight: "700", marginTop: spacing.sm },
  refRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  refLine: { width: 24, height: 2, borderRadius: 1, backgroundColor: colors.brandSecondary },
  reference: { flex: 1, color: colors.brandSecondary, fontSize: 15, fontWeight: "800" },
  meditation: { color: "#CBD5E1", fontSize: 14, fontStyle: "italic", lineHeight: 21, marginTop: spacing.lg },
  footer: { color: "#CBD5E1", fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.white, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.pill, minWidth: 150 },
  shareText: { color: colors.navy, fontSize: 16, fontWeight: "800" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.pill, minWidth: 130 },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

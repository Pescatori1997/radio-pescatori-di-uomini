import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Modal, Platform, useWindowDimensions, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { FishingNet, SeaWaves, SunriseGlow, LightRays } from "@/src/components/marine";
import Logo from "@/src/components/Logo";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

/** A shareable, marine-themed image of the verse of the day. Works on native
 * (expo-sharing) and web (Web Share API with fallback to download). */
export default function ShareVerseSheet({ verse, visible, onClose }: { verse: any; visible: boolean; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const cardW = Math.min(width - 48, 360);
  const cardH = Math.round(cardW * 1.25);

  const doShare = async () => {
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1, width: 1080, height: 1350 });
      const shareText = `${verse.reference} — Radio Pescatori di Uomini`;
      if (Platform.OS === "web") {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        const file = new File([blob], "versetto.png", { type: "image/png" });
        const nav: any = navigator;
        if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], title: "Versetto del Giorno", text: shareText });
        } else {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "versetto-del-giorno.png";
          a.click();
          URL.revokeObjectURL(a.href);
        }
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: shareText });
        }
      }
    } catch (e) {
      // silently ignore user-cancelled share
    } finally {
      setBusy(false);
    }
  };

  if (!verse) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <PressableScale style={styles.closeBtn} onPress={onClose} testID="share-close">
          <Ionicons name="close" size={24} color={colors.white} />
        </PressableScale>

        {/* The card that gets captured */}
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

            <View style={styles.verseWrap}>
              <Text style={styles.label}>VERSETTO DEL GIORNO</Text>
              <Text style={styles.verseText} adjustsFontSizeToFit numberOfLines={9}>“{verse.text}”</Text>
              <View style={styles.refRow}>
                <View style={styles.refLine} />
                <Text style={styles.reference}>{verse.reference}</Text>
              </View>
            </View>

            <Text style={styles.footer}>Lasciati incoraggiare dalla Parola 🌅</Text>
          </View>
        </View>

        <PressableScale testID="share-action" style={styles.shareBtn} onPress={doShare} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.navy} /> : (
            <>
              <Ionicons name="share-social" size={20} color={colors.navy} />
              <Text style={styles.shareText}>{Platform.OS === "web" ? "Condividi / Scarica" : "Condividi"}</Text>
            </>
          )}
        </PressableScale>
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
  verseWrap: { flex: 1, justifyContent: "center" },
  label: { color: "#FDE68A", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: spacing.md },
  verseText: { color: colors.white, fontSize: 21, fontWeight: "700", fontStyle: "italic", lineHeight: 30 },
  refRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  refLine: { width: 24, height: 2, borderRadius: 1, backgroundColor: colors.brandSecondary },
  reference: { color: colors.brandSecondary, fontSize: 15, fontWeight: "800" },
  footer: { color: "#CBD5E1", fontSize: 12, fontWeight: "600" },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.white, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.pill, marginTop: spacing.xl, minWidth: 200 },
  shareText: { color: colors.navy, fontSize: 16, fontWeight: "800" },
});

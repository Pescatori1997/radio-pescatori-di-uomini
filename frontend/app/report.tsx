import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

export const REPORT_CATEGORIES = [
  { key: "bug", emoji: "🐞", label: "Bug" },
  { key: "suggestion", emoji: "💡", label: "Suggerimento" },
  { key: "technical", emoji: "⚠️", label: "Problema tecnico" },
  { key: "other", emoji: "❤️", label: "Altro" },
];

const MAX_B64 = 12_000_000; // ~8MB raw

export default function Report() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [category, setCategory] = useState("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const pick = async (kind: "image" | "video") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) alertMessage("Permesso negato", "Consenti l'accesso alla galleria dalle impostazioni.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "image" ? ["images"] : ["videos"],
      quality: 0.5,
      base64: kind === "image",
      videoMaxDuration: 30,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (kind === "image") {
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      if (uri.length > MAX_B64) { alertMessage("Immagine troppo grande", "Scegli un'immagine più piccola (max ~8MB)."); return; }
      setScreenshot(uri);
    } else {
      // Videos are read as base64 for storage; guard against oversized files.
      try {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        if (blob.size > 8_000_000) { alertMessage("Video troppo grande", "Scegli un video più breve/leggero (max ~8MB)."); return; }
        const b64: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result as string);
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        setVideo(b64);
      } catch {
        alertMessage("Errore", "Impossibile caricare il video.");
      }
    }
  };

  const submit = async () => {
    if (!title.trim()) { alertMessage("Campo obbligatorio", "Inserisci un titolo."); return; }
    if (!description.trim()) { alertMessage("Campo obbligatorio", "Inserisci una descrizione."); return; }
    setBusy(true);
    try {
      await api.createReport({ category, title: title.trim(), description: description.trim(), screenshot, video });
      setSent(true);
    } catch (e: any) {
      alertMessage("Errore", e.message || "Invio non riuscito");
    } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <View style={[styles.container, styles.successWrap, { paddingTop: insets.top }]}>
        <View style={styles.successIcon}><Ionicons name="checkmark-circle" size={72} color={colors.success} /></View>
        <Text style={styles.successTitle}>Segnalazione ricevuta!</Text>
        <Text style={styles.successSub}>Grazie per il tuo aiuto. Il nostro team esaminerà la tua segnalazione al più presto.</Text>
        <PressableScale testID="report-done" style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryText}>Torna indietro</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="report-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>Segnala un problema</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Hai trovato un bug o hai un'idea per migliorare l'app? Faccelo sapere.</Text>

        <Text style={styles.label}>Categoria</Text>
        <View style={styles.chips}>
          {REPORT_CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <Pressable key={c.key} testID={`report-cat-${c.key}`} onPress={() => setCategory(c.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={styles.chipEmoji}>{c.emoji}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Titolo *</Text>
        <TextInput testID="report-title" value={title} onChangeText={setTitle} placeholder="Riassumi il problema" placeholderTextColor={colors.muted} style={styles.input} maxLength={100} />

        <Text style={styles.label}>Descrizione *</Text>
        <TextInput testID="report-description" value={description} onChangeText={setDescription} placeholder="Descrivi cosa è successo o la tua idea..." placeholderTextColor={colors.muted} multiline style={[styles.input, styles.textarea]} />

        <Text style={styles.label}>Allegati (facoltativi)</Text>
        <View style={styles.attachRow}>
          {screenshot ? (
            <View style={styles.attachPreview}>
              <Image source={{ uri: screenshot }} style={styles.attachImg} contentFit="cover" />
              <Pressable testID="report-remove-image" onPress={() => setScreenshot(null)} style={styles.attachRemove}><Ionicons name="close" size={14} color={colors.white} /></Pressable>
            </View>
          ) : (
            <Pressable testID="report-add-image" onPress={() => pick("image")} style={styles.attachBtn}>
              <Ionicons name="image-outline" size={22} color={colors.brandPrimary} />
              <Text style={styles.attachText}>Screenshot</Text>
            </Pressable>
          )}
          {video ? (
            <View style={styles.attachPreview}>
              <View style={[styles.attachImg, styles.videoChip]}><MaterialCommunityIcons name="video" size={26} color={colors.white} /><Text style={styles.videoChipText}>Video allegato</Text></View>
              <Pressable testID="report-remove-video" onPress={() => setVideo(null)} style={styles.attachRemove}><Ionicons name="close" size={14} color={colors.white} /></Pressable>
            </View>
          ) : (
            <Pressable testID="report-add-video" onPress={() => pick("video")} style={styles.attachBtn}>
              <Ionicons name="videocam-outline" size={22} color={colors.brandPrimary} />
              <Text style={styles.attachText}>Video</Text>
            </Pressable>
          )}
        </View>

        <PressableScale testID="report-submit" style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="send" size={17} color={colors.white} /><Text style={styles.primaryText}>Invia segnalazione</Text></>}
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  intro: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 21, marginBottom: spacing.lg },
  label: { color: colors.onSurface, fontSize: 14, fontWeight: "800", marginBottom: spacing.sm, marginTop: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  chipEmoji: { fontSize: 15 },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "700" },
  chipTextActive: { color: colors.onBrandTertiary },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 15, color: colors.onSurface },
  textarea: { minHeight: 120, textAlignVertical: "top" },
  attachRow: { flexDirection: "row", gap: spacing.md },
  attachBtn: { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", height: 88, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  attachText: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "700" },
  attachPreview: { flex: 1, height: 88, borderRadius: radius.md, overflow: "hidden", position: "relative" },
  attachImg: { width: "100%", height: 88, backgroundColor: colors.navy },
  videoChip: { alignItems: "center", justifyContent: "center", gap: 4 },
  videoChipText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  attachRemove: { position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  primaryBtn: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  successWrap: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  successIcon: { marginBottom: spacing.lg },
  successTitle: { color: colors.onSurface, fontSize: 24, fontWeight: "800", textAlign: "center" },
  successSub: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: spacing.md },
});

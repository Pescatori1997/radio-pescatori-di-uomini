import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

async function readZipBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
    return dataUrl.split(",").pop() || "";
  }
  return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

export default function ImportPlan() {
  const router = useRouter();
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState("");

  const pickAndParse = async () => {
    setError("");
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/zip", "application/x-zip-compressed", "application/octet-stream", "*/*"],
        copyToCacheDirectory: true, multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      if (!(a.name || "").toLowerCase().endsWith(".zip")) {
        setError("Seleziona un file .zip valido.");
        return;
      }
      setParsing(true);
      const b64 = await readZipBase64(a.uri);
      const parsed = await api.adminParseImportPlan(b64);
      setPreview(parsed);
    } catch (e: any) {
      setError(e?.message || "Impossibile leggere il file. Controlla lo ZIP e riprova.");
      setPreview(null);
    } finally {
      setParsing(false);
    }
  };

  const doImport = async (status: "draft" | "published") => {
    if (!preview) return;
    setSaving(true);
    try {
      const body = { ...preview, status, featured: false, order: 0 };
      const created = await api.adminCreatePlan(body);
      alertMessage("Importato", status === "published" ? "Il piano è stato importato e pubblicato." : "Il piano è stato importato come bozza.");
      const newId = created?.id;
      if (newId) router.replace(`/admin/reading-plans/${newId}`);
      else router.replace("/admin/reading-plans");
    } catch (e: any) {
      alertMessage("Errore", e?.message || "Riprova");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="Importa piano" activeKey="plans">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        {!preview && (
          <>
            <Text style={styles.intro}>Carica un file ZIP contenente <Text style={styles.bold}>piano.json</Text> e l'immagine di copertina. L'app leggerà tutto e mostrerà un'anteprima prima di salvare.</Text>
            <PressableScale testID="import-pick" style={styles.pickBtn} onPress={pickAndParse} disabled={parsing}>
              {parsing ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="cloud-upload-outline" size={22} color={colors.white} /><Text style={styles.pickText}>Scegli file ZIP</Text></>}
            </PressableScale>
            {!!error && <View style={styles.errorBox}><Ionicons name="alert-circle" size={18} color="#F87171" /><Text style={styles.errorText}>{error}</Text></View>}

            <View style={styles.help}>
              <Text style={styles.helpTitle}>Struttura dello ZIP</Text>
              <Text style={styles.mono}>PIANO.zip{"\n"}├── piano.json{"\n"}└── copertina.jpg</Text>
              <Text style={styles.helpNote}>Il JSON deve contenere: title, description, category, duration_days, cover_image, status e l'elenco days[] (ogni giorno: title, bible_reading[], talk_with_the_lord, meditation).</Text>
            </View>
          </>
        )}

        {preview && (
          <>
            <Text style={styles.previewLabel}>ANTEPRIMA</Text>
            {preview.cover ? (
              <Image source={{ uri: preview.cover }} style={styles.cover} contentFit="cover" />
            ) : (
              <View style={[styles.cover, styles.coverEmpty]}><Ionicons name="book" size={36} color={ADMIN.muted} /></View>
            )}
            <Text style={styles.pTitle}>{preview.title}</Text>
            {!!preview.description && <Text style={styles.pDesc}>{preview.description}</Text>}
            <View style={styles.pillRow}>
              {!!preview.category && <View style={styles.pill}><Text style={styles.pillText}>{preview.category}</Text></View>}
              <View style={styles.pill}><Text style={styles.pillText}>{preview.duration_days} giorni</Text></View>
              <View style={styles.pill}><Text style={styles.pillText}>{preview.status === "published" ? "Pubblicato" : "Bozza"}</Text></View>
            </View>

            <Text style={styles.daysHead}>Giorni ({preview.days?.length || 0})</Text>
            {(preview.days || []).map((d: any) => (
              <View key={d.day} style={styles.dayRow}>
                <View style={styles.dayNumBadge}><Text style={styles.dayNumText}>{d.day}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayTitle} numberOfLines={1}>{d.title || `Giorno ${d.day}`}</Text>
                  <Text style={styles.dayMeta} numberOfLines={1}>
                    📖 {(d.readings || []).map((r: any) => r.label).join(" · ") || "—"}
                  </Text>
                </View>
              </View>
            ))}

            <View style={styles.actions}>
              <PressableScale testID="import-cancel" style={styles.cancelBtn} onPress={() => { setPreview(null); setError(""); }}>
                <Text style={styles.cancelText}>Annulla</Text>
              </PressableScale>
              <PressableScale testID="import-draft" style={styles.draftBtn} onPress={() => doImport("draft")} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.draftText}>Importa come bozza</Text>}
              </PressableScale>
              <PressableScale testID="import-publish" style={styles.pubBtn} onPress={() => doImport("published")} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.pubText}>Importa e pubblica</Text>}
              </PressableScale>
            </View>
          </>
        )}
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  intro: { color: "#CBD5E1", fontSize: 14, lineHeight: 21, marginBottom: spacing.lg },
  bold: { color: colors.white, fontWeight: "800" },
  pickBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.md },
  pickText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(248,113,113,0.12)", borderWidth: 1, borderColor: "rgba(248,113,113,0.4)", borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  errorText: { flex: 1, color: "#FCA5A5", fontSize: 13.5, lineHeight: 19 },
  help: { marginTop: spacing.xl, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border, borderRadius: radius.md, padding: spacing.lg },
  helpTitle: { color: colors.white, fontSize: 13, fontWeight: "800", marginBottom: spacing.sm },
  mono: { color: "#93C5FD", fontSize: 13, fontFamily: Platform.select({ ios: "Courier", android: "monospace", default: "monospace" }), lineHeight: 20 },
  helpNote: { color: ADMIN.muted, fontSize: 12.5, lineHeight: 18, marginTop: spacing.md },

  previewLabel: { color: "#F6C560", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: spacing.md },
  cover: { width: 140, height: 187, borderRadius: radius.md, alignSelf: "center", marginBottom: spacing.md, backgroundColor: ADMIN.card },
  coverEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: ADMIN.border },
  pTitle: { color: colors.white, fontSize: 22, fontWeight: "800", textAlign: "center" },
  pDesc: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: spacing.sm },
  pillRow: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", flexWrap: "wrap", marginTop: spacing.md, marginBottom: spacing.lg },
  pill: { backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  pillText: { color: "#CBD5E1", fontSize: 12, fontWeight: "700" },
  daysHead: { color: colors.white, fontSize: 15, fontWeight: "800", marginBottom: spacing.md },
  dayRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  dayNumBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  dayNumText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  dayTitle: { color: colors.white, fontSize: 14.5, fontWeight: "700" },
  dayMeta: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xl },
  cancelBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border },
  cancelText: { color: "#CBD5E1", fontSize: 14, fontWeight: "700" },
  draftBtn: { flex: 1, minWidth: 130, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: ADMIN.border },
  draftText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  pubBtn: { flex: 1, minWidth: 130, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: "#22A559" },
  pubText: { color: colors.white, fontSize: 14, fontWeight: "800" },
});

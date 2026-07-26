import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { api, uploadMediaChunked } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import { AInput, ASwitch, AImagePicker } from "@/src/components/adminForm";
import PressableScale from "@/src/components/PressableScale";
import { confirmAsync, alertMessage } from "@/src/utils/confirm";
import { PROVIDER_LABEL } from "@/src/utils/embeds";
import { colors, spacing, radius } from "@/src/theme";

const pad = (n: number) => String(n).padStart(2, "0");
const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB

function detectProvider(url: string): string | null {
  const u = (url || "").toLowerCase();
  if (!u) return null;
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("vimeo.com")) return "vimeo";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "facebook";
  if (u.includes("spotify.com")) return "spotify";
  return null;
}

const TYPE_ICON: Record<string, any> = { video: "video", audio: "music", pdf: "file-pdf-box" };

export default function MeditationEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const [f, setF] = useState<any>({
    title: "", subtitle: "", speaker: "", verse: "", description: "", category: "Generale",
    duration: "", video_url: "", media_id: null, media_type: null, media_mime: null,
    media_filename: null, thumbnail: null, downloadable: true, published: false,
  });
  const [source, setSource] = useState<"upload" | "link">("link");
  const [schedule, setSchedule] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useFocusEffect(useCallback(() => {
    if (!isNew && id) {
      api.adminMeditation(id).then((d) => {
        setF({ downloadable: true, ...d });
        setSource(d.media_id ? "upload" : "link");
        if (d.published && d.publish_date && new Date(d.publish_date).getTime() > Date.now()) {
          setSchedule(true);
          const dt = new Date(d.publish_date);
          setDate(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
          setTime(`${pad(dt.getHours())}:${pad(dt.getMinutes())}`);
        }
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [id]));

  const pickAndUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["video/*", "audio/*", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      if (asset.size && asset.size > MAX_BYTES) {
        alertMessage("File troppo grande", "La dimensione massima consentita è 1 GB.");
        return;
      }
      setUploadPct(0);
      const info = await uploadMediaChunked(
        { uri: asset.uri, name: asset.name || "file", mime: asset.mimeType || "application/octet-stream" },
        (p) => setUploadPct(p),
      );
      setF((prev: any) => ({
        ...prev,
        media_id: info.media_id,
        media_type: info.media_type,
        media_mime: info.media_mime,
        media_filename: info.media_filename,
        video_url: "",
        // auto cover from the extracted frame if the admin hasn't set one
        thumbnail: prev.thumbnail || info.thumbnail || null,
        duration: prev.duration || info.duration || "",
      }));
      setUploadPct(null);
    } catch (e: any) {
      setUploadPct(null);
      alertMessage("Errore di caricamento", e.message || "Riprova.");
    }
  };

  const clearMedia = () => setF((p: any) => ({ ...p, media_id: null, media_type: null, media_mime: null, media_filename: null }));

  const save = async () => {
    if (!f.title?.trim()) { alertMessage("Campo obbligatorio", "Inserisci il titolo."); return; }
    if (source === "upload" && !f.media_id) { alertMessage("Contenuto mancante", "Carica un file oppure passa a 'Link esterno'."); return; }
    if (source === "link" && !f.video_url?.trim()) { alertMessage("Contenuto mancante", "Inserisci un link oppure carica un file."); return; }

    let publish_date: string | undefined;
    if (f.published && schedule) {
      const parsed = new Date(`${date}T${time}:00`);
      if (isNaN(parsed.getTime())) { alertMessage("Data non valida", "Usa il formato AAAA-MM-GG e ora HH:MM."); return; }
      publish_date = parsed.toISOString();
    } else if (f.published) {
      publish_date = new Date().toISOString();
    }

    const usingUpload = source === "upload";
    const payload: any = {
      title: f.title.trim(), subtitle: f.subtitle || "", speaker: f.speaker || "", verse: f.verse || "",
      description: f.description || "", category: (f.category || "Generale").trim(), duration: f.duration || "",
      thumbnail: f.thumbnail || null, downloadable: !!f.downloadable, published: !!f.published,
      video_url: usingUpload ? "" : (f.video_url || "").trim(),
      media_id: usingUpload ? f.media_id : null,
      media_type: usingUpload ? f.media_type : null,
      media_mime: usingUpload ? f.media_mime : null,
      media_filename: usingUpload ? f.media_filename : null,
      ...(publish_date ? { publish_date } : {}),
    };
    setSaving(true);
    try {
      if (isNew) await api.adminCreateMeditation(payload);
      else await api.adminEditMeditation(id!, payload);
      router.back();
    } catch (e: any) {
      alertMessage("Errore", e.message || "Salvataggio non riuscito");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    const ok = await confirmAsync("Elimina meditazione", "Vuoi eliminare definitivamente questa meditazione? L'operazione non è reversibile.", "Elimina", true);
    if (!ok) return;
    setSaving(true);
    try {
      await api.adminDeleteMeditation(id!);
      alertMessage("Meditazione eliminata", "La meditazione è stata rimossa correttamente.");
      router.back();
    } catch (e: any) {
      alertMessage("Errore", e.message || "Eliminazione non riuscita");
    } finally { setSaving(false); }
  };

  const provider = source === "link" ? detectProvider(f.video_url) : null;

  return (
    <AdminShell title={isNew ? "Nuova meditazione" : "Modifica meditazione"} activeKey="meditations">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <AImagePicker testID="med-thumb" label="Copertina (16:9)" value={f.thumbnail} onChange={(v: string) => set("thumbnail", v)} aspect={[16, 9]} />
          {f.media_type === "video" && !!f.thumbnail && <Text style={styles.hint}>Suggerimento: la copertina è stata generata automaticamente dal video. Puoi sostituirla.</Text>}

          <AInput testID="med-title" label="Titolo *" value={f.title} onChangeText={(v: string) => set("title", v)} placeholder="Titolo della meditazione" />
          <AInput testID="med-subtitle" label="Sottotitolo" value={f.subtitle} onChangeText={(v: string) => set("subtitle", v)} placeholder="Un breve sottotitolo" />
          <AInput testID="med-speaker" label="Predicatore / Autore" value={f.speaker} onChangeText={(v: string) => set("speaker", v)} placeholder="Es. Past. Marco Rossi" />
          <AInput testID="med-verse" label="Versetto principale (opzionale)" value={f.verse} onChangeText={(v: string) => set("verse", v)} placeholder="Es. Giovanni 3:16" />
          <AInput testID="med-category" label="Categoria" value={f.category} onChangeText={(v: string) => set("category", v)} placeholder="Es. Fede, Grazia, Studio biblico" />
          <AInput testID="med-duration" label="Durata (opzionale)" value={f.duration} onChangeText={(v: string) => set("duration", v)} placeholder="Es. 12:30" />

          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Contenuto</Text>
          <View style={styles.segment}>
            <Pressable testID="med-src-upload" onPress={() => setSource("upload")} style={[styles.segBtn, source === "upload" && styles.segActive]}>
              <Ionicons name="cloud-upload-outline" size={16} color={source === "upload" ? colors.white : ADMIN.muted} />
              <Text style={[styles.segText, source === "upload" && styles.segTextActive]}>Carica file</Text>
            </Pressable>
            <Pressable testID="med-src-link" onPress={() => setSource("link")} style={[styles.segBtn, source === "link" && styles.segActive]}>
              <Ionicons name="link-outline" size={16} color={source === "link" ? colors.white : ADMIN.muted} />
              <Text style={[styles.segText, source === "link" && styles.segTextActive]}>Link esterno</Text>
            </Pressable>
          </View>

          {source === "upload" ? (
            <View>
              {f.media_id ? (
                <View style={styles.mediaCard}>
                  <MaterialCommunityIcons name={TYPE_ICON[f.media_type] || "file"} size={26} color={colors.brandPrimary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mediaName} numberOfLines={1}>{f.media_filename || "File caricato"}</Text>
                    <Text style={styles.mediaMeta}>{(f.media_type || "").toUpperCase()}{f.duration ? ` · ${f.duration}` : ""}</Text>
                  </View>
                  <Pressable testID="med-media-remove" onPress={clearMedia} hitSlop={8}><Ionicons name="close-circle" size={22} color={ADMIN.muted} /></Pressable>
                </View>
              ) : null}
              {uploadPct !== null ? (
                <View style={styles.progressWrap}>
                  <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${Math.round(uploadPct * 100)}%` }]} /></View>
                  <Text style={styles.progressText}>Caricamento… {Math.round(uploadPct * 100)}%</Text>
                </View>
              ) : (
                <PressableScale testID="med-upload-btn" style={styles.uploadBtn} onPress={pickAndUpload}>
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.white} />
                  <Text style={styles.uploadText}>{f.media_id ? "Sostituisci file" : "Scegli video, audio o PDF"}</Text>
                </PressableScale>
              )}
              <Text style={styles.hint}>Video MP4/MOV/WEBM, audio MP3/M4A/WAV o PDF · max 1 GB. Il tipo viene rilevato automaticamente.</Text>
            </View>
          ) : (
            <View>
              <AInput testID="med-link" label="Link esterno" value={f.video_url} onChangeText={(v: string) => set("video_url", v)} placeholder="YouTube, Vimeo, Facebook, Instagram, TikTok, Spotify…" />
              {!!provider && <View style={styles.providerBadge}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={styles.providerText}>Rilevato: {PROVIDER_LABEL[provider]}</Text></View>}
            </View>
          )}

          <AInput testID="med-desc" label="Descrizione" value={f.description} onChangeText={(v: string) => set("description", v)} multiline placeholder="Descrizione della meditazione, studio biblico, dispensa…" />
          <ASwitch testID="med-downloadable" label="Consenti il download agli utenti" value={f.downloadable} onValueChange={(v: boolean) => set("downloadable", v)} />

          <View style={styles.divider} />
          <ASwitch testID="med-published" label="Pubblica" value={f.published} onValueChange={(v: boolean) => set("published", v)} />
          {f.published && (
            <>
              <ASwitch testID="med-schedule" label="Programma per una data futura" value={schedule} onValueChange={setSchedule} />
              {schedule && (
                <View style={styles.scheduleRow}>
                  <View style={{ flex: 1.4 }}><AInput testID="med-date" label="Data (AAAA-MM-GG)" value={date} onChangeText={setDate} placeholder="2026-07-01" /></View>
                  <View style={{ flex: 1 }}><AInput testID="med-time" label="Ora (HH:MM)" value={time} onChangeText={setTime} placeholder="09:00" /></View>
                </View>
              )}
              <Text style={styles.hint}>{schedule ? "Diventerà visibile e verrà notificata alla data indicata." : "Verrà pubblicata subito e gli utenti riceveranno una notifica."}</Text>
            </>
          )}
          {!f.published && <Text style={styles.hint}>Salvata come bozza: non visibile agli utenti.</Text>}

          <PressableScale testID="med-save" style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving || uploadPct !== null}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>{isNew ? "Crea meditazione" : "Salva modifiche"}</Text>}
          </PressableScale>

          {!isNew && (
            <Pressable testID="med-delete" onPress={remove} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={styles.deleteText}>Elimina meditazione</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  divider: { height: 1, backgroundColor: ADMIN.border, marginVertical: spacing.lg },
  sectionLabel: { color: colors.white, fontSize: 14, fontWeight: "800", marginBottom: spacing.sm },
  segment: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  segBtn: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 11, borderRadius: radius.md, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  segActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  segText: { color: ADMIN.muted, fontSize: 14, fontWeight: "700" },
  segTextActive: { color: colors.white },
  mediaCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border, marginBottom: spacing.sm },
  mediaName: { color: colors.white, fontSize: 14, fontWeight: "700" },
  mediaMeta: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  uploadBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.md },
  uploadText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  progressWrap: { marginVertical: spacing.sm },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: ADMIN.card, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: colors.brandPrimary },
  progressText: { color: ADMIN.muted, fontSize: 12, marginTop: 6, textAlign: "center" },
  providerBadge: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: -spacing.xs, marginBottom: spacing.sm },
  providerText: { color: colors.success, fontSize: 13, fontWeight: "700" },
  hint: { color: ADMIN.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.xs, marginBottom: spacing.sm },
  scheduleRow: { flexDirection: "row", gap: spacing.md },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.lg },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  deleteBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.lg, paddingVertical: spacing.md },
  deleteText: { color: colors.error, fontSize: 15, fontWeight: "700" },
});

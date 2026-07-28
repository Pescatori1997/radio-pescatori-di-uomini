import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import { AInput, ASwitch, AImagePicker } from "@/src/components/adminForm";
import MediaUpload, { MediaValue } from "@/src/components/MediaUpload";
import PressableScale from "@/src/components/PressableScale";
import { confirmAsync, alertMessage } from "@/src/utils/confirm";
import { sectionLabel, sectionHint } from "@/src/utils/sections";
import { colors, spacing, radius } from "@/src/theme";

const pad = (n: number) => String(n).padStart(2, "0");

const STATUS_OPTS = [
  { k: "draft", l: "Bozza", icon: "create-outline" },
  { k: "published", l: "Pubblica", icon: "checkmark-circle-outline" },
  { k: "archived", l: "Archivia", icon: "archive-outline" },
];

export default function ContentEditor() {
  const router = useRouter();
  const { section, id } = useLocalSearchParams<{ section: string; id: string }>();
  const isNew = id === "new";
  const label = sectionLabel(section);

  const [f, setF] = useState<any>({
    title: "", subtitle: "", author: "", category: "Generale", description: "",
    thumbnail: null, media_id: null, media_type: null, media_mime: null, media_filename: null,
    video_url: "", duration: "", downloadable: true, visibility: "public", order: 0, status: "draft",
  });
  const [tagsText, setTagsText] = useState("");
  const [schedule, setSchedule] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useFocusEffect(useCallback(() => {
    if (!isNew && id) {
      api.adminContent(id).then((d: any) => {
        setF({ downloadable: true, visibility: "public", order: 0, ...d });
        setTagsText(Array.isArray(d.tags) ? d.tags.join(", ") : "");
        if (d.status === "published" && d.publish_date && new Date(d.publish_date).getTime() > Date.now()) {
          setSchedule(true);
          const dt = new Date(d.publish_date);
          setDate(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
          setTime(`${pad(dt.getHours())}:${pad(dt.getMinutes())}`);
        }
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [id]));

  const mediaValue: MediaValue = {
    media_id: f.media_id, media_type: f.media_type, media_mime: f.media_mime,
    media_filename: f.media_filename, video_url: f.video_url, thumbnail: f.thumbnail, duration: f.duration,
  };
  const onMediaChange = (v: MediaValue) => setF((p: any) => ({ ...p, ...v }));

  const save = async () => {
    if (!f.title?.trim()) { alertMessage("Campo obbligatorio", "Inserisci il titolo."); return; }
    const hasMedia = !!f.media_id || !!(f.video_url || "").trim();
    if (!hasMedia && !f.thumbnail) {
      alertMessage("Contenuto mancante", "Carica un file, inserisci un link esterno oppure aggiungi almeno una copertina.");
      return;
    }

    let publish_date: string | undefined;
    if (f.status === "published" && schedule) {
      const parsed = new Date(`${date}T${time}:00`);
      if (isNaN(parsed.getTime())) { alertMessage("Data non valida", "Usa il formato AAAA-MM-GG e ora HH:MM."); return; }
      publish_date = parsed.toISOString();
    } else if (f.status === "published") {
      publish_date = new Date().toISOString();
    }

    const usingUpload = !!f.media_id;
    const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
    const payload: any = {
      title: f.title.trim(), subtitle: f.subtitle || "", author: f.author || "",
      category: (f.category || "Generale").trim(), description: f.description || "",
      tags, thumbnail: f.thumbnail || null, duration: f.duration || "",
      downloadable: !!f.downloadable, visibility: f.visibility || "public",
      order: Number(f.order) || 0, status: f.status || "draft",
      video_url: usingUpload ? "" : (f.video_url || "").trim(),
      media_id: usingUpload ? f.media_id : null,
      media_type: usingUpload ? f.media_type : null,
      media_mime: usingUpload ? f.media_mime : null,
      media_filename: usingUpload ? f.media_filename : null,
      ...(publish_date ? { publish_date } : {}),
    };

    setSaving(true);
    try {
      if (isNew) await api.adminCreateContent({ section, ...payload });
      else await api.adminEditContent(id!, payload);
      router.back();
    } catch (e: any) {
      alertMessage("Errore", e.message || "Salvataggio non riuscito");
    } finally { setSaving(false); }
  };

  const duplicate = async () => {
    setSaving(true);
    try {
      const r = await api.adminDuplicateContent(id!);
      alertMessage("Contenuto duplicato", "È stata creata una copia in bozza.");
      router.replace(`/admin/content/${section}/${r.id}` as any);
    } catch (e: any) {
      alertMessage("Errore", e.message || "Duplicazione non riuscita");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    const ok = await confirmAsync("Elimina contenuto", "Vuoi eliminare definitivamente questo contenuto? L'operazione non è reversibile.", "Elimina", true);
    if (!ok) return;
    setSaving(true);
    try {
      await api.adminDeleteContent(id!);
      alertMessage("Contenuto eliminato", "Il contenuto è stato rimosso correttamente.");
      router.back();
    } catch (e: any) {
      alertMessage("Errore", e.message || "Eliminazione non riuscita");
    } finally { setSaving(false); }
  };

  return (
    <AdminShell title={isNew ? `Nuovo · ${label}` : `Modifica · ${label}`} activeKey={section}>
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
          <AImagePicker testID="cnt-thumb" label="Copertina" value={f.thumbnail} onChange={(v: string) => set("thumbnail", v)} aspect={[1, 1]} />
          {f.media_type === "video" && !!f.thumbnail && <Text style={styles.hint}>La copertina è stata generata automaticamente dal video. Puoi sostituirla.</Text>}

          <AInput testID="cnt-title" label="Titolo *" value={f.title} onChangeText={(v: string) => set("title", v)} placeholder={`Titolo · ${label}`} />
          <AInput testID="cnt-subtitle" label="Sottotitolo" value={f.subtitle} onChangeText={(v: string) => set("subtitle", v)} placeholder="Un breve sottotitolo" />
          <AInput testID="cnt-author" label="Autore / Predicatore" value={f.author} onChangeText={(v: string) => set("author", v)} placeholder="Es. Past. Marco Rossi" />
          <AInput testID="cnt-category" label="Categoria" value={f.category} onChangeText={(v: string) => set("category", v)} placeholder="Es. Fede, Grazia, Studio biblico" />
          <AInput testID="cnt-tags" label="Tag (separati da virgola)" value={tagsText} onChangeText={setTagsText} placeholder="Es. speranza, salvezza, preghiera" />
          <AInput testID="cnt-duration" label="Durata (opzionale)" value={f.duration} onChangeText={(v: string) => set("duration", v)} placeholder="Es. 12:30" />

          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Contenuto multimediale</Text>
          <MediaUpload value={mediaValue} onChange={onMediaChange} />
          <Text style={styles.hint}>{sectionHint(section)}</Text>

          <AInput testID="cnt-desc" label="Descrizione" value={f.description} onChangeText={(v: string) => set("description", v)} multiline placeholder="Descrizione del contenuto…" />
          <ASwitch testID="cnt-downloadable" label="Consenti il download agli utenti" value={f.downloadable} onValueChange={(v: boolean) => set("downloadable", v)} />

          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Pubblicazione</Text>
          <View style={styles.segment}>
            {STATUS_OPTS.map((s) => (
              <Pressable key={s.k} testID={`cnt-status-${s.k}`} onPress={() => set("status", s.k)} style={[styles.seg, f.status === s.k && styles.segActive]}>
                <Ionicons name={s.icon as any} size={15} color={f.status === s.k ? colors.white : ADMIN.muted} />
                <Text style={[styles.segText, f.status === s.k && styles.segTextActive]}>{s.l}</Text>
              </Pressable>
            ))}
          </View>

          {f.status === "published" && (
            <>
              <ASwitch testID="cnt-schedule" label="Programma per una data futura" value={schedule} onValueChange={setSchedule} />
              {schedule && (
                <View style={styles.scheduleRow}>
                  <View style={{ flex: 1.4 }}><AInput testID="cnt-date" label="Data (AAAA-MM-GG)" value={date} onChangeText={setDate} placeholder="2026-07-01" /></View>
                  <View style={{ flex: 1 }}><AInput testID="cnt-time" label="Ora (HH:MM)" value={time} onChangeText={setTime} placeholder="09:00" /></View>
                </View>
              )}
              <Text style={styles.hint}>{schedule ? "Diventerà visibile alla data indicata." : "Sarà pubblicato subito e gli utenti riceveranno una notifica."}</Text>
            </>
          )}
          {f.status === "draft" && <Text style={styles.hint}>Salvato come bozza: non visibile agli utenti.</Text>}
          {f.status === "archived" && <Text style={styles.hint}>Archiviato: nascosto dalla vista pubblica ma conservato.</Text>}

          <AInput testID="cnt-order" label="Ordine (numero più basso = più in alto)" value={String(f.order ?? 0)} onChangeText={(v: string) => set("order", v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" />

          <PressableScale testID="cnt-save" style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>{isNew ? "Crea contenuto" : "Salva modifiche"}</Text>}
          </PressableScale>

          {!isNew && (
            <View style={styles.footerActions}>
              <Pressable testID="cnt-preview" onPress={() => router.push(`/c/${section}/${id}` as any)} style={styles.footerBtn}>
                <Ionicons name="eye-outline" size={18} color={colors.brandPrimary} />
                <Text style={styles.footerText}>Anteprima</Text>
              </Pressable>
              <Pressable testID="cnt-duplicate" onPress={duplicate} style={styles.footerBtn}>
                <Ionicons name="copy-outline" size={18} color={colors.brandPrimary} />
                <Text style={styles.footerText}>Duplica</Text>
              </Pressable>
              <Pressable testID="cnt-delete" onPress={remove} style={styles.footerBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={[styles.footerText, { color: colors.error }]}>Elimina</Text>
              </Pressable>
            </View>
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
  seg: { flex: 1, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center", paddingVertical: 11, borderRadius: radius.md, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  segActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  segText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  segTextActive: { color: colors.white },
  hint: { color: ADMIN.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.xs, marginBottom: spacing.sm },
  scheduleRow: { flexDirection: "row", gap: spacing.md },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.lg },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  footerActions: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: ADMIN.border, paddingTop: spacing.lg },
  footerBtn: { flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  footerText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
});

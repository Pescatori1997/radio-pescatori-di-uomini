import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import { AInput, ASwitch, AImagePicker } from "@/src/components/adminForm";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const pad = (n: number) => String(n).padStart(2, "0");

export default function MeditationEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const [f, setF] = useState<any>({
    title: "", speaker: "", verse: "", description: "", category: "Generale",
    video_url: "", thumbnail: null, published: false,
  });
  const [schedule, setSchedule] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useFocusEffect(useCallback(() => {
    if (!isNew && id) {
      api.adminMeditation(id).then((d) => {
        setF(d);
        if (d.published && d.publish_date && new Date(d.publish_date).getTime() > Date.now()) {
          setSchedule(true);
          const dt = new Date(d.publish_date);
          setDate(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
          setTime(`${pad(dt.getHours())}:${pad(dt.getMinutes())}`);
        }
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [id]));

  const save = async () => {
    if (!f.title?.trim()) { Alert.alert("Campo obbligatorio", "Inserisci il titolo."); return; }
    let publish_date: string | undefined;
    if (f.published && schedule) {
      const parsed = new Date(`${date}T${time}:00`);
      if (isNaN(parsed.getTime())) { Alert.alert("Data non valida", "Usa il formato AAAA-MM-GG e ora HH:MM."); return; }
      publish_date = parsed.toISOString();
    } else if (f.published) {
      publish_date = new Date().toISOString();
    }
    const payload = {
      title: f.title.trim(), speaker: f.speaker || "", verse: f.verse || "", description: f.description || "",
      category: (f.category || "Generale").trim(), video_url: f.video_url || "", thumbnail: f.thumbnail || null,
      published: !!f.published, ...(publish_date ? { publish_date } : {}),
    };
    setSaving(true);
    try {
      if (isNew) await api.adminCreateMeditation(payload);
      else await api.adminEditMeditation(id!, payload);
      router.back();
    } catch (e: any) {
      Alert.alert("Errore", e.message || "Salvataggio non riuscito");
    } finally { setSaving(false); }
  };

  const remove = () => {
    Alert.alert("Elimina meditazione", "Vuoi eliminare definitivamente questa meditazione?", [
      { text: "Annulla", style: "cancel" },
      { text: "Elimina", style: "destructive", onPress: async () => { await api.adminDeleteMeditation(id!); router.back(); } },
    ]);
  };

  return (
    <AdminShell title={isNew ? "Nuova meditazione" : "Modifica meditazione"} activeKey="meditations">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <AImagePicker testID="med-thumb" label="Miniatura (16:9)" value={f.thumbnail} onChange={(v: string) => set("thumbnail", v)} aspect={[16, 9]} />
          <AInput testID="med-title" label="Titolo *" value={f.title} onChangeText={(v: string) => set("title", v)} placeholder="Titolo della meditazione" />
          <AInput testID="med-speaker" label="Oratore / Autore" value={f.speaker} onChangeText={(v: string) => set("speaker", v)} placeholder="Es. Past. Marco Rossi" />
          <AInput testID="med-verse" label="Versetto biblico (opzionale)" value={f.verse} onChangeText={(v: string) => set("verse", v)} placeholder="Es. Giovanni 3:16" />
          <AInput testID="med-category" label="Categoria" value={f.category} onChangeText={(v: string) => set("category", v)} placeholder="Es. Fede, Grazia, Preghiera" />
          <AInput testID="med-video" label="Video (URL YouTube o link diretto)" value={f.video_url} onChangeText={(v: string) => set("video_url", v)} placeholder="https://youtube.com/watch?v=..." />
          <AInput testID="med-desc" label="Descrizione breve" value={f.description} onChangeText={(v: string) => set("description", v)} multiline placeholder="Una breve descrizione della meditazione" />

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
              <Text style={styles.hint}>{schedule ? "La meditazione diventerà visibile e verrà notificata alla data indicata." : "Verrà pubblicata subito e gli utenti riceveranno una notifica."}</Text>
            </>
          )}
          {!f.published && <Text style={styles.hint}>Salvata come bozza: non visibile agli utenti.</Text>}

          <PressableScale testID="med-save" style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
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
  scheduleRow: { flexDirection: "row", gap: spacing.md },
  hint: { color: ADMIN.muted, fontSize: 13, lineHeight: 19, marginTop: -spacing.xs, marginBottom: spacing.sm },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.lg },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  deleteBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.lg, paddingVertical: spacing.md },
  deleteText: { color: colors.error, fontSize: 15, fontWeight: "700" },
});

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, ASwitch, AImagePicker } from "@/src/components/adminForm";
import { colors, spacing, radius } from "@/src/theme";

export default function PodcastEditor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const [f, setF] = useState<any>({ title: "", subtitle: "", description: "", author: "", category: "", tags: "", artwork: null, audio_url: "", episode_number: "", duration: "", featured: false, published: false });
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!isNew && id) {
      api.podcast(id).then((d) => {
        setF({ ...d, tags: (d.tags || []).join(", "), episode_number: d.episode_number ? String(d.episode_number) : "" });
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [id]);

  const payload = () => ({
    title: f.title, subtitle: f.subtitle, description: f.description, author: f.author,
    category: f.category || "Generale", tags: f.tags ? String(f.tags).split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    artwork: f.artwork, audio_url: f.audio_url,
    episode_number: f.episode_number ? parseInt(f.episode_number, 10) : null,
    duration: f.duration, featured: f.featured, published: f.published,
  });

  const save = async () => {
    if (!f.title?.trim()) { setMsg("Il titolo è obbligatorio"); return; }
    setBusy(true); setMsg("");
    try {
      if (isNew) { const r = await api.adminCreatePodcast(payload()); router.replace(`/admin/podcasts/${r.id}`); }
      else { await api.adminEditPodcast(id!, payload()); setMsg("Salvato"); }
    } catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };

  const del = async () => { setBusy(true); try { await api.adminDeletePodcast(id!); router.back(); } catch (e: any) { setMsg(e.message); setBusy(false); } };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="pod-editor-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
        <Text style={styles.headerTitle}>{isNew ? "Nuovo Podcast" : "Modifica Podcast"}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AImagePicker testID="pod-cover" label="Copertina" value={f.artwork} onChange={(v: string) => set("artwork", v)} aspect={[1, 1]} />
        <AInput label="Titolo *" value={f.title} onChangeText={(v: string) => set("title", v)} />
        <AInput label="Sottotitolo" value={f.subtitle} onChangeText={(v: string) => set("subtitle", v)} />
        <AInput label="Descrizione" value={f.description} onChangeText={(v: string) => set("description", v)} multiline />
        <AInput label="Speaker / Conduttore" value={f.author} onChangeText={(v: string) => set("author", v)} />
        <AInput label="Categoria" value={f.category} onChangeText={(v: string) => set("category", v)} placeholder="Es. Studi Biblici" />
        <AInput label="Tag (separati da virgola)" value={f.tags} onChangeText={(v: string) => set("tags", v)} />
        <AInput label="URL Audio (o carica sotto)" value={f.audio_url} onChangeText={(v: string) => set("audio_url", v)} placeholder="https://.../episodio.mp3" />
        <AInput label="Numero episodio" value={f.episode_number} onChangeText={(v: string) => set("episode_number", v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" />
        <AInput label="Durata" value={f.duration} onChangeText={(v: string) => set("duration", v)} placeholder="Es. 32:14" />
        <ASwitch testID="pod-featured" label="Episodio in evidenza" value={f.featured} onValueChange={(v: boolean) => set("featured", v)} />
        <ASwitch testID="pod-published" label="Pubblicato (attivo = visibile nell'app)" value={f.published} onValueChange={(v: boolean) => set("published", v)} />

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        <PressableScale testID="pod-save" style={[styles.btn, { backgroundColor: colors.brandPrimary }, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.btnText}>{isNew ? "Crea" : "Salva"}</Text>
        </PressableScale>
        {!isNew && (
          <PressableScale testID="pod-delete" style={[styles.btn, { backgroundColor: colors.error, marginTop: spacing.md }]} onPress={del} disabled={busy}>
            <Ionicons name="trash" size={18} color={colors.white} /><Text style={styles.btnText}>Elimina</Text>
          </PressableScale>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ADMIN.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: ADMIN.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginBottom: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

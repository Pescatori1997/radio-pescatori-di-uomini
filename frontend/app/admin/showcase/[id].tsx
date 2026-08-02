import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, ASwitch, AImagePicker } from "@/src/components/adminForm";
import { colors, spacing, radius } from "@/src/theme";

const CATEGORIES = ["IN EVIDENZA", "EVENTO", "MUSICA", "PROGETTO", "INIZIATIVA", "CONTENUTO PROMOSSO"];
const CTA_PRESETS = ["Scopri di più", "Partecipa", "Ascolta", "Visita", "Sostieni"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function Chips({ options, value, onSelect, testIDPrefix }: any) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginBottom: spacing.md }}>
      {options.map((o: string) => {
        const active = (value || "").toLowerCase() === o.toLowerCase();
        return (
          <Pressable key={o} testID={`${testIDPrefix}-${o}`} onPress={() => onSelect(o)} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function ShowcaseEditor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const [f, setF] = useState<any>({ title: "", description: "", image: null, category: "IN EVIDENZA", cta_text: "", cta_url: "", start_date: "", end_date: "", active: true });
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!isNew && id) api.adminShowcaseItem(id).then((d: any) => setF({ ...d, start_date: d.start_date || "", end_date: d.end_date || "" })).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const payload = () => ({
    title: f.title, description: f.description, image: f.image,
    category: f.category || "IN EVIDENZA", cta_text: f.cta_text || "", cta_url: f.cta_url || "",
    start_date: f.start_date?.trim() || null, end_date: f.end_date?.trim() || null,
    active: !!f.active,
  });

  const save = async () => {
    if (!f.title?.trim()) { setMsg("Il titolo è obbligatorio"); return; }
    if (f.start_date?.trim() && !DATE_RE.test(f.start_date.trim())) { setMsg("Data inizio non valida (usa AAAA-MM-GG)"); return; }
    if (f.end_date?.trim() && !DATE_RE.test(f.end_date.trim())) { setMsg("Data fine non valida (usa AAAA-MM-GG)"); return; }
    setBusy(true); setMsg("");
    try {
      if (isNew) { const r = await api.adminCreateShowcase(payload()); router.replace(`/admin/showcase/${r.id}`); }
      else { await api.adminEditShowcase(id!, payload()); setMsg("Salvato"); }
    } catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };

  const del = async () => { setBusy(true); try { await api.adminDeleteShowcase(id!); router.back(); } catch (e: any) { setMsg(e.message); setBusy(false); } };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="showcase-editor-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
        <Text style={styles.headerTitle}>{isNew ? "Nuova Card Vetrina" : "Modifica Card Vetrina"}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AImagePicker testID="showcase-image" label="Immagine di copertina" value={f.image} onChange={(v: string) => set("image", v)} aspect={[16, 9]} />
        <AInput testID="showcase-title" label="Titolo *" value={f.title} onChangeText={(v: string) => set("title", v)} />
        <AInput testID="showcase-desc" label="Descrizione breve" value={f.description} onChangeText={(v: string) => set("description", v)} multiline />

        <Text style={styles.label}>Categoria / etichetta</Text>
        <Chips options={CATEGORIES} value={f.category} onSelect={(v: string) => set("category", v)} testIDPrefix="showcase-cat" />
        <AInput testID="showcase-cat-custom" label="Categoria personalizzata (opzionale)" value={f.category} onChangeText={(v: string) => set("category", v)} placeholder="Es. CONFERENZA" />

        <Text style={styles.label}>Pulsante (CTA)</Text>
        <Chips options={CTA_PRESETS} value={f.cta_text} onSelect={(v: string) => set("cta_text", v)} testIDPrefix="showcase-cta" />
        <AInput testID="showcase-cta-text" label="Testo del pulsante (vuoto = nessun pulsante se manca il link)" value={f.cta_text} onChangeText={(v: string) => set("cta_text", v)} placeholder="Es. Scopri di più" />
        <AInput testID="showcase-cta-url" label="Link del pulsante (https://… o /percorso interno)" value={f.cta_url} onChangeText={(v: string) => set("cta_url", v)} placeholder="https://…" />
        <Text style={styles.note}>Se il link è vuoto, il pulsante non verrà mostrato nella Home.</Text>

        <AInput testID="showcase-start" label="Data inizio pubblicazione (AAAA-MM-GG, opzionale)" value={f.start_date} onChangeText={(v: string) => set("start_date", v)} placeholder="2026-08-10" />
        <AInput testID="showcase-end" label="Data fine/scadenza (AAAA-MM-GG, opzionale)" value={f.end_date} onChangeText={(v: string) => set("end_date", v)} placeholder="2026-08-20" />
        <Text style={styles.note}>Fuori dalla finestra di date la card viene nascosta nella Home ma resta nello storico.</Text>

        <ASwitch testID="showcase-active" label="Attiva (visibile nella Home)" value={f.active} onValueChange={(v: boolean) => set("active", v)} />

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        <PressableScale testID="showcase-save" style={[styles.btn, { backgroundColor: colors.brandPrimary }, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.btnText}>{isNew ? "Crea" : "Salva"}</Text>
        </PressableScale>
        {!isNew && (
          <PressableScale testID="showcase-delete" style={[styles.btn, { backgroundColor: colors.error, marginTop: spacing.md }]} onPress={del} disabled={busy}>
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
  label: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  note: { color: ADMIN.muted, fontSize: 12, marginTop: -6, marginBottom: spacing.md, fontStyle: "italic" },
  chips: { gap: spacing.sm, paddingVertical: 2 },
  chip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: ADMIN.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginBottom: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

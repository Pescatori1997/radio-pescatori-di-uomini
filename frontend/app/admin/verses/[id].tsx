import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, ASwitch } from "@/src/components/adminForm";
import { colors, spacing, radius } from "@/src/theme";

export default function VerseEditor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const [f, setF] = useState<any>({ text: "", reference: "", book: "", chapter: "", verse: "", active: true, meditation: "", reflection: "" });
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [regen, setRegen] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!isNew && id) api.verse(id).then((v: any) => setF({ ...v, chapter: v.chapter?.toString() ?? "", verse: v.verse?.toString() ?? "", meditation: v.meditation ?? "", reflection: v.reflection ?? "" })).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const payload = () => ({
    text: f.text?.trim(),
    reference: f.reference?.trim(),
    book: f.book?.trim() || null,
    chapter: f.chapter ? parseInt(f.chapter, 10) : null,
    verse: f.verse ? parseInt(f.verse, 10) : null,
    active: f.active,
    meditation: f.meditation ?? "",
    reflection: f.reflection ?? "",
  });

  const save = async () => {
    if (!f.text?.trim()) { setMsg("Il testo del versetto è obbligatorio"); return; }
    if (!f.reference?.trim()) { setMsg("Il riferimento è obbligatorio (es. Giovanni 3:16)"); return; }
    setBusy(true); setMsg("");
    try {
      if (isNew) { const r = await api.adminCreateVerse(payload()); router.replace(`/admin/verses/${r.id}`); }
      else { await api.adminEditVerse(id!, payload()); setMsg("Salvato"); }
    } catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };

  const regenerate = async () => {
    if (isNew) { setMsg("Salva prima il versetto, poi genera la meditazione"); return; }
    setRegen(true); setMsg("");
    try {
      const r = await api.adminRegenerateMeditation(id!);
      set("meditation", r.meditation);
      set("reflection", r.reflection);
      setMsg("Meditazione rigenerata (ricordati di salvare per bloccarla)");
    } catch (e: any) { setMsg(e.message || "Errore nella generazione"); } finally { setRegen(false); }
  };

  const del = async () => { setBusy(true); try { await api.adminDeleteVerse(id!); router.back(); } catch (e: any) { setMsg(e.message); setBusy(false); } };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="verse-editor-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
        <Text style={styles.headerTitle}>{isNew ? "Nuovo Versetto" : "Modifica Versetto"}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AInput testID="verse-text" label="Testo del versetto *" value={f.text} onChangeText={(v: string) => set("text", v)} multiline />
        <AInput testID="verse-ref" label="Riferimento * (es. Giovanni 3:16)" value={f.reference} onChangeText={(v: string) => set("reference", v)} />
        <AInput label="Libro (es. Giovanni)" value={f.book} onChangeText={(v: string) => set("book", v)} placeholder="Usato per aprire il contesto" />
        <View style={styles.rowInputs}>
          <View style={{ flex: 1 }}><AInput label="Capitolo" value={f.chapter} onChangeText={(v: string) => set("chapter", v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><AInput label="Versetto" value={f.verse} onChangeText={(v: string) => set("verse", v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" /></View>
        </View>
        <ASwitch testID="verse-active" label="Attivo (incluso nella rotazione giornaliera)" value={f.active} onValueChange={(v: boolean) => set("active", v)} />

        {!isNew && (
          <View style={styles.medSection}>
            <View style={styles.medHead}>
              <Text style={styles.medTitle}>Meditazione di oggi</Text>
              <PressableScale testID="verse-regen" style={[styles.regenBtn, regen && { opacity: 0.6 }]} onPress={regenerate} disabled={regen || busy}>
                {regen ? <ActivityIndicator color={colors.brandPrimary} size="small" /> : <Ionicons name="sparkles" size={16} color={colors.brandPrimary} />}
                <Text style={styles.regenText}>{regen ? "Genero…" : "Genera con AI"}</Text>
              </PressableScale>
            </View>
            <Text style={styles.medHint}>Generata automaticamente dall'AI e modificabile. Le tue modifiche manuali hanno priorità e non vengono sovrascritte.</Text>
            <AInput testID="verse-meditation" label="Testo della meditazione" value={f.meditation} onChangeText={(v: string) => set("meditation", v)} multiline />
            <AInput testID="verse-reflection" label="Frase / domanda di riflessione" value={f.reflection} onChangeText={(v: string) => set("reflection", v)} multiline />
          </View>
        )}

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        <PressableScale testID="verse-save" style={[styles.btn, { backgroundColor: colors.brandPrimary }, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.btnText}>{isNew ? "Crea" : "Salva"}</Text>
        </PressableScale>
        {!isNew && (
          <PressableScale testID="verse-delete" style={[styles.btn, { backgroundColor: colors.error, marginTop: spacing.md }]} onPress={del} disabled={busy}>
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
  rowInputs: { flexDirection: "row", gap: spacing.md },
  medSection: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: ADMIN.border },
  medHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  medTitle: { color: colors.white, fontSize: 16, fontWeight: "800" },
  regenBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandPrimary + "22", borderWidth: 1, borderColor: colors.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill },
  regenText: { color: colors.brandSecondary, fontSize: 13, fontWeight: "800" },
  medHint: { color: ADMIN.muted, fontSize: 12.5, lineHeight: 18, marginTop: 6, marginBottom: spacing.sm },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginBottom: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

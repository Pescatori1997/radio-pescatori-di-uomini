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
  const [f, setF] = useState<any>({ text: "", reference: "", book: "", chapter: "", verse: "", active: true });
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!isNew && id) api.verse(id).then((v: any) => setF({ ...v, chapter: v.chapter?.toString() ?? "", verse: v.verse?.toString() ?? "" })).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const payload = () => ({
    text: f.text?.trim(),
    reference: f.reference?.trim(),
    book: f.book?.trim() || null,
    chapter: f.chapter ? parseInt(f.chapter, 10) : null,
    verse: f.verse ? parseInt(f.verse, 10) : null,
    active: f.active,
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
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginBottom: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

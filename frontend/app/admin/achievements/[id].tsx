import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, ASwitch, AImagePicker } from "@/src/components/adminForm";
import { confirmAsync, alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

const TIERS = [
  { key: "bronze", label: "Bronzo", color: "#CD7F32" },
  { key: "silver", label: "Argento", color: "#AEB6C2" },
  { key: "gold", label: "Oro", color: "#E0B23C" },
];
const METRICS = [
  { key: "plans", label: "Piani completati" },
  { key: "podcasts", label: "Podcast ascoltati" },
  { key: "meditations", label: "Meditazioni" },
  { key: "verses", label: "Versetti salvati" },
  { key: "manual", label: "Assegnazione manuale" },
];

export default function AchievementEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const [f, setF] = useState<any>({ category: "Generale", tier: "bronze", title: "", description: "", metric: "manual", threshold: 1, back_label: "", emoji: "🎖️", image: null, active: true });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");

  const load = useCallback(() => {
    if (isNew) return;
    api.adminAchievementItem(id as string).then((d: any) => setF(d)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!f.title?.trim()) { alertMessage("Titolo mancante", "Inserisci un titolo per la medaglia."); return; }
    setSaving(true);
    try {
      const body = {
        category: f.category?.trim() || "Generale", tier: f.tier, title: f.title.trim(),
        description: f.description || "", metric: f.metric, threshold: Number(f.threshold) || 1,
        back_label: f.back_label || "", emoji: f.emoji || "🎖️", image: f.image || null, active: f.active !== false,
      };
      if (isNew) { await api.adminCreateAchievement(body); }
      else { await api.adminEditAchievement(id as string, body); }
      router.back();
    } catch { alertMessage("Errore", "Impossibile salvare la medaglia."); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    const ok = await confirmAsync("Elimina traguardo", `Vuoi eliminare "${f.title}"? Lo storico degli utenti verrà rimosso.`, "Elimina", true);
    if (!ok) return;
    try { await api.adminDeleteAchievement(id as string); router.back(); } catch { alertMessage("Errore", "Impossibile eliminare."); }
  };

  const assign = async (grant: boolean) => {
    const email = assignEmail.trim().toLowerCase();
    if (!email) { alertMessage("Email mancante", "Inserisci l'email dell'utente."); return; }
    try {
      if (grant) await api.adminAssignAchievement(id as string, email);
      else await api.adminUnassignAchievement(id as string, email);
      alertMessage("Fatto", grant ? "Medaglia assegnata." : "Medaglia revocata.");
      setAssignEmail("");
    } catch { alertMessage("Errore", "Utente non trovato o operazione non riuscita."); }
  };

  if (loading) {
    return <AdminShell title="Traguardo" activeKey="achievements"><View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View></AdminShell>;
  }

  return (
    <AdminShell title={isNew ? "Nuovo Traguardo" : "Modifica Traguardo"} activeKey="achievements">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        <AInput label="Titolo" value={f.title} onChangeText={(t: string) => set("title", t)} placeholder="Es. Primo Piano Completato" testID="ach-title" />
        <AInput label="Categoria" value={f.category} onChangeText={(t: string) => set("category", t)} placeholder="Es. Piani Biblici" testID="ach-category" />

        <Text style={styles.label}>Livello</Text>
        <View style={styles.chipRow}>
          {TIERS.map((t) => (
            <PressableScale key={t.key} style={[styles.chip, f.tier === t.key && { backgroundColor: t.color, borderColor: t.color }]} onPress={() => set("tier", t.key)}>
              <Text style={[styles.chipText, f.tier === t.key && { color: "#1B1206" }]}>{t.label}</Text>
            </PressableScale>
          ))}
        </View>

        <Text style={styles.label}>Requisito di sblocco</Text>
        <View style={styles.chipRow}>
          {METRICS.map((m) => (
            <PressableScale key={m.key} style={[styles.chip, f.metric === m.key && styles.chipActive]} onPress={() => set("metric", m.key)}>
              <Text style={[styles.chipText, f.metric === m.key && styles.chipTextActive]}>{m.label}</Text>
            </PressableScale>
          ))}
        </View>

        {f.metric !== "manual" && (
          <AInput label="Soglia (quantità richiesta)" value={String(f.threshold ?? 1)} onChangeText={(t: string) => set("threshold", t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" testID="ach-threshold" />
        )}

        <AInput label="Emoji (opzionale)" value={f.emoji} onChangeText={(t: string) => set("emoji", t)} placeholder="🎖️" testID="ach-emoji" />
        <AInput label="Descrizione (fronte/retro)" value={f.description} onChangeText={(t: string) => set("description", t)} multiline placeholder="Cosa racconta questa medaglia" testID="ach-desc" />
        <AInput label="Etichetta statistica (retro)" value={f.back_label} onChangeText={(t: string) => set("back_label", t)} placeholder="Es. Piani completati" testID="ach-back" />
        <AImagePicker label="Immagine personalizzata (opzionale, sostituisce il logo)" value={f.image} onChange={(v: string) => set("image", v)} testID="ach-image" />
        <ASwitch label="Attiva (visibile agli utenti)" value={f.active !== false} onValueChange={(v: boolean) => set("active", v)} testID="ach-active" />

        <PressableScale testID="ach-save" style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>{isNew ? "Crea traguardo" : "Salva modifiche"}</Text>}
        </PressableScale>

        {!isNew && (
          <>
            <View style={styles.assignBox}>
              <Text style={styles.assignTitle}>Assegna / Revoca manualmente</Text>
              <Text style={styles.assignSub}>Concedi questa medaglia a un utente tramite email (lo storico viene mantenuto).</Text>
              <TextInput value={assignEmail} onChangeText={setAssignEmail} placeholder="email@utente.it" placeholderTextColor={ADMIN.muted} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
              <View style={styles.assignRow}>
                <PressableScale style={[styles.assignBtn, { backgroundColor: colors.success }]} onPress={() => assign(true)}><Text style={styles.assignBtnText}>Assegna</Text></PressableScale>
                <PressableScale style={[styles.assignBtn, { backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border }]} onPress={() => assign(false)}><Text style={[styles.assignBtnText, { color: colors.white }]}>Revoca</Text></PressableScale>
              </View>
            </View>

            <PressableScale testID="ach-delete" style={styles.deleteBtn} onPress={remove}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={styles.deleteText}>Elimina traguardo</Text>
            </PressableScale>
          </>
        )}
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  label: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  saveBtn: { backgroundColor: colors.brandPrimary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md },
  saveBtnText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  assignBox: { backgroundColor: ADMIN.surface, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.xl, borderWidth: 1, borderColor: ADMIN.border },
  assignTitle: { color: colors.white, fontSize: 15, fontWeight: "800" },
  assignSub: { color: ADMIN.muted, fontSize: 12.5, marginTop: 4, marginBottom: spacing.md, lineHeight: 18 },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.white, borderWidth: 1, borderColor: ADMIN.border },
  assignRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  assignBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
  assignBtnText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error },
  deleteText: { color: colors.error, fontSize: 15, fontWeight: "800" },
});

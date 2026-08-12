import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, ASwitch } from "@/src/components/adminForm";
import { DEFAULT_DONATE, mergeDonate, DonateConfig, MonthlyPlan } from "@/src/donateConfig";
import { colors, spacing, radius } from "@/src/theme";

export default function AdminDonateConfig() {
  const [c, setC] = useState<DonateConfig>(DEFAULT_DONATE);
  const [presetsStr, setPresetsStr] = useState(DEFAULT_DONATE.presets.join(", "));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    api.adminSettings().then((d: any) => {
      const merged = mergeDonate(d.donate_config);
      setC(merged);
      setPresetsStr(merged.presets.join(", "));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setF = (k: keyof DonateConfig, v: any) => setC((p) => ({ ...p, [k]: v }));
  const setPlan = (i: number, k: keyof MonthlyPlan, v: string) =>
    setC((p) => ({ ...p, monthly_plans: p.monthly_plans.map((pl, idx) => (idx === i ? { ...pl, [k]: v } : pl)) }));
  const addPlan = () => setC((p) => ({ ...p, monthly_plans: [...p.monthly_plans, { plan: "15", label: "15€", desc: "" }] }));
  const delPlan = (i: number) => setC((p) => ({ ...p, monthly_plans: p.monthly_plans.filter((_, idx) => idx !== i) }));

  const save = async () => {
    setBusy(true); setMsg(null);
    const presets = presetsStr.split(",").map((s) => parseFloat(s.trim().replace(",", "."))).filter((n) => n > 0);
    const donate_config: DonateConfig = {
      ...c,
      presets: presets.length ? presets : DEFAULT_DONATE.presets,
      default_amount: Number(c.default_amount) || DEFAULT_DONATE.default_amount,
      monthly_plans: c.monthly_plans
        .filter((p) => String(p.plan).trim())
        .map((p) => ({ plan: String(p.plan).trim(), label: p.label || `${p.plan}€`, desc: p.desc || "" })),
    };
    try {
      await api.adminUpdateSettings({ donate_config });
      setMsg({ t: "Sezione Sostieni salvata ✓", ok: true });
    } catch (e: any) {
      setMsg({ t: e.message || "Errore", ok: false });
    } finally { setBusy(false); }
  };

  return (
    <AdminShell title="Sostieni il Progetto" activeKey="donate_config">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 90 }} keyboardShouldPersistTaps="handled">
          <View style={styles.info}>
            <Ionicons name="information-circle" size={18} color={colors.brandSecondary} />
            <Text style={styles.infoText}>Personalizza testi, importi e offerte mensili della pagina "Sostieni il Progetto". Gli importi mensili accettano qualsiasi valore in euro.</Text>
          </View>

          <Text style={styles.section}>Testi</Text>
          <AInput testID="dc-title" label="Titolo" value={c.title} onChangeText={(v: string) => setF("title", v)} />
          <AInput testID="dc-subtitle" label="Sottotitolo" value={c.subtitle} onChangeText={(v: string) => setF("subtitle", v)} />
          <AInput testID="dc-body" label="Descrizione" value={c.body} onChangeText={(v: string) => setF("body", v)} multiline />
          <AInput testID="dc-amounts-title" label="Titolo sezione importi" value={c.amounts_title} onChangeText={(v: string) => setF("amounts_title", v)} />
          <AInput testID="dc-message-title" label="Titolo sezione messaggio" value={c.message_title} onChangeText={(v: string) => setF("message_title", v)} />
          <AInput testID="dc-secure" label="Nota pagamento sicuro" value={c.secure_note} onChangeText={(v: string) => setF("secure_note", v)} multiline />

          <Text style={styles.section}>Importi una tantum</Text>
          <AInput testID="dc-presets" label="Importi rapidi (separati da virgola)" value={presetsStr} onChangeText={setPresetsStr} placeholder="5, 10, 25, 50, 100" keyboardType="numbers-and-punctuation" />
          <AInput testID="dc-default" label="Importo predefinito" value={String(c.default_amount)} onChangeText={(v: string) => setF("default_amount", v.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" />

          <Text style={styles.section}>Offerte mensili</Text>
          <ASwitch testID="dc-monthly-enabled" label="Mostra offerte mensili" value={c.monthly_enabled} onValueChange={(v: boolean) => setF("monthly_enabled", v)} />
          {c.monthly_enabled && (
            <>
              <AInput testID="dc-monthly-title" label="Titolo box mensile" value={c.monthly_title} onChangeText={(v: string) => setF("monthly_title", v)} />
              <AInput testID="dc-monthly-sub" label="Descrizione box mensile" value={c.monthly_sub} onChangeText={(v: string) => setF("monthly_sub", v)} multiline />
              {c.monthly_plans.map((p, i) => (
                <View key={i} style={styles.planCard}>
                  <View style={styles.planHead}>
                    <Text style={styles.planIdx}>Piano {i + 1}</Text>
                    <PressableScale testID={`dc-plan-del-${i}`} onPress={() => delPlan(i)} style={styles.delBtn}><Ionicons name="trash" size={16} color={colors.error} /></PressableScale>
                  </View>
                  <View style={styles.planRow}>
                    <View style={{ width: 90 }}>
                      <Text style={styles.miniLabel}>Importo €</Text>
                      <TextInput testID={`dc-plan-amount-${i}`} value={String(p.plan)} onChangeText={(v) => setPlan(i, "plan", v.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" style={styles.miniInput} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>Etichetta</Text>
                      <TextInput testID={`dc-plan-label-${i}`} value={p.label} onChangeText={(v) => setPlan(i, "label", v)} placeholder="10€" placeholderTextColor={ADMIN.muted} style={styles.miniInput} />
                    </View>
                  </View>
                  <Text style={styles.miniLabel}>Descrizione</Text>
                  <TextInput testID={`dc-plan-desc-${i}`} value={p.desc} onChangeText={(v) => setPlan(i, "desc", v)} placeholder="Descrizione breve" placeholderTextColor={ADMIN.muted} style={styles.miniInput} />
                </View>
              ))}
              <PressableScale testID="dc-plan-add" onPress={addPlan} style={styles.addBtn}>
                <Ionicons name="add" size={18} color={colors.white} /><Text style={styles.addText}>Aggiungi piano mensile</Text>
              </PressableScale>
            </>
          )}

          {msg && (
            <View style={[styles.toast, { backgroundColor: (msg.ok ? colors.success : colors.error) + "22", borderColor: msg.ok ? colors.success : colors.error }]}>
              <Ionicons name={msg.ok ? "checkmark-circle" : "alert-circle"} size={18} color={msg.ok ? colors.success : colors.error} />
              <Text style={[styles.toastText, { color: msg.ok ? colors.success : colors.error }]}>{msg.t}</Text>
            </View>
          )}
          <PressableScale testID="dc-save" onPress={save} disabled={busy} style={[styles.saveBtn, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Salva sezione</Text>}
          </PressableScale>
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  info: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brandPrimary + "12", padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  infoText: { flex: 1, color: colors.brandSecondary, fontSize: 13, lineHeight: 18 },
  section: { color: colors.white, fontSize: 16, fontWeight: "800", marginTop: spacing.lg, marginBottom: spacing.md },
  planCard: { backgroundColor: ADMIN.card, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border, padding: spacing.md, marginBottom: spacing.md },
  planHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  planIdx: { color: colors.white, fontSize: 14, fontWeight: "800" },
  delBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.error + "22", alignItems: "center", justifyContent: "center" },
  planRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm },
  miniLabel: { color: ADMIN.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  miniInput: { backgroundColor: ADMIN.surface, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: ADMIN.border, marginBottom: 6 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.xs },
  addText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  toast: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.lg, marginBottom: spacing.md },
  toastText: { fontSize: 14, fontWeight: "700", flex: 1 },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.sm },
  saveText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});

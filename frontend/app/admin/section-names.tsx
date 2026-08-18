import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { useSettings } from "@/src/context/SettingsContext";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput } from "@/src/components/adminForm";
import { LABEL_CATALOG } from "@/src/utils/labels";
import { colors, spacing, radius } from "@/src/theme";

// Group the catalog for a tidy editor.
const GROUPS: string[] = Array.from(new Set(LABEL_CATALOG.map((l) => l.group)));

export default function AdminSectionNames() {
  const { refresh } = useSettings();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api.adminSettings().then((s: any) => setLabels(s.section_labels || {})).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (key: string, v: string) => setLabels((p) => ({ ...p, [key]: v }));

  const save = async () => {
    setBusy(true); setMsg("");
    // Drop empty overrides so defaults apply.
    const clean: Record<string, string> = {};
    Object.entries(labels).forEach(([k, v]) => { if (v && String(v).trim()) clean[k] = String(v).trim(); });
    try { await api.adminUpdateSettings({ section_labels: clean }); refresh(); setMsg("Nomi salvati ✓ Attivi subito nell'app."); }
    catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };

  return (
    <AdminShell title="Nomi delle sezioni" activeKey="section_names">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Rinomina le sezioni dell'app: menu del profilo, categorie della Biblioteca e titoli. Lascia un campo vuoto per usare il nome predefinito. Le modifiche sono attive subito, senza nuovo deploy.
          </Text>

          {GROUPS.map((g) => (
            <View key={g} style={styles.card}>
              <Text style={styles.cardTitle}>{g}</Text>
              {LABEL_CATALOG.filter((l) => l.group === g).map((l) => (
                <AInput key={l.key} testID={`label-${l.key}`} label={l.def} value={labels[l.key] ?? ""} onChangeText={(v: string) => set(l.key, v)} placeholder={l.def} />
              ))}
            </View>
          ))}

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          <PressableScale testID="section-names-save" style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
            <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.saveText}>Salva</Text>
          </PressableScale>
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: ADMIN.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  card: { backgroundColor: ADMIN.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: ADMIN.border, padding: spacing.md, marginBottom: spacing.md },
  cardTitle: { color: colors.white, fontSize: 16, fontWeight: "800", marginBottom: spacing.sm },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginVertical: spacing.md },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, marginTop: spacing.md },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

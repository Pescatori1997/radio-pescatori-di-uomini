import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AdminShell from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { api } from "@/src/api";
import { alertMessage } from "@/src/utils/confirm";
import { SITE_TEXT_SCHEMA } from "@/src/siteTexts";
import { colors, spacing, radius } from "@/src/theme";

const ADMIN = { bg: "#0B1220", card: "#111C2E", border: "#1E2A3E", muted: "#94A3B8", inputBg: "#0E1728" };

type TextsState = Record<string, Record<string, string>>;

export default function AdminSiteTexts() {
  const [texts, setTexts] = useState<TextsState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d: any = await api.siteSettings();
      setTexts((d?.texts as TextsState) || {});
    } catch {
      setTexts({});
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setField = (group: string, key: string, value: string) => {
    setTexts((prev) => ({ ...prev, [group]: { ...(prev[group] || {}), [key]: value } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      // Send only the two managed groups; deep-merge on the server preserves the rest.
      await api.adminUpdateSiteSettings({ texts: { home: texts.home || {}, player: texts.player || {} } });
      alertMessage("Salvato", "I testi sono stati aggiornati. Riapri l'app per vederli ovunque.");
    } catch (e: any) {
      alertMessage("Errore", e?.message || "Impossibile salvare i testi.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminShell title="Testi del sito" activeKey="site">
        <View style={styles.center}><ActivityIndicator color={colors.brandSecondary} size="large" /></View>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Testi del sito" activeKey="site">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <MaterialCommunityIcons name="format-text" size={20} color={colors.brandSecondary} />
          <Text style={styles.introText}>
            Modifica i testi visibili nell'app. Lascia un campo vuoto per usare il testo predefinito (mostrato come suggerimento). Le modifiche non toccano il resto dell'app.
          </Text>
        </View>

        {SITE_TEXT_SCHEMA.map((g) => (
          <View key={g.group} style={styles.group}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            {!!g.hint && <Text style={styles.groupHint}>{g.hint}</Text>}
            {g.fields.map((f) => (
              <View key={f.key} style={styles.field}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput
                  testID={`site-text-${g.group}-${f.key}`}
                  style={[styles.input, f.multiline && styles.inputMulti]}
                  value={texts[g.group]?.[f.key] ?? ""}
                  onChangeText={(v) => setField(g.group, f.key, v)}
                  placeholder={f.default}
                  placeholderTextColor={ADMIN.muted}
                  multiline={f.multiline}
                />
              </View>
            ))}
          </View>
        ))}

        <PressableScale testID="site-texts-save" style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saving ? undefined : save}>
          {saving ? <ActivityIndicator color={colors.navy} /> : (
            <>
              <MaterialCommunityIcons name="content-save" size={20} color={colors.navy} />
              <Text style={styles.saveText}>Salva testi</Text>
            </>
          )}
        </PressableScale>
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  intro: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brandPrimary + "12", padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  introText: { flex: 1, color: colors.brandSecondary, fontSize: 13, lineHeight: 18 },
  group: { marginBottom: spacing.xl },
  groupTitle: { color: colors.white, fontSize: 18, fontWeight: "800", marginBottom: 2 },
  groupHint: { color: ADMIN.muted, fontSize: 12.5, lineHeight: 17, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: { color: ADMIN.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: ADMIN.inputBg, borderWidth: 1, borderColor: ADMIN.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.white, fontSize: 15 },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandSecondary, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.md },
  saveText: { color: colors.navy, fontSize: 16, fontWeight: "800" },
});

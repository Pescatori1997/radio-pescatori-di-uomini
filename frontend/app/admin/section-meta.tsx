import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useSettings } from "@/src/context/SettingsContext";
import { useSiteText } from "@/src/context/SiteTextsContext";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, ASwitch, AImagePicker } from "@/src/components/adminForm";
import { SECTION_META_CATALOG } from "@/src/sectionMeta";
import { alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

type MetaState = Record<string, { name?: string; subtitle?: string; description?: string; image?: string }>;

export default function AdminSectionMeta() {
  const { refresh: refreshSettings } = useSettings();
  const { refresh: refreshTexts } = useSiteText();
  const [meta, setMeta] = useState<MetaState>({});
  const [vis, setVis] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const [site, settings]: any = await Promise.all([api.siteSettings(), api.adminSettings()]);
      setMeta((site?.sections as MetaState) || {});
      setVis((settings?.section_visibility as Record<string, boolean>) || {});
    } catch {
      // keep empties -> fallbacks apply
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setField = (key: string, field: string, value: string) =>
    setMeta((p) => ({ ...p, [key]: { ...(p[key] || {}), [field]: value } }));

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      // 1) Section metadata (name/subtitle/description/image) -> site_settings.sections
      await api.adminUpdateSiteSettings({ sections: meta });
      // 2) Visibility -> existing GeneralSettings.section_visibility (single source of truth)
      await api.adminUpdateSettings({ section_visibility: vis });
      refreshSettings();
      refreshTexts();
      setMsg("Salvato ✓ Attivo subito. Riapri l'app per vederlo ovunque.");
    } catch (e: any) {
      setMsg(e?.message || "Errore durante il salvataggio.");
      alertMessage("Errore", e?.message || "Impossibile salvare.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AdminShell title="Metadati sezione" activeKey="site">
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Metadati sezione" activeKey="site">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Personalizza nome, sottotitolo, descrizione, immagine e visibilità di ogni sezione. Lascia un campo vuoto per usare il valore predefinito (mostrato come suggerimento). L'ordine delle sezioni si gestisce in <Text style={styles.b}>Layout Home</Text> e <Text style={styles.b}>Navigazione</Text>.
        </Text>

        {SECTION_META_CATALOG.map((s) => {
          const m = meta[s.key] || {};
          const visible = s.visKey ? vis[s.visKey] !== false : undefined;
          return (
            <View key={s.key} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{s.label}</Text>
                {s.visKey && (
                  <View style={styles.visPill}>
                    <Ionicons name={visible ? "eye" : "eye-off"} size={14} color={visible ? colors.success : colors.muted} />
                    <Text style={[styles.visPillText, { color: visible ? colors.success : colors.muted }]}>{visible ? "Visibile" : "Nascosta"}</Text>
                  </View>
                )}
              </View>
              {!!s.hint && <Text style={styles.hint}>{s.hint}</Text>}

              {s.supportsName !== false && (
                <AInput testID={`meta-name-${s.key}`} label="Nome visualizzato" value={m.name ?? ""} onChangeText={(v: string) => setField(s.key, "name", v)} placeholder={s.defaultName} />
              )}

              {s.supportsSubtitle && (
                <AInput testID={`meta-subtitle-${s.key}`} label="Sottotitolo" value={m.subtitle ?? ""} onChangeText={(v: string) => setField(s.key, "subtitle", v)} placeholder={s.defaultSubtitle || "(nessuno)"} />
              )}
              {s.supportsDescription && (
                <AInput testID={`meta-desc-${s.key}`} label="Descrizione" value={m.description ?? ""} onChangeText={(v: string) => setField(s.key, "description", v)} placeholder="(nessuna)" multiline />
              )}
              {s.supportsImage && (
                <AImagePicker testID={`meta-image-${s.key}`} label="Copertina (opzionale)" value={m.image ?? ""} onChange={(v: string) => setField(s.key, "image", v)} aspect={[16, 9]} />
              )}
              {s.supportsImage && !!m.image && (
                <PressableScale testID={`meta-image-clear-${s.key}`} style={styles.clearBtn} onPress={() => setField(s.key, "image", "")}>
                  <Ionicons name="trash-outline" size={15} color={colors.error} />
                  <Text style={styles.clearText}>Rimuovi copertina</Text>
                </PressableScale>
              )}

              {s.visKey && (
                <ASwitch testID={`meta-vis-${s.key}`} label="Sezione visibile" value={visible} onValueChange={(val: boolean) => setVis((p) => ({ ...p, [s.visKey as string]: val }))} />
              )}
            </View>
          );
        })}

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        <PressableScale testID="section-meta-save" style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={busy ? undefined : save}>
          {busy ? <ActivityIndicator color={colors.white} /> : (<><Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.saveText}>Salva</Text></>)}
        </PressableScale>
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: ADMIN.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  b: { color: colors.brandSecondary, fontWeight: "800" },
  card: { backgroundColor: ADMIN.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: ADMIN.border, padding: spacing.md, marginBottom: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  cardTitle: { color: colors.white, fontSize: 16, fontWeight: "800" },
  visPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  visPillText: { fontSize: 12, fontWeight: "700" },
  hint: { color: ADMIN.muted, fontSize: 12, lineHeight: 16, marginBottom: spacing.sm },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: spacing.md, marginTop: -spacing.xs },
  clearText: { color: colors.error, fontSize: 13, fontWeight: "700" },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginVertical: spacing.md },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, marginTop: spacing.md },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { useSettings } from "@/src/context/SettingsContext";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";
import { HOME_SECTIONS, mergeHomeLayout, HomeSectionCfg, HomeWidth, HomeSize } from "@/src/homeLayout";

const LABELS: Record<string, string> = Object.fromEntries(HOME_SECTIONS.map((s) => [s.key, s.label]));
const WIDTHS: { key: HomeWidth; label: string }[] = [
  { key: "full", label: "Intera" },
  { key: "half", label: "Metà" },
];
const SIZES: { key: HomeSize; label: string }[] = [
  { key: "compact", label: "Compatta" },
  { key: "normal", label: "Normale" },
  { key: "large", label: "Grande" },
];

export default function AdminHomeLayout() {
  const { refresh } = useSettings();
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [itemsMobile, setItemsMobile] = useState<HomeSectionCfg[]>([]);
  const [itemsDesktop, setItemsDesktop] = useState<HomeSectionCfg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const items = device === "mobile" ? itemsMobile : itemsDesktop;
  const setItems = device === "mobile" ? setItemsMobile : setItemsDesktop;

  const load = useCallback(() => {
    api.adminSettings().then((d: any) => {
      setItemsMobile(mergeHomeLayout(d.home_layout));
      setItemsDesktop(mergeHomeLayout(d.home_layout_desktop ?? d.home_layout));
    }).catch(() => {
      setItemsMobile(mergeHomeLayout(null));
      setItemsDesktop(mergeHomeLayout(null));
    }).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const move = (i: number, dir: -1 | 1) => {
    setItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = prev.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };
  const setField = (i: number, key: "width" | "size", val: any) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));

  const copyFromMobile = () => { setItemsDesktop(itemsMobile.map((it) => ({ ...it }))); setMsg({ t: "Copiato da Mobile ✓", ok: true }); };

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await api.adminUpdateSettings({ home_layout: itemsMobile, home_layout_desktop: itemsDesktop });
      refresh();
      setMsg({ t: "Layout Home salvato ✓", ok: true });
    } catch (e: any) {
      setMsg({ t: e.message || "Errore", ok: false });
    } finally { setBusy(false); }
  };

  return (
    <AdminShell title="Layout Home" activeKey="home_layout">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 90 }}>
          <View style={styles.info}>
            <Ionicons name="information-circle" size={18} color={colors.brandSecondary} />
            <Text style={styles.infoText}>Personalizza ordine, larghezza e dimensione delle sezioni della Home. Le impostazioni sono separate per Mobile e Desktop: l'app mostra automaticamente la versione giusta in base allo schermo. Due sezioni "Metà" consecutive vengono affiancate. La visibilità ON/OFF si gestisce da Impostazioni.</Text>
          </View>

          <View style={styles.deviceRow}>
            {([["mobile", "Mobile", "phone-portrait"], ["desktop", "Desktop", "desktop"]] as const).map(([k, lbl, ic]) => (
              <PressableScale key={k} testID={`hl-device-${k}`} onPress={() => setDevice(k)} style={[styles.deviceBtn, device === k && styles.deviceOn]}>
                <Ionicons name={ic as any} size={16} color={device === k ? colors.white : ADMIN.muted} />
                <Text style={[styles.deviceText, device === k && styles.deviceTextOn]}>{lbl}</Text>
              </PressableScale>
            ))}
          </View>
          {device === "desktop" && (
            <PressableScale testID="hl-copy-mobile" onPress={copyFromMobile} style={styles.copyBtn}>
              <Ionicons name="copy-outline" size={15} color={colors.brandSecondary} />
              <Text style={styles.copyText}>Copia impostazioni da Mobile</Text>
            </PressableScale>
          )}

          {items.map((it, i) => (
            <View key={it.key} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={1}>{LABELS[it.key] || it.key}</Text>
                <View style={styles.orderBtns}>
                  <PressableScale testID={`hl-up-${it.key}`} disabled={i === 0} onPress={() => move(i, -1)} style={[styles.orderBtn, i === 0 && styles.orderOff]}>
                    <Ionicons name="chevron-up" size={20} color={i === 0 ? ADMIN.muted : colors.white} />
                  </PressableScale>
                  <PressableScale testID={`hl-down-${it.key}`} disabled={i === items.length - 1} onPress={() => move(i, 1)} style={[styles.orderBtn, i === items.length - 1 && styles.orderOff]}>
                    <Ionicons name="chevron-down" size={20} color={i === items.length - 1 ? ADMIN.muted : colors.white} />
                  </PressableScale>
                </View>
              </View>

              <Text style={styles.rowLabel}>Larghezza</Text>
              <View style={styles.seg}>
                {WIDTHS.map((w) => (
                  <PressableScale key={w.key} testID={`hl-w-${it.key}-${w.key}`} onPress={() => setField(i, "width", w.key)}
                    style={[styles.segBtn, it.width === w.key && styles.segOn]}>
                    <Text style={[styles.segText, it.width === w.key && styles.segTextOn]}>{w.label}</Text>
                  </PressableScale>
                ))}
              </View>

              <Text style={styles.rowLabel}>Dimensione</Text>
              <View style={styles.seg}>
                {SIZES.map((s) => (
                  <PressableScale key={s.key} testID={`hl-s-${it.key}-${s.key}`} onPress={() => setField(i, "size", s.key)}
                    style={[styles.segBtn, it.size === s.key && styles.segOn]}>
                    <Text style={[styles.segText, it.size === s.key && styles.segTextOn]}>{s.label}</Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          ))}

          {msg && (
            <View style={[styles.toast, { backgroundColor: (msg.ok ? colors.success : colors.error) + "22", borderColor: msg.ok ? colors.success : colors.error }]}>
              <Ionicons name={msg.ok ? "checkmark-circle" : "alert-circle"} size={18} color={msg.ok ? colors.success : colors.error} />
              <Text style={[styles.toastText, { color: msg.ok ? colors.success : colors.error }]}>{msg.t}</Text>
            </View>
          )}

          <PressableScale testID="hl-save" onPress={save} disabled={busy} style={[styles.saveBtn, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Salva layout</Text>}
          </PressableScale>
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  info: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brandPrimary + "12", padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  infoText: { flex: 1, color: colors.brandSecondary, fontSize: 13, lineHeight: 18 },
  deviceRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  deviceBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, borderRadius: radius.md, backgroundColor: ADMIN.card, borderWidth: 1.5, borderColor: ADMIN.border },
  deviceOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  deviceText: { color: ADMIN.muted, fontSize: 14, fontWeight: "800" },
  deviceTextOn: { color: colors.white },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6, marginBottom: spacing.sm },
  copyText: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700" },
  card: { backgroundColor: ADMIN.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border, marginBottom: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  cardTitle: { color: colors.white, fontSize: 16, fontWeight: "800", flex: 1, marginRight: spacing.sm },
  orderBtns: { flexDirection: "row", gap: 6 },
  orderBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: ADMIN.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: ADMIN.border },
  orderOff: { opacity: 0.4 },
  rowLabel: { color: ADMIN.muted, fontSize: 12, fontWeight: "700", marginTop: spacing.sm, marginBottom: 6 },
  seg: { flexDirection: "row", gap: 6 },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: radius.pill, backgroundColor: ADMIN.surface, borderWidth: 1.5, borderColor: ADMIN.border },
  segOn: { backgroundColor: colors.brandPrimary + "22", borderColor: colors.brandPrimary },
  segText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  segTextOn: { color: colors.white },
  toast: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.sm, marginBottom: spacing.md },
  toastText: { fontSize: 14, fontWeight: "700", flex: 1 },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.sm },
  saveText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});

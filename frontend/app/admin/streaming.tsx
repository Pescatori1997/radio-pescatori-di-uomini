import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";
import { LIVE_PLATFORMS } from "@/src/livePlatforms";

export default function LiveStreaming() {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    api.adminRadio().then((d) => setLinks(d.live_links || {})).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k: string, v: string) => setLinks((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const clean: Record<string, string> = {};
      Object.entries(links).forEach(([k, v]) => { if (v && v.trim()) clean[k] = v.trim(); });
      await api.adminUpdateRadio({ live_links: clean });
      setLinks(clean);
      setMsg({ t: "Piattaforme salvate ✓", ok: true });
    } catch (e: any) {
      setMsg({ t: e.message || "Errore", ok: false });
    } finally { setBusy(false); }
  };

  const configured = Object.values(links).filter((v) => v && v.trim()).length;

  return (
    <AdminShell title="Dirette Streaming" activeKey="streaming">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
          <View style={styles.info}>
            <Ionicons name="information-circle" size={18} color={colors.brandSecondary} />
            <Text style={styles.infoText}>Configura i link delle dirette. Quando la Modalità Diretta è attiva, l'app mostrerà solo le piattaforme con un URL impostato. Se ce n'è una sola, si apre direttamente.</Text>
          </View>

          <Text style={styles.count}>{configured} piattaforme configurate</Text>

          {LIVE_PLATFORMS.map((p) => (
            <View key={p.key} style={styles.field}>
              <View style={styles.labelRow}>
                <View style={[styles.iconBadge, { backgroundColor: p.color + "22" }]}>
                  <Ionicons name={p.icon as any} size={18} color={p.color} />
                </View>
                <Text style={styles.label}>{p.label}</Text>
              </View>
              <TextInput
                testID={`live-link-${p.key}`}
                value={links[p.key] || ""}
                onChangeText={(v) => set(p.key, v)}
                placeholder={p.placeholder}
                placeholderTextColor={ADMIN.muted}
                autoCapitalize="none"
                keyboardType="url"
                style={styles.input}
              />
            </View>
          ))}

          {msg && (
            <View style={[styles.toast, { backgroundColor: (msg.ok ? colors.success : colors.error) + "22", borderColor: msg.ok ? colors.success : colors.error }]}>
              <Ionicons name={msg.ok ? "checkmark-circle" : "alert-circle"} size={18} color={msg.ok ? colors.success : colors.error} />
              <Text style={[styles.toastText, { color: msg.ok ? colors.success : colors.error }]}>{msg.t}</Text>
            </View>
          )}

          <PressableScale testID="live-links-save" onPress={save} disabled={busy} style={[styles.saveBtn, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Salva piattaforme</Text>}
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
  count: { color: ADMIN.muted, fontSize: 13, marginBottom: spacing.md },
  field: { marginBottom: spacing.lg },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 8 },
  iconBadge: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  label: { color: colors.white, fontSize: 15, fontWeight: "700" },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.white, borderWidth: 1, borderColor: ADMIN.border },
  toast: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md },
  toastText: { fontSize: 14, fontWeight: "700", flex: 1 },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.sm },
  saveText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import AdminShell from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, ASwitch, AImagePicker } from "@/src/components/adminForm";
import { colors, spacing, radius } from "@/src/theme";

export default function AdminRadio() {
  const [f, setF] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const load = useCallback(() => {
    api.adminRadio().then((d) => setF({
      station_name: d.station_name || "", stream_url: d.stream_url || "", backup_url: d.backup_url || "",
      metadata_url: d.metadata_url || "", is_live: !!d.is_live, title: d.title || "", artist: d.artist || "", artwork: d.artwork || null,
    })).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setBusy(true); setMsg("");
    try { await api.adminUpdateRadio(f); setMsg("Impostazioni radio salvate"); }
    catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };

  return (
    <AdminShell title="Radio" activeKey="radio">
      {loading || !f ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.info}>
            <Ionicons name="information-circle" size={18} color={colors.brandSecondary} />
            <Text style={styles.infoText}>{"Configura qui lo streaming. Quando avrai l'URL reale, incollalo qui: l'app lo userà senza modifiche al codice."}</Text>
          </View>

          <Text style={styles.section}>Stato Diretta</Text>
          <ASwitch testID="radio-live" label="In diretta (LIVE attivo)" value={f.is_live} onValueChange={(v: boolean) => set("is_live", v)} />

          <Text style={styles.section}>Streaming</Text>
          <AInput testID="radio-station" label="Nome stazione" value={f.station_name} onChangeText={(v: string) => set("station_name", v)} />
          <AInput testID="radio-stream" label="URL Stream principale" value={f.stream_url} onChangeText={(v: string) => set("stream_url", v)} placeholder="https://.../stream" keyboardType="url" />
          <AInput testID="radio-backup" label="URL Stream di riserva (backup)" value={f.backup_url} onChangeText={(v: string) => set("backup_url", v)} placeholder="https://.../backup" keyboardType="url" />
          <AInput testID="radio-metadata" label="URL Metadati Now Playing (opzionale)" value={f.metadata_url} onChangeText={(v: string) => set("metadata_url", v)} placeholder="https://.../nowplaying.json" keyboardType="url" />

          <Text style={styles.section}>Now Playing (fallback manuale)</Text>
          <AImagePicker testID="radio-artwork" label="Copertina" value={f.artwork} onChange={(v: string) => set("artwork", v)} aspect={[1, 1]} />
          <AInput testID="radio-title" label="Titolo programma" value={f.title} onChangeText={(v: string) => set("title", v)} />
          <AInput testID="radio-artist" label="Conduttore / Artista" value={f.artist} onChangeText={(v: string) => set("artist", v)} />

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          <PressableScale testID="radio-save" style={[styles.btn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
            <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.btnText}>Salva</Text>
          </PressableScale>
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  info: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brandPrimary + "18", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  infoText: { flex: 1, color: colors.brandSecondary, fontSize: 13, lineHeight: 18 },
  section: { color: colors.white, fontSize: 16, fontWeight: "800", marginTop: spacing.md, marginBottom: spacing.md },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginVertical: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, marginTop: spacing.lg },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

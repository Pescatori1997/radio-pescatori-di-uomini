import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, AImagePicker } from "@/src/components/adminForm";
import { colors, spacing, radius } from "@/src/theme";
import { LIVE_PLATFORMS } from "@/src/livePlatforms";
import { LIVE_PROVIDERS, LivePlayerConfig, LiveProviderKey } from "@/src/livePlayer";

export default function LiveStreaming() {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [player, setPlayer] = useState<LivePlayerConfig>({ provider: "none" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    api.adminRadio().then((d) => {
      setLinks(d.live_links || {});
      setPlayer({ provider: "none", ...(d.live_player || {}) });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k: string, v: string) => setLinks((p) => ({ ...p, [k]: v }));
  const setP = (k: keyof LivePlayerConfig, v: any) => setPlayer((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const clean: Record<string, string> = {};
      Object.entries(links).forEach(([k, v]) => { if (v && v.trim()) clean[k] = v.trim(); });
      // Normalise the "next live" date to an ISO-ish string parseable everywhere.
      const lp: LivePlayerConfig = { ...player };
      if (lp.next_at) lp.next_at = lp.next_at.trim().replace(" ", "T");
      await api.adminUpdateRadio({ live_links: clean, live_player: lp });
      setLinks(clean);
      setMsg({ t: "Configurazione Live salvata ✓", ok: true });
    } catch (e: any) {
      setMsg({ t: e.message || "Errore", ok: false });
    } finally { setBusy(false); }
  };

  const provider = (player.provider || "none") as LiveProviderKey;
  const activeProv = LIVE_PROVIDERS.find((p) => p.key === provider);
  const configured = Object.values(links).filter((v) => v && v.trim()).length;

  return (
    <AdminShell title="Gestione Live" activeKey="streaming">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
          <View style={styles.info}>
            <Ionicons name="information-circle" size={18} color={colors.brandSecondary} />
            <Text style={styles.infoText}>Configura il Live Player mostrato nella pagina Diretta dell'app. Puoi cambiare la sorgente (YouTube, Twitch, embed, audio) senza toccare il codice. La Modalità Diretta (ON/OFF) si attiva dal Centro di Controllo Radio.</Text>
          </View>

          {/* ---- Live Player ---- */}
          <Text style={styles.section}>🔴 Live Player</Text>

          <Text style={styles.fieldLabel}>Sorgente / Player</Text>
          <View style={styles.provRow}>
            {LIVE_PROVIDERS.map((p) => {
              const active = p.key === provider;
              return (
                <PressableScale key={p.key} testID={`prov-${p.key}`} onPress={() => setP("provider", p.key)}
                  style={[styles.provChip, active && { borderColor: p.color, backgroundColor: p.color + "22" }]}>
                  <Ionicons name={p.icon as any} size={18} color={active ? p.color : ADMIN.muted} />
                  <Text style={[styles.provLabel, active && { color: colors.white }]} numberOfLines={1}>{p.label}</Text>
                </PressableScale>
              );
            })}
          </View>
          {!!activeProv && provider !== "none" && <Text style={styles.provHint}>{activeProv.hint}</Text>}

          {provider !== "none" && (
            <>
              {provider === "audio" ? (
                <AInput testID="lp-url" label="URL Stream audio" value={player.url || ""} onChangeText={(v: string) => setP("url", v)} placeholder="https://.../radio.mp3" keyboardType="url" />
              ) : provider === "embed" ? (
                <AInput testID="lp-url" label="URL embed (iframe)" value={player.url || ""} onChangeText={(v: string) => setP("url", v)} placeholder="https://..." keyboardType="url" />
              ) : (
                <AInput testID="lp-source" label={provider === "youtube" ? "ID video/live o URL YouTube" : "Canale o URL Twitch"} value={player.source_id || ""} onChangeText={(v: string) => setP("source_id", v)} placeholder={provider === "youtube" ? "es. dQw4w9WgXcQ" : "es. nome_canale"} autoCapitalize="none" />
              )}

              <AInput testID="lp-title" label="Titolo della diretta" value={player.title || ""} onChangeText={(v: string) => setP("title", v)} placeholder="Culto della Domenica" />
              <AInput testID="lp-subtitle" label="Sottotitolo / descrizione" value={player.subtitle || ""} onChangeText={(v: string) => setP("subtitle", v)} placeholder="Trasmissione in diretta streaming" />
              <AImagePicker testID="lp-cover" label="Immagine di copertina" value={player.cover || null} onChange={(v: string) => setP("cover", v)} aspect={[16, 9]} />

              <Text style={styles.section}>Pulsante "Guarda sulla piattaforma"</Text>
              <AInput testID="lp-ext-url" label="Link esterno" value={player.external_url || ""} onChangeText={(v: string) => setP("external_url", v)} placeholder="https://youtube.com/..." keyboardType="url" />
              <AInput testID="lp-ext-label" label="Etichetta pulsante" value={player.external_label || ""} onChangeText={(v: string) => setP("external_label", v)} placeholder="Guarda su YouTube" />
            </>
          )}

          {/* ---- Prossima diretta (stato offline) ---- */}
          <Text style={styles.section}>📅 Prossima diretta (mostrata quando OFFLINE)</Text>
          <AInput testID="lp-next-title" label="Titolo prossima diretta" value={player.next_title || ""} onChangeText={(v: string) => setP("next_title", v)} placeholder="Culto della Domenica" />
          <AInput testID="lp-next-at" label="Data e ora (es. 2026-08-15 21:00)" value={player.next_at || ""} onChangeText={(v: string) => setP("next_at", v)} placeholder="AAAA-MM-GG HH:MM" autoCapitalize="none" />
          <AImagePicker testID="lp-next-cover" label="Copertina prossima diretta" value={player.next_cover || null} onChange={(v: string) => setP("next_cover", v)} aspect={[1, 1]} />

          {/* ---- Link esterni per piattaforma (esistenti) ---- */}
          <Text style={styles.section}>Link esterni per piattaforma</Text>
          <Text style={styles.count}>{configured} configurati · mostrati come pulsanti "Guarda su …" sotto il player</Text>
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
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Salva configurazione</Text>}
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
  fieldLabel: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  provRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  provChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ADMIN.card, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 9, borderWidth: 1.5, borderColor: ADMIN.border, maxWidth: "100%" },
  provLabel: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", flexShrink: 1 },
  provHint: { color: ADMIN.muted, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.md },
  count: { color: ADMIN.muted, fontSize: 13, marginTop: -spacing.sm, marginBottom: spacing.md },
  field: { marginBottom: spacing.lg },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 8 },
  iconBadge: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  label: { color: colors.white, fontSize: 15, fontWeight: "700" },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.white, borderWidth: 1, borderColor: ADMIN.border },
  toast: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.md, marginBottom: spacing.md },
  toastText: { fontSize: 14, fontWeight: "700", flex: 1 },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.sm },
  saveText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});

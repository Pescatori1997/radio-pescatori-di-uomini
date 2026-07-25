import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

type Status = {
  controls_available: boolean;
  backend_running: boolean | null;
  frontend_running: boolean | null;
  is_online: boolean;
  listeners: number | null;
  title: string;
  artist: string;
  artwork: string;
  live_mode: boolean;
  live_watch_url: string;
  live_links?: Record<string, string>;
  status_error?: string | null;
};

function proxyArt(url?: string) {
  if (!url) return "";
  const base = process.env.EXPO_PUBLIC_BACKEND_URL || "";
  return url.startsWith("http://") ? `${base}/api/live/art?u=${encodeURIComponent(url)}` : url;
}

export default function RadioControl() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [linkCount, setLinkCount] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const fetchStatus = useCallback(async () => {
    try {
      const s = await api.adminRadioStatus();
      setStatus(s);
      const links = s.live_links || {};
      setLinkCount(Object.values(links).filter((v: any) => v && String(v).trim()).length);
    } catch (e: any) {
      // Never crash; keep last status
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchStatus();
    timer.current = setInterval(fetchStatus, 8000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [fetchStatus]));

  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t); } }, [msg]);

  const doControl = async (action: string) => {
    setBusy(action); setMsg(null);
    try {
      const r = await api.adminRadioControl(action);
      if (r.status) setStatus(r.status);
      setMsg({ t: action === "start" ? "Radio avviata ✓" : action === "stop" ? "Radio fermata ✓" : "Radio riavviata ✓", ok: true });
    } catch (e: any) {
      setMsg({ t: e.message || "Errore", ok: false });
    } finally { setBusy(null); setTimeout(fetchStatus, 2500); }
  };

  const doLive = async (action: string) => {
    setBusy(action); setMsg(null);
    try {
      const r = await api.adminRadioLive(action);
      if (r.status) setStatus(r.status);
      setMsg({ t: action === "start" ? "🔴 Diretta LIVE avviata" : "🟢 Diretta terminata, radio ripristinata", ok: true });
    } catch (e: any) {
      setMsg({ t: e.message || "Errore", ok: false });
    } finally { setBusy(null); setTimeout(fetchStatus, 2500); }
  };

  const online = !!status?.is_online || !!status?.frontend_running;
  const liveMode = !!status?.live_mode;

  return (
    <AdminShell title="Radio Control Center" activeKey="control">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStatus(); }} tintColor={colors.brandPrimary} />}>

          {msg && (
            <Animated.View entering={FadeIn} style={[styles.toast, { backgroundColor: (msg.ok ? colors.success : colors.error) + "22", borderColor: msg.ok ? colors.success : colors.error }]}>
              <Ionicons name={msg.ok ? "checkmark-circle" : "alert-circle"} size={18} color={msg.ok ? colors.success : colors.error} />
              <Text style={[styles.toastText, { color: msg.ok ? colors.success : colors.error }]}>{msg.t}</Text>
            </Animated.View>
          )}

          {liveMode && (
            <View style={styles.liveBanner}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBannerText}>DIRETTA LIVE ATTIVA</Text>
            </View>
          )}

          {/* Status card */}
          <View style={styles.card}>
            <View style={styles.statusHeader}>
              <View style={[styles.bigDot, { backgroundColor: online ? colors.success : colors.error }]} />
              <Text style={styles.bigStatus}>{online ? "Radio Online" : "Radio Offline"}</Text>
              <View style={styles.refreshHint}><ActivityIndicator size="small" color={ADMIN.muted} /></View>
            </View>

            <View style={styles.nowPlaying}>
              <Image source={{ uri: proxyArt(status?.artwork) }} style={styles.npArt} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.npLabel}>ORA IN ONDA</Text>
                <Text style={styles.npTitle} numberOfLines={1}>{status?.title || "—"}</Text>
                <Text style={styles.npArtist} numberOfLines={1}>{status?.artist || ""}</Text>
              </View>
            </View>

            <View style={styles.svcRow}>
              <ServiceChip label="Icecast" running={status?.frontend_running} available={status?.controls_available} icon="server-network" />
              <ServiceChip label="Liquidsoap" running={status?.backend_running} available={status?.controls_available} icon="playlist-music" />
              <View style={styles.svcChip}>
                <Ionicons name="people" size={16} color={colors.brandSecondary} />
                <Text style={styles.svcText}>{typeof status?.listeners === "number" ? status.listeners : "—"} ascolt.</Text>
              </View>
            </View>

            {!status?.controls_available && (
              <Text style={styles.warn}>⚠ API key AzuraCast non configurata: i controlli sono disattivati. Impostala in Impostazioni Radio.</Text>
            )}
            {!!status?.status_error && (
              <Text style={styles.warn}>Stato servizi non disponibile: {status.status_error}</Text>
            )}
          </View>

          {/* Radio controls */}
          <Text style={styles.section}>Controlli Radio</Text>
          <View style={styles.ctrlRow}>
            <CtrlBtn testID="ctrl-start" icon="play" label="Avvia" color={colors.success} busy={busy === "start"} disabled={!status?.controls_available || !!busy} onPress={() => doControl("start")} />
            <CtrlBtn testID="ctrl-stop" icon="stop" label="Ferma" color={colors.error} busy={busy === "stop"} disabled={!status?.controls_available || !!busy} onPress={() => doControl("stop")} />
            <CtrlBtn testID="ctrl-restart" icon="refresh" label="Riavvia" color={colors.warning} busy={busy === "restart"} disabled={!status?.controls_available || !!busy} onPress={() => doControl("restart")} />
          </View>

          {/* Live mode */}
          <Text style={styles.section}>Live Mode</Text>
          <Text style={styles.hint}>Avvia una diretta esterna. Metterà in pausa l'AutoDJ e nell'app comparirà il banner "LIVE NOW" con il pulsante "Watch Live".</Text>

          <PressableScale testID="goto-streaming" onPress={() => router.push("/admin/streaming")} style={styles.linkRow}>
            <MaterialCommunityIcons name="video-wireless" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Piattaforme Live Streaming</Text>
              <Text style={styles.linkSub}>{linkCount} configurate · tocca per gestire i link</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={ADMIN.muted} />
          </PressableScale>

          {!liveMode ? (
            <PressableScale testID="live-start" disabled={!!busy} onPress={() => doLive("start")} style={[styles.liveBtn, { backgroundColor: colors.error }, busy === "start" && { opacity: 0.6 }]}>
              {busy === "start" ? <ActivityIndicator color={colors.white} /> : (<><MaterialCommunityIcons name="access-point" size={20} color={colors.white} /><Text style={styles.liveBtnText}>Avvia Diretta LIVE</Text></>)}
            </PressableScale>
          ) : (
            <PressableScale testID="live-end" disabled={!!busy} onPress={() => doLive("end")} style={[styles.liveBtn, { backgroundColor: colors.success }, busy === "end" && { opacity: 0.6 }]}>
              {busy === "end" ? <ActivityIndicator color={colors.white} /> : (<><MaterialCommunityIcons name="stop-circle-outline" size={20} color={colors.white} /><Text style={styles.liveBtnText}>Termina Diretta</Text></>)}
            </PressableScale>
          )}
        </ScrollView>
      )}
    </AdminShell>
  );
}

function ServiceChip({ label, running, available, icon }: { label: string; running: boolean | null | undefined; available?: boolean; icon: any }) {
  const state = !available ? "n/a" : running ? "on" : "off";
  const color = state === "on" ? colors.success : state === "off" ? colors.error : ADMIN.muted;
  return (
    <View style={styles.svcChip}>
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text style={styles.svcText}>{label}</Text>
      <View style={[styles.svcDot, { backgroundColor: color }]} />
    </View>
  );
}

function CtrlBtn({ icon, label, color, onPress, busy, disabled, testID }: any) {
  return (
    <PressableScale testID={testID} disabled={disabled} onPress={onPress} style={[styles.ctrlBtn, { borderColor: color + "55" }, disabled && { opacity: 0.5 }]}>
      {busy ? <ActivityIndicator color={color} /> : <Ionicons name={icon} size={24} color={color} />}
      <Text style={[styles.ctrlLabel, { color }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toast: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md },
  toastText: { fontSize: 14, fontWeight: "700", flex: 1 },
  liveBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.error, paddingVertical: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
  liveBannerText: { color: colors.white, fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  card: { backgroundColor: ADMIN.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: ADMIN.border },
  statusHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bigDot: { width: 14, height: 14, borderRadius: 7 },
  bigStatus: { color: colors.white, fontSize: 20, fontWeight: "800", flex: 1 },
  refreshHint: { opacity: 0.5 },
  nowPlaying: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.lg },
  npArt: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: ADMIN.surface },
  npLabel: { color: colors.brandSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  npTitle: { color: colors.white, fontSize: 16, fontWeight: "800", marginTop: 2 },
  npArtist: { color: ADMIN.muted, fontSize: 13, marginTop: 1 },
  svcRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  svcChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ADMIN.surface, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: ADMIN.border },
  svcText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  svcDot: { width: 8, height: 8, borderRadius: 4 },
  warn: { color: colors.warning, fontSize: 12, marginTop: spacing.md, lineHeight: 17 },
  section: { color: colors.white, fontSize: 16, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.md },
  hint: { color: ADMIN.muted, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md, lineHeight: 17 },
  ctrlRow: { flexDirection: "row", gap: spacing.md },
  ctrlBtn: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.lg, borderRadius: radius.md, backgroundColor: ADMIN.card, borderWidth: 1.5 },
  ctrlLabel: { fontSize: 13, fontWeight: "800" },
  inputLabel: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.white, borderWidth: 1, borderColor: ADMIN.border, marginBottom: spacing.md },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border, marginBottom: spacing.md },
  linkTitle: { color: colors.white, fontSize: 15, fontWeight: "700" },
  linkSub: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  liveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill },
  liveBtnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import VideoEmbed from "@/src/components/VideoEmbed";
import PressableScale from "@/src/components/PressableScale";
import { confirmAsync, alertMessage } from "@/src/utils/confirm";
import { CAT_META, STATUS_META } from "./index";
import { colors, spacing, radius } from "@/src/theme";

const STATUSES = ["new", "in_progress", "resolved", "closed"];

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export default function AdminReportDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [r, setR] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (id) api.adminReport(id).then(setR).catch(() => setR(null)).finally(() => setLoading(false));
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const changeStatus = async (status: string) => {
    if (!r || status === r.status) return;
    setSaving(true);
    try {
      await api.adminUpdateReport(id!, status);
      setR({ ...r, status });
    } catch (e: any) {
      alertMessage("Errore", e.message || "Aggiornamento non riuscito");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    const ok = await confirmAsync("Elimina segnalazione", "Vuoi eliminare definitivamente questa segnalazione?", "Elimina", true);
    if (!ok) return;
    try {
      await api.adminDeleteReport(id!);
      alertMessage("Segnalazione eliminata", "La segnalazione è stata rimossa.");
      router.back();
    } catch (e: any) {
      alertMessage("Errore", e.message || "Eliminazione non riuscita");
    }
  };

  if (loading) return <AdminShell title="Segnalazione" activeKey="reports"><View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View></AdminShell>;
  if (!r) return <AdminShell title="Segnalazione" activeKey="reports"><View style={styles.center}><Text style={{ color: ADMIN.muted }}>Segnalazione non trovata.</Text></View></AdminShell>;

  const cat = CAT_META[r.category] || CAT_META.other;
  const isVideoData = typeof r.video === "string" && r.video.startsWith("data:");

  return (
    <AdminShell title="Segnalazione" activeKey="reports">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <View style={styles.catBadge}><Text style={{ fontSize: 16 }}>{cat.emoji}</Text><Text style={styles.catText}>{cat.label}</Text></View>
        <Text style={styles.title}>{r.title}</Text>
        <Text style={styles.date}>{fmt(r.created_at)}</Text>

        <Text style={styles.section}>Stato</Text>
        <View style={styles.statusRow}>
          {STATUSES.map((s) => {
            const meta = STATUS_META[s];
            const active = r.status === s;
            return (
              <Pressable key={s} testID={`rep-set-${s}`} disabled={saving} onPress={() => changeStatus(s)} style={[styles.statusChip, active && { backgroundColor: meta.color, borderColor: meta.color }]}>
                <Text style={[styles.statusChipText, active && { color: colors.white }]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Descrizione</Text>
        <Text style={styles.desc}>{r.description}</Text>

        {!!r.screenshot && (
          <>
            <Text style={styles.section}>Screenshot</Text>
            <Image source={{ uri: r.screenshot }} style={styles.screenshot} contentFit="contain" />
          </>
        )}

        {!!r.video && (
          <>
            <Text style={styles.section}>Video</Text>
            {isVideoData ? (
              <View style={styles.videoBox}><VideoEmbed testID="rep-video" url={r.video} /></View>
            ) : (
              <Pressable onPress={() => Linking.openURL(r.video)} style={styles.videoLink}><Ionicons name="videocam" size={18} color={colors.brandPrimary} /><Text style={styles.videoLinkText}>Apri video</Text></Pressable>
            )}
          </>
        )}

        <Text style={styles.section}>Utente</Text>
        <View style={styles.userCard}>
          <Ionicons name="person-circle-outline" size={22} color={ADMIN.muted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{r.user_name || "Ospite (non autenticato)"}</Text>
            {!!r.user_email && <Text style={styles.userEmail}>{r.user_email}</Text>}
          </View>
        </View>

        <Pressable testID="rep-delete" onPress={remove} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={styles.deleteText}>Elimina segnalazione</Text>
        </Pressable>
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  catBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: ADMIN.card, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: ADMIN.border },
  catText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  title: { color: colors.white, fontSize: 22, fontWeight: "800", marginTop: spacing.md },
  date: { color: ADMIN.muted, fontSize: 13, marginTop: 4 },
  section: { color: colors.white, fontSize: 14, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.sm },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  statusChipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  desc: { color: "#CBD5E1", fontSize: 15, lineHeight: 23 },
  screenshot: { width: "100%", height: 240, borderRadius: radius.md, backgroundColor: "#000" },
  videoBox: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", backgroundColor: "#000" },
  videoLink: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: ADMIN.card, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border },
  videoLinkText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  userCard: { flexDirection: "row", gap: spacing.md, alignItems: "center", backgroundColor: ADMIN.card, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border },
  userName: { color: colors.white, fontSize: 15, fontWeight: "700" },
  userEmail: { color: ADMIN.muted, fontSize: 13, marginTop: 2 },
  deleteBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.error },
  deleteText: { color: colors.error, fontSize: 15, fontWeight: "800" },
});

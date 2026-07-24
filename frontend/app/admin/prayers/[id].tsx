import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput } from "@/src/components/adminForm";
import { PRAYER_LABEL, PRAYER_COLOR } from "./index";
import { colors, spacing, radius } from "@/src/theme";

const STATUSES = ["new", "in_progress", "prayed", "archived"];

export default function PrayerDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [status, setStatus] = useState("new");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.adminPrayer(id!).then((d) => { setP(d); setStatus(d.status || "new"); setNotes(d.admin_notes || ""); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setBusy(true); setMsg("");
    try { await api.adminEditPrayer(id!, { status, admin_notes: notes }); setMsg("Salvato"); }
    catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };
  const del = async () => { setBusy(true); try { await api.adminDeletePrayer(id!); router.back(); } catch (e: any) { setMsg(e.message); setBusy(false); } };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="prayer-detail-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
        <Text style={styles.headerTitle}>Richiesta di Preghiera</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.from}>{p?.anonymous ? "Anonimo" : (p?.name || "Senza nome")}</Text>
          <Text style={styles.date}>{p?.created_at ? new Date(p.created_at).toLocaleString("it-IT") : ""}</Text>
          <Text style={styles.body}>{p?.text}</Text>
        </View>

        <Text style={styles.section}>Stato</Text>
        <View style={styles.statusRow}>
          {STATUSES.map((s) => (
            <Pressable key={s} testID={`prayer-status-${s}`} onPress={() => setStatus(s)}
              style={[styles.statusChip, status === s && { backgroundColor: (PRAYER_COLOR[s]) + "33", borderColor: PRAYER_COLOR[s] }]}>
              <Text style={[styles.statusText, status === s && { color: PRAYER_COLOR[s] }]}>{PRAYER_LABEL[s]}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <AInput testID="prayer-notes" label="Note interne (private, non visibili all'utente)" value={notes} onChangeText={setNotes} multiline placeholder="Aggiungi note per il team..." />
        </View>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        <PressableScale testID="prayer-detail-save" style={[styles.btn, { backgroundColor: colors.brandPrimary }, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.btnText}>Salva</Text>
        </PressableScale>
        <PressableScale testID="prayer-detail-delete" style={[styles.btn, { backgroundColor: colors.error, marginTop: spacing.md }]} onPress={del} disabled={busy}>
          <Ionicons name="trash" size={18} color={colors.white} /><Text style={styles.btnText}>Elimina</Text>
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ADMIN.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: ADMIN.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  card: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: ADMIN.border },
  from: { color: colors.white, fontSize: 16, fontWeight: "800" },
  date: { color: ADMIN.muted, fontSize: 12, marginTop: 2, marginBottom: spacing.md },
  body: { color: "#E2E8F0", fontSize: 15, lineHeight: 22 },
  section: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.sm },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  statusText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginBottom: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

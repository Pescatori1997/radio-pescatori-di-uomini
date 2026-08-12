import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput } from "@/src/components/adminForm";
import { MSG_LABEL, MSG_COLOR } from "./index";
import { colors, spacing, radius } from "@/src/theme";

const STATUSES = ["new", "reviewed", "published", "archived"];

export default function MessageDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [m, setM] = useState<any>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("new");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.adminMessage(id!).then((d) => { setM(d); setText(d.text || ""); setStatus(d.status || "new"); setNotes(d.admin_notes || ""); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setBusy(true); setMsg("");
    try { await api.adminEditMessage(id!, { status, admin_notes: notes, text }); setMsg("Salvato"); }
    catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };
  const del = async () => { setBusy(true); try { await api.adminDeleteMessage(id!); router.back(); } catch (e: any) { setMsg(e.message); setBusy(false); } };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  const isTestimony = m?.type === "testimony";

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="msg-detail-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
        <Text style={styles.headerTitle}>{isTestimony ? "Testimonianza" : "Messaggio"}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.from}>{m?.name || "Senza nome"}</Text>
          {!!m?.email && <Text style={styles.email}>{m.email}</Text>}
          <Text style={styles.date}>{m?.created_at ? new Date(m.created_at).toLocaleString("it-IT") : ""}</Text>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <AInput testID="msg-text-edit" label="Testo (modificabile prima della pubblicazione)" value={text} onChangeText={setText} multiline />
        </View>

        <Text style={styles.section}>Stato</Text>
        {isTestimony && <Text style={styles.hint}>{'Le testimonianze "Pubblicate" appaiono nell\'app.'}</Text>}
        <View style={styles.statusRow}>
          {STATUSES.map((s) => (
            <Pressable key={s} testID={`msg-status-${s}`} onPress={() => setStatus(s)}
              style={[styles.statusChip, status === s && { backgroundColor: MSG_COLOR[s] + "33", borderColor: MSG_COLOR[s] }]}>
              <Text style={[styles.statusText, status === s && { color: MSG_COLOR[s] }]}>{MSG_LABEL[s]}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <AInput testID="msg-notes" label="Note interne (private)" value={notes} onChangeText={setNotes} multiline placeholder="Note per il team..." />
        </View>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        <PressableScale testID="msg-detail-save" style={[styles.btn, { backgroundColor: colors.brandPrimary }, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.btnText}>Salva</Text>
        </PressableScale>
        <PressableScale testID="msg-detail-delete" style={[styles.btn, { backgroundColor: colors.error, marginTop: spacing.md }]} onPress={del} disabled={busy}>
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
  email: { color: colors.brandSecondary, fontSize: 13, fontWeight: "600", marginTop: 2 },
  date: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  section: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  hint: { color: colors.brandSecondary, fontSize: 12, marginBottom: spacing.sm },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  statusText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginBottom: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput } from "@/src/components/adminForm";
import { confirmAsync, alertMessage } from "@/src/utils/confirm";
import { displayState } from "./index";
import { colors, spacing, radius } from "@/src/theme";

export default function PrayerDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => api.adminPrayer(id!).then((d) => { setP(d); setText(d.text || ""); setNotes(d.admin_notes || ""); })
    .catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (body: any, okMsg: string) => {
    setBusy(true); setMsg("");
    try { await api.adminEditPrayer(id!, body); setMsg(okMsg); await load(); }
    catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };

  const saveEdits = () => patch({ text: text.trim(), admin_notes: notes }, "Modifiche salvate");
  const publish = () => patch({ published: true, status: "new" }, "Pubblicata sulla Bacheca");
  const unpublish = () => patch({ published: false }, "Rimossa dalla Bacheca");
  const archive = async () => {
    const ok = await confirmAsync("Rifiuta / Archivia", "La richiesta verrà rimossa dalla Bacheca pubblica e archiviata.", "Archivia", true);
    if (ok) patch({ status: "archived", published: false }, "Archiviata");
  };
  const restore = () => patch({ status: "new" }, "Ripristinata");
  const del = async () => {
    const ok = await confirmAsync("Elimina", "Eliminare definitivamente questa richiesta?", "Elimina", true);
    if (!ok) return;
    setBusy(true);
    try { await api.adminDeletePrayer(id!); router.back(); } catch (e: any) { alertMessage("Errore", e.message); setBusy(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;

  const isBoard = (p?.visibility || "private") === "board";
  const st = displayState(p || {});

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="prayer-detail-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
        <Text style={styles.headerTitle}>Richiesta di Preghiera</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: (isBoard ? "#0EA5E9" : ADMIN.muted) + "22" }]}>
              <Text style={[styles.badgeText, { color: isBoard ? "#38BDF8" : ADMIN.muted }]}>{isBoard ? "📢 Bacheca" : "🔒 Privata"}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: st.color + "22" }]}><Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text></View>
            {isBoard && <View style={[styles.badge, { backgroundColor: ADMIN.bg }]}><Text style={[styles.badgeText, { color: colors.white }]}>{p?.show_name && p?.name ? `👤 ${p.name}` : "🕶 Anonima"}</Text></View>}
          </View>
          <Text style={styles.author}>Autore: {p?.author_name || p?.author_email || p?.name || "Anonimo"}</Text>
          {!!p?.author_email && <Text style={styles.sub}>{p.author_email}</Text>}
          <Text style={styles.date}>{p?.created_at ? new Date(p.created_at).toLocaleString("it-IT") : ""}</Text>
          {isBoard && p?.published && <Text style={styles.pray}>🙏 {p.praying_count || 0} stanno pregando</Text>}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <AInput testID="prayer-text-edit" label="Testo della richiesta (modificabile)" value={text} onChangeText={setText} multiline placeholder="Testo..." />
          <AInput testID="prayer-notes" label="Note interne (private, non visibili all'utente)" value={notes} onChangeText={setNotes} multiline placeholder="Aggiungi note per il team..." />
        </View>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

        <PressableScale testID="prayer-save" style={[styles.btn, { backgroundColor: colors.brandPrimary }, busy && { opacity: 0.6 }]} onPress={saveEdits} disabled={busy}>
          <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.btnText}>Salva modifiche</Text>
        </PressableScale>

        {isBoard && !p?.published && p?.status !== "archived" && (
          <PressableScale testID="prayer-publish" style={[styles.btn, { backgroundColor: colors.success, marginTop: spacing.md }, busy && { opacity: 0.6 }]} onPress={publish} disabled={busy}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} /><Text style={styles.btnText}>Approva e pubblica sulla Bacheca</Text>
          </PressableScale>
        )}
        {isBoard && p?.published && (
          <PressableScale testID="prayer-unpublish" style={[styles.btn, { backgroundColor: "#F59E0B", marginTop: spacing.md }, busy && { opacity: 0.6 }]} onPress={unpublish} disabled={busy}>
            <Ionicons name="eye-off-outline" size={18} color={colors.white} /><Text style={styles.btnText}>Rimuovi dalla Bacheca</Text>
          </PressableScale>
        )}

        {p?.status === "archived" ? (
          <PressableScale testID="prayer-restore" style={[styles.btn, { backgroundColor: ADMIN.card, marginTop: spacing.md }]} onPress={restore} disabled={busy}>
            <Ionicons name="refresh" size={18} color={colors.white} /><Text style={styles.btnText}>Ripristina</Text>
          </PressableScale>
        ) : (
          <PressableScale testID="prayer-archive" style={[styles.btn, { backgroundColor: ADMIN.card, marginTop: spacing.md }]} onPress={archive} disabled={busy}>
            <Ionicons name="archive-outline" size={18} color={colors.white} /><Text style={styles.btnText}>Rifiuta / Archivia</Text>
          </PressableScale>
        )}

        <PressableScale testID="prayer-delete" style={[styles.btn, { backgroundColor: colors.error, marginTop: spacing.md }]} onPress={del} disabled={busy}>
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
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.md },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 10, fontWeight: "800" },
  author: { color: colors.white, fontSize: 15, fontWeight: "800" },
  sub: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  date: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  pray: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700", marginTop: spacing.sm },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginVertical: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill },
  btnText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});

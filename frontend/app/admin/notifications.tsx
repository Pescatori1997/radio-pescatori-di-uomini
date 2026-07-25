import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import { colors, spacing, radius } from "@/src/theme";

const CATEGORIES = [
  { key: "announcements", label: "Annuncio", icon: "bullhorn" },
  { key: "podcasts", label: "Podcast", icon: "podcast" },
  { key: "meditations", label: "Meditazione", icon: "book-open-variant" },
  { key: "news", label: "Notizia", icon: "newspaper-variant" },
  { key: "live", label: "Diretta", icon: "access-point" },
  { key: "events", label: "Evento", icon: "calendar-star" },
  { key: "prayers", label: "Preghiera", icon: "hand-heart" },
];

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export default function AdminNotifications() {
  const [category, setCategory] = useState("announcements");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Record<string, number>>({});
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.adminNotificationAudience(), api.adminNotificationsLog()])
      .then(([a, l]) => { setAudience(a); setLog(l); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = () => {
    if (!title.trim() || !message.trim()) { Alert.alert("Campi mancanti", "Inserisci titolo e messaggio."); return; }
    Alert.alert("Invia notifica", `Invia a ${audience[category] ?? 0} utenti iscritti alla categoria "${CATEGORIES.find((c) => c.key === category)?.label}"?`, [
      { text: "Annulla", style: "cancel" },
      { text: "Invia", onPress: doSend },
    ]);
  };

  const doSend = async () => {
    setSending(true);
    try {
      const res = await api.adminSendNotification({ category, title: title.trim(), message: message.trim() });
      Alert.alert("Notifica inviata", `Inviata a ${res.recipients} destinatari.`);
      setTitle(""); setMessage("");
      load();
    } catch (e: any) {
      Alert.alert("Errore", e.message || "Invio non riuscito");
    } finally { setSending(false); }
  };

  const activeCat = CATEGORIES.find((c) => c.key === category)!;

  return (
    <AdminShell title="Notifiche" activeKey="notifications">
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>

          <Text style={styles.section}>Categoria</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              return (
                <Pressable key={c.key} testID={`notif-cat-${c.key}`} onPress={() => setCategory(c.key)} style={[styles.chip, active && styles.chipActive]}>
                  <MaterialCommunityIcons name={c.icon as any} size={15} color={active ? colors.navy : ADMIN.muted} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.section}>Contenuto</Text>
          <TextInput testID="notif-title" value={title} onChangeText={setTitle} placeholder="Titolo" placeholderTextColor={ADMIN.muted} style={styles.input} maxLength={65} />
          <TextInput testID="notif-message" value={message} onChangeText={setMessage} placeholder="Messaggio" placeholderTextColor={ADMIN.muted} multiline style={[styles.input, styles.textarea]} maxLength={180} />

          <Text style={styles.section}>Anteprima</Text>
          <View style={styles.preview}>
            <View style={styles.previewIcon}><MaterialCommunityIcons name={activeCat.icon as any} size={20} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewApp}>Pescatori di Uomini · ora</Text>
              <Text style={styles.previewTitle} numberOfLines={1}>{title || "Titolo della notifica"}</Text>
              <Text style={styles.previewBody} numberOfLines={2}>{message || "Testo del messaggio che apparirà agli utenti."}</Text>
            </View>
          </View>
          <Text style={styles.audience}>Destinatari iscritti: {audience[category] ?? 0} utenti</Text>

          <Pressable testID="notif-send" style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={send} disabled={sending}>
            {sending ? <ActivityIndicator color={colors.white} /> : (<><Ionicons name="send" size={17} color={colors.white} /><Text style={styles.sendText}>Invia notifica</Text></>)}
          </Pressable>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={ADMIN.muted} />
            <Text style={styles.infoText}>Le notifiche push vengono recapitate sui dispositivi degli utenti dopo la pubblicazione (Deploy) e la generazione delle build iOS/Android. Le notifiche automatiche partono quando pubblichi nuovi podcast, notizie o avvii una diretta.</Text>
          </View>

          <Text style={styles.section}>Storico invii</Text>
          {log.length === 0 && <Text style={styles.empty}>Nessuna notifica inviata.</Text>}
          {log.map((n) => (
            <View key={n.id} style={styles.logRow} testID={`notif-log-${n.id}`}>
              <View style={[styles.dot, { backgroundColor: n.status === "sent" ? colors.success : colors.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.logTitle} numberOfLines={1}>{n.title}</Text>
                <Text style={styles.logMeta}>{fmt(n.created_at)} · {n.recipients} destinatari · {n.status === "sent" ? "Inviata" : "In attesa (build)"}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { color: colors.white, fontSize: 15, fontWeight: "800", marginTop: spacing.lg, marginBottom: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.navy },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border, padding: spacing.md, color: colors.white, fontSize: 15, marginBottom: spacing.sm },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  preview: { flexDirection: "row", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  previewIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  previewApp: { color: ADMIN.muted, fontSize: 11, fontWeight: "700" },
  previewTitle: { color: colors.white, fontSize: 15, fontWeight: "800", marginTop: 1 },
  previewBody: { color: "#CBD5E1", fontSize: 13, marginTop: 1 },
  audience: { color: ADMIN.muted, fontSize: 13, marginTop: spacing.sm },
  sendBtn: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  sendText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  infoBox: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg, borderWidth: 1, borderColor: ADMIN.border },
  infoText: { flex: 1, color: ADMIN.muted, fontSize: 12, lineHeight: 18 },
  empty: { color: ADMIN.muted, fontSize: 14, marginTop: spacing.sm },
  logRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: ADMIN.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  logTitle: { color: colors.white, fontSize: 14, fontWeight: "700" },
  logMeta: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, ASwitch } from "@/src/components/adminForm";
import { colors, spacing, radius } from "@/src/theme";

export default function AdminVersesList() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notif, setNotif] = useState<any>(null);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifMsg, setNotifMsg] = useState("");
  const [flipHint, setFlipHint] = useState("");
  const [flipBusy, setFlipBusy] = useState(false);
  const [flipMsg, setFlipMsg] = useState("");

  const load = useCallback(() => {
    api.adminVerses(search || undefined).then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
    api.adminVerseNotif().then(setNotif).catch(() => {});
    api.adminSettings().then((s: any) => setFlipHint(s.verse_flip_hint || "")).catch(() => {});
  }, [search]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveFlipHint = async () => {
    setFlipBusy(true); setFlipMsg("");
    try { await api.adminUpdateSettings({ verse_flip_hint: flipHint }); setFlipMsg("Testo salvato ✓ (attivo subito nell'app)"); }
    catch (e: any) { setFlipMsg(e.message || "Errore"); } finally { setFlipBusy(false); }
  };

  const setN = (k: string, v: any) => setNotif((p: any) => ({ ...p, [k]: v }));
  const saveNotif = async () => {
    setNotifBusy(true); setNotifMsg("");
    try {
      await api.adminUpdateVerseNotif({ enabled: notif.enabled, title: notif.title, message: notif.message, send_time: notif.send_time, send_days: notif.send_days });
      setNotifMsg("Impostazioni salvate");
    } catch (e: any) { setNotifMsg(e.message || "Errore"); } finally { setNotifBusy(false); }
  };
  const notifyNow = async () => {
    setNotifBusy(true); setNotifMsg("");
    try {
      const r = await api.adminNotifyVerseToday();
      setNotifMsg(`Notifica inviata a ${r.recipients} utenti`);
    } catch (e: any) { setNotifMsg(e.message || "Errore"); } finally { setNotifBusy(false); }
  };

  return (
    <AdminShell title="Versetto del Giorno" activeKey="verses">
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={ADMIN.muted} />
          <TextInput testID="verse-search" value={search} onChangeText={setSearch} placeholder="Cerca versetti..." placeholderTextColor={ADMIN.muted} style={styles.searchInput} />
        </View>
        <PressableScale testID="verse-create" style={styles.createBtn} onPress={() => router.push("/admin/verses/new")}>
          <Ionicons name="add" size={22} color={colors.white} />
        </PressableScale>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>

          {/* Notifica push automatica */}
          {notif && (
            <View style={styles.notifCard}>
              <View style={styles.notifHead}>
                <Ionicons name="notifications" size={18} color={colors.brandSecondary} />
                <Text style={styles.notifTitle}>Notifica push automatica</Text>
              </View>
              <Text style={styles.notifHint}>Inviata automaticamente ogni giorno quando cambia il Versetto del Giorno (orario italiano). Usa {"{riferimento}"} per inserire il riferimento biblico. Lascia il messaggio vuoto per un testo incoraggiante casuale.</Text>
              <ASwitch testID="vn-enabled" label="Invio automatico giornaliero attivo" value={!!notif.enabled} onValueChange={(v: boolean) => setN("enabled", v)} />
              <AInput testID="vn-title" label="Titolo notifica" value={notif.title} onChangeText={(v: string) => setN("title", v)} />
              <AInput testID="vn-message" label="Messaggio (vuoto = casuale)" value={notif.message} onChangeText={(v: string) => setN("message", v)} multiline />
              <AInput testID="vn-time" label="🕢 Ora di invio (HH:MM)" value={notif.send_time} onChangeText={(v: string) => setN("send_time", v)} placeholder="07:30" />
              <Text style={styles.daysLabel}>📅 Giorni di invio</Text>
              <View style={styles.daysRow}>
                {(notif.all_days || []).map((d: string) => {
                  const on = (notif.send_days || []).includes(d);
                  return (
                    <PressableScale key={d} testID={`vn-day-${d}`} style={[styles.dayChip, on && styles.dayChipOn]} onPress={() => {
                      const cur = notif.send_days || [];
                      setN("send_days", on ? cur.filter((x: string) => x !== d) : [...cur, d]);
                    }}>
                      <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>{d.slice(0, 3)}</Text>
                    </PressableScale>
                  );
                })}
              </View>
              {notifMsg ? <Text style={styles.notifResult}>{notifMsg}</Text> : null}
              <View style={styles.notifBtns}>
                <PressableScale testID="vn-save" style={[styles.notifBtn, { backgroundColor: colors.brandPrimary }, notifBusy && { opacity: 0.6 }]} onPress={saveNotif} disabled={notifBusy}>
                  <Ionicons name="save-outline" size={16} color={colors.white} /><Text style={styles.notifBtnText}>Salva</Text>
                </PressableScale>
                <PressableScale testID="vn-send" style={[styles.notifBtn, { backgroundColor: colors.success }, notifBusy && { opacity: 0.6 }]} onPress={notifyNow} disabled={notifBusy}>
                  {notifBusy ? <ActivityIndicator color={colors.white} size="small" /> : <Ionicons name="send" size={16} color={colors.white} />}
                  <Text style={styles.notifBtnText}>Invia oggi</Text>
                </PressableScale>
              </View>
            </View>
          )}

          <Text style={styles.hint}>I versetti ruotano automaticamente, uno al giorno (fuso orario Italia). Nessuna ripetizione finché non sono stati mostrati tutti.</Text>

          {/* Testo invito a girare la scheda (Home) */}
          <View style={styles.notifCard}>
            <View style={styles.notifHead}>
              <Ionicons name="sync-outline" size={18} color={colors.brandSecondary} />
              <Text style={styles.notifTitle}>Scheda Home · testo "gira la scheda"</Text>
            </View>
            <Text style={styles.notifHint}>Testo mostrato in basso sulla scheda del Versetto nella Home, che invita a toccarla per girarla e vedere la meditazione. Lascia vuoto per usare il testo predefinito.</Text>
            <AInput testID="flip-hint" label="Testo invito" value={flipHint} onChangeText={setFlipHint} placeholder="Tocca la scheda per girarla" />
            {flipMsg ? <Text style={styles.notifResult}>{flipMsg}</Text> : null}
            <View style={styles.notifBtns}>
              <PressableScale testID="flip-hint-save" style={[styles.notifBtn, { backgroundColor: colors.brandPrimary }, flipBusy && { opacity: 0.6 }]} onPress={saveFlipHint} disabled={flipBusy}>
                <Ionicons name="save-outline" size={16} color={colors.white} /><Text style={styles.notifBtnText}>Salva</Text>
              </PressableScale>
            </View>
          </View>

          {items.length === 0 ? <Text style={styles.empty}>Nessun versetto. Tocca + per aggiungerne uno.</Text> : items.map((v) => (
            <PressableScale key={v.id} testID={`verse-row-${v.id}`} style={[styles.row, v.active === false && { opacity: 0.5 }]} onPress={() => router.push(`/admin/verses/${v.id}`)}>
              <View style={styles.refBadge}><Text style={styles.refBadgeText} numberOfLines={1}>{v.reference}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.text} numberOfLines={2}>{v.text}</Text>
                {v.active === false && <Text style={styles.inactive}>Disattivato</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={ADMIN.muted} />
            </PressableScale>
          ))}
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: ADMIN.card, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, borderWidth: 1, borderColor: ADMIN.border },
  searchInput: { flex: 1, color: colors.white, fontSize: 15 },
  createBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  hint: { color: ADMIN.muted, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 0, paddingBottom: spacing.md, paddingTop: spacing.md },
  notifCard: { backgroundColor: ADMIN.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: ADMIN.border, marginBottom: spacing.md },
  notifHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  notifTitle: { color: colors.white, fontSize: 16, fontWeight: "800" },
  notifHint: { color: ADMIN.muted, fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: spacing.sm },
  notifResult: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700", marginTop: spacing.sm },
  daysLabel: { color: colors.white, fontSize: 13, fontWeight: "700", marginTop: spacing.sm, marginBottom: 8 },
  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: ADMIN.bg, borderWidth: 1, borderColor: ADMIN.border },
  dayChipOn: { backgroundColor: colors.brandPrimary + "22", borderColor: colors.brandPrimary },
  dayChipText: { color: ADMIN.muted, fontSize: 12, fontWeight: "700" },
  dayChipTextOn: { color: colors.brandSecondary },
  notifBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  notifBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.md, borderRadius: radius.pill },
  notifBtnText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: spacing["2xl"], fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  refBadge: { backgroundColor: colors.brandPrimary + "22", paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm, maxWidth: 110 },
  refBadgeText: { color: colors.brandSecondary, fontSize: 12, fontWeight: "800" },
  text: { color: colors.white, fontSize: 14, fontWeight: "600", lineHeight: 19 },
  inactive: { color: colors.warning, fontSize: 11, fontWeight: "700", marginTop: 4 },
});

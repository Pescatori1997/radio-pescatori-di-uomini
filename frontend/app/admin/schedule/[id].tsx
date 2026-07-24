import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput } from "@/src/components/adminForm";
import { colors, spacing, radius } from "@/src/theme";

const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

export default function ProgramEditor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, day: initDay } = useLocalSearchParams<{ id: string; day?: string }>();
  const isNew = id === "new";
  const [f, setF] = useState<any>({ name: "", time: "", day: initDay || "Lunedì", host: "", description: "" });
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!isNew && id) {
      api.adminPrograms().then((list: any[]) => {
        const p = list.find((x) => x.id === id);
        if (p) setF({ name: p.name, time: p.time, day: p.day, host: p.host || "", description: p.description || "" });
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [id]);

  const save = async () => {
    if (!f.name?.trim()) { setMsg("Il nome è obbligatorio"); return; }
    if (!f.time?.trim()) { setMsg("L'orario è obbligatorio"); return; }
    setBusy(true); setMsg("");
    const payload = { name: f.name, time: f.time, day: f.day, host: f.host, description: f.description };
    try {
      if (isNew) { await api.adminCreateProgram(payload); router.back(); }
      else { await api.adminEditProgram(id!, payload); setMsg("Salvato"); }
    } catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };
  const del = async () => { setBusy(true); try { await api.adminDeleteProgram(id!); router.back(); } catch (e: any) { setMsg(e.message); setBusy(false); } };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="prog-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
        <Text style={styles.headerTitle}>{isNew ? "Nuovo Programma" : "Modifica Programma"}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AInput testID="prog-name" label="Nome programma *" value={f.name} onChangeText={(v: string) => set("name", v)} />
        <AInput testID="prog-time" label="Orario * (es. 18:00)" value={f.time} onChangeText={(v: string) => set("time", v)} placeholder="HH:MM" />
        <Text style={styles.label}>Giorno *</Text>
        <View style={styles.dayRow}>
          {DAYS.map((d) => (
            <Pressable key={d} testID={`prog-day-${d}`} onPress={() => set("day", d)} style={[styles.dayChip, f.day === d && styles.dayChipActive]}>
              <Text style={[styles.dayText, f.day === d && styles.dayTextActive]}>{d.slice(0, 3)}</Text>
            </Pressable>
          ))}
        </View>
        <AInput testID="prog-host" label="Conduttore" value={f.host} onChangeText={(v: string) => set("host", v)} />
        <AInput testID="prog-desc" label="Descrizione" value={f.description} onChangeText={(v: string) => set("description", v)} multiline />

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        <PressableScale testID="prog-save" style={[styles.btn, { backgroundColor: colors.brandPrimary }, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.btnText}>{isNew ? "Crea" : "Salva"}</Text>
        </PressableScale>
        {!isNew && (
          <PressableScale testID="prog-delete" style={[styles.btn, { backgroundColor: colors.error, marginTop: spacing.md }]} onPress={del} disabled={busy}>
            <Ionicons name="trash" size={18} color={colors.white} /><Text style={styles.btnText}>Elimina</Text>
          </PressableScale>
        )}
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
  label: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  dayChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  dayChipActive: { backgroundColor: colors.white, borderColor: colors.white },
  dayText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  dayTextActive: { color: colors.navy, fontWeight: "800" },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginBottom: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, AImagePicker, ASwitch } from "@/src/components/adminForm";
import { colors, spacing, radius } from "@/src/theme";

const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const COLORS = ["", "#E11D48", "#F97316", "#EAB308", "#22C55E", "#0EA5E9", "#6366F1", "#A855F7"];
const TYPES = [
  { k: "live", l: "🔴 Live", c: "#E11D48" },
  { k: "recorded", l: "🔵 Registrato", c: "#0EA5E9" },
  { k: "music", l: "🟣 Musica", c: "#A855F7" },
  { k: "reflection", l: "🟢 Riflessione", c: "#22C55E" },
];

export default function ProgramEditor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, day: initDay } = useLocalSearchParams<{ id: string; day?: string }>();
  const isNew = id === "new";
  const [f, setF] = useState<any>({
    title: "", start_time: "", end_time: "",
    weekdays: initDay ? [initDay] : [], presenters: [{ name: "", image: "" }],
    description: "", color: "", active: true, type: "recorded",
  });
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!isNew && id) {
      api.adminPrograms().then((list: any[]) => {
        const p = list.find((x) => x.id === id);
        if (p) setF({
          title: p.title || "", start_time: p.start_time || "", end_time: p.end_time || "",
          weekdays: p.weekdays || [], presenters: (p.presenters && p.presenters.length ? p.presenters : [{ name: "", image: "" }]),
          description: p.description || "", color: p.color || "", active: p.active !== false,
          type: p.type && p.type !== "regular" ? p.type : "recorded",
        });
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [id]);

  const toggleDay = (d: string) => set("weekdays", f.weekdays.includes(d) ? f.weekdays.filter((x: string) => x !== d) : [...f.weekdays, d]);
  const setPresenter = (i: number, k: string, v: any) => set("presenters", f.presenters.map((p: any, idx: number) => idx === i ? { ...p, [k]: v } : p));
  const addPresenter = () => set("presenters", [...f.presenters, { name: "", image: "" }]);
  const removePresenter = (i: number) => set("presenters", f.presenters.filter((_: any, idx: number) => idx !== i));

  const save = async () => {
    if (!f.title?.trim()) { setMsg("Il titolo è obbligatorio"); return; }
    if (!f.start_time?.trim()) { setMsg("L'ora di inizio è obbligatoria"); return; }
    if (!f.weekdays.length) { setMsg("Seleziona almeno un giorno"); return; }
    setBusy(true); setMsg("");
    const presenters = f.presenters.filter((p: any) => p.name?.trim() || p.image);
    const images = presenters.map((p: any) => p.image).filter(Boolean);
    const payload = {
      title: f.title, start_time: f.start_time, end_time: f.end_time,
      weekdays: f.weekdays, presenters, images, description: f.description,
      color: f.color, active: f.active, type: f.type || "recorded",
    };
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
        <AInput testID="prog-title" label="Titolo programma *" value={f.title} onChangeText={(v: string) => set("title", v)} />
        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}><AInput testID="prog-start" label="Ora inizio * (HH:MM)" value={f.start_time} onChangeText={(v: string) => set("start_time", v)} placeholder="09:00" /></View>
          <View style={{ flex: 1 }}><AInput testID="prog-end" label="Ora fine (HH:MM)" value={f.end_time} onChangeText={(v: string) => set("end_time", v)} placeholder="11:00" /></View>
        </View>

        <Text style={styles.label}>Giorni della settimana *</Text>
        <View style={styles.dayRow}>
          {DAYS.map((d) => (
            <Pressable key={d} testID={`prog-day-${d}`} onPress={() => toggleDay(d)} style={[styles.dayChip, f.weekdays.includes(d) && styles.dayChipActive]}>
              <Text style={[styles.dayText, f.weekdays.includes(d) && styles.dayTextActive]}>{d.slice(0, 3)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Conduttori</Text>
        {f.presenters.map((p: any, i: number) => (
          <View key={i} style={styles.presenterCard}>
            <View style={styles.presenterHead}>
              <Text style={styles.presenterIdx}>Conduttore {i + 1}</Text>
              {f.presenters.length > 1 && (
                <Pressable testID={`prog-presenter-remove-${i}`} onPress={() => removePresenter(i)} hitSlop={10}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
              )}
            </View>
            <AInput testID={`prog-presenter-name-${i}`} label="Nome" value={p.name} onChangeText={(v: string) => setPresenter(i, "name", v)} />
            <AImagePicker testID={`prog-presenter-img-${i}`} label="Foto (quadrata, mostrata in cerchio)" value={p.image} onChange={(v: string) => setPresenter(i, "image", v)} aspect={[1, 1]} />
          </View>
        ))}
        <PressableScale testID="prog-add-presenter" style={styles.addBtn} onPress={addPresenter}>
          <Ionicons name="add" size={18} color={colors.brandPrimary} /><Text style={styles.addText}>Aggiungi conduttore</Text>
        </PressableScale>

        <AInput testID="prog-desc" label="Descrizione" value={f.description} onChangeText={(v: string) => set("description", v)} multiline />

        <Text style={styles.label}>Tipo di contenuto</Text>
        <View style={styles.dayRow}>
          {TYPES.map((t) => (
            <Pressable key={t.k} testID={`prog-type-${t.k}`} onPress={() => set("type", t.k)} style={[styles.typeChip, f.type === t.k && { backgroundColor: t.c, borderColor: t.c }]}>
              <Text style={[styles.typeText, f.type === t.k && { color: colors.white }]}>{t.l}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Colore programma</Text>
        <View style={styles.dayRow}>
          {COLORS.map((c) => (
            <Pressable key={c || "none"} testID={`prog-color-${c || "none"}`} onPress={() => set("color", c)} style={[styles.swatch, c ? { backgroundColor: c } : styles.swatchNone, f.color === c && styles.swatchActive]}>
              {!c && <Ionicons name="ban-outline" size={16} color={ADMIN.muted} />}
              {f.color === c && !!c && <Ionicons name="checkmark" size={16} color={colors.white} />}
            </Pressable>
          ))}
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Stato</Text>
            <Text style={styles.switchHint}>{f.active ? "Attivo (visibile nel palinsesto)" : "Disattivato"}</Text>
          </View>
          <ASwitch value={f.active} onValueChange={(v: boolean) => set("active", v)} />
        </View>

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
  timeRow: { flexDirection: "row", gap: spacing.md },
  label: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  dayChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  dayChipActive: { backgroundColor: colors.white, borderColor: colors.white },
  dayText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  typeChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  typeText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  dayTextActive: { color: colors.navy, fontWeight: "800" },
  presenterCard: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  presenterHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  presenterIdx: { color: colors.white, fontSize: 13, fontWeight: "800" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border, borderStyle: "dashed", marginBottom: spacing.lg },
  addText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700" },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  swatchNone: { backgroundColor: ADMIN.card, borderColor: ADMIN.border },
  swatchActive: { borderColor: colors.white },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border, marginBottom: spacing.lg },
  switchLabel: { color: colors.white, fontSize: 15, fontWeight: "800" },
  switchHint: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginBottom: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

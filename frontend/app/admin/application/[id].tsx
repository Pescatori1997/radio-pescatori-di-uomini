import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView } from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/src/api";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

function AInput({ label, value, onChangeText, multiline }: any) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} multiline={multiline} placeholderTextColor={ADMIN.muted}
        style={[styles.input, multiline && { height: 90, textAlignVertical: "top" }]} />
    </View>
  );
}

function InfoRow({ icon, label, value }: any) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.brandSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ApplicationDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [a, setA] = useState<any>(null);
  const [edit, setEdit] = useState<any>({});
  const [portrait, setPortrait] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadData = () => api.adminApplication(id!).then((d) => {
    setA(d);
    setEdit({
      display_name: `${d.name} ${d.surname}`, role: d.desired_role, mission: d.motivation?.slice(0, 140) || "",
      bio: d.experience || "", ministry: "", programs: "", verse: "", verse_ref: "", testimony: d.testimony || "",
    });
    setPortrait(d.portrait || null);
  }).catch(() => {});

  useEffect(() => { if (id) loadData(); }, [id]);

  const pickImage = async () => {
    const cur = await ImagePicker.getMediaLibraryPermissionsAsync();
    let st = cur.status;
    if (st !== "granted" && cur.canAskAgain) st = (await ImagePicker.requestMediaLibraryPermissionsAsync()).status;
    if (st !== "granted") { setMsg("Permesso galleria negato"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [3, 4], quality: 0.6, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) setPortrait(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      await api.adminEditApplication(id!, {
        ...edit,
        programs: edit.programs ? edit.programs.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        portrait: portrait || undefined,
      });
      setMsg("Modifiche salvate");
      loadData();
    } catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };

  const doAction = async (fn: () => Promise<any>, back = false) => {
    setBusy(true); setMsg("");
    try { await fn(); if (back) router.back(); else loadData(); }
    catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };

  if (!a) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="appdetail-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
        <Text style={styles.headerTitle}>Candidatura</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.portraitWrap}>
          {portrait ? <Image source={{ uri: portrait }} style={styles.portrait} contentFit="cover" /> : <View style={[styles.portrait, styles.portraitEmpty]}><Ionicons name="person" size={44} color={ADMIN.muted} /></View>}
          <PressableScale testID="appdetail-portrait" style={styles.replaceBtn} onPress={pickImage}>
            <Ionicons name="camera" size={16} color={colors.white} /><Text style={styles.replaceText}>Sostituisci foto</Text>
          </PressableScale>
        </View>

        <Text style={styles.bigName}>{a.name} {a.surname}</Text>
        <Text style={styles.status}>{a.status === "pending" ? "In attesa" : a.status === "approved" ? "Approvata" : "Rifiutata"}</Text>

        <View style={styles.infoCard}>
          <InfoRow icon="email" label="Email" value={a.email} />
          <InfoRow icon="phone" label="Telefono" value={a.phone} />
          <InfoRow icon="map-marker" label="Città" value={a.city} />
          <InfoRow icon="cake-variant" label="Età" value={a.age ? String(a.age) : null} />
          <InfoRow icon="briefcase" label="Ruolo desiderato" value={a.desired_role} />
          <InfoRow icon="star-four-points" label="Testimonianza" value={a.testimony} />
          <InfoRow icon="heart" label="Perché vuole servire" value={a.motivation} />
          <InfoRow icon="history" label="Esperienza" value={a.experience} />
          <InfoRow icon="calendar" label="Inviata il" value={new Date(a.created_at).toLocaleString("it-IT")} />
        </View>

        <Text style={styles.sectionTitle}>Profilo pubblico (modifica prima di pubblicare)</Text>
        <AInput label="Nome visualizzato" value={edit.display_name} onChangeText={(v: string) => setEdit({ ...edit, display_name: v })} />
        <AInput label="Ruolo" value={edit.role} onChangeText={(v: string) => setEdit({ ...edit, role: v })} />
        <AInput label="Missione (frase breve)" value={edit.mission} onChangeText={(v: string) => setEdit({ ...edit, mission: v })} multiline />
        <AInput label="Biografia" value={edit.bio} onChangeText={(v: string) => setEdit({ ...edit, bio: v })} multiline />
        <AInput label="Ministero" value={edit.ministry} onChangeText={(v: string) => setEdit({ ...edit, ministry: v })} multiline />
        <AInput label="Programmi (separati da virgola)" value={edit.programs} onChangeText={(v: string) => setEdit({ ...edit, programs: v })} />
        <AInput label="Versetto preferito" value={edit.verse} onChangeText={(v: string) => setEdit({ ...edit, verse: v })} multiline />
        <AInput label="Riferimento versetto" value={edit.verse_ref} onChangeText={(v: string) => setEdit({ ...edit, verse_ref: v })} />
        <AInput label="Testimonianza (pubblica)" value={edit.testimony} onChangeText={(v: string) => setEdit({ ...edit, testimony: v })} multiline />

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

        <PressableScale testID="appdetail-save" style={[styles.btn, styles.saveBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.btnText}>Salva modifiche</Text>
        </PressableScale>

        <View style={styles.actionsRow}>
          <PressableScale testID="appdetail-approve" style={[styles.actBtn, { backgroundColor: colors.success }]} onPress={() => doAction(() => api.adminApprove(id!))}>
            <Ionicons name="checkmark" size={18} color={colors.white} /><Text style={styles.actText}>Approva</Text>
          </PressableScale>
          <PressableScale testID="appdetail-reject" style={[styles.actBtn, { backgroundColor: colors.warning }]} onPress={() => doAction(() => api.adminReject(id!))}>
            <Ionicons name="close" size={18} color={colors.white} /><Text style={styles.actText}>Rifiuta</Text>
          </PressableScale>
          <PressableScale testID="appdetail-delete" style={[styles.actBtn, { backgroundColor: colors.error }]} onPress={() => doAction(() => api.adminDeleteApplication(id!), true)}>
            <Ionicons name="trash" size={18} color={colors.white} /><Text style={styles.actText}>Elimina</Text>
          </PressableScale>
        </View>
        {a.status === "approved" && (
          <Text style={styles.approvedNote}>Membro pubblicato in L'Equipaggio. Puoi caricare il ritratto ufficiale dalla scheda Membri.</Text>
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
  portraitWrap: { alignItems: "center", gap: spacing.md },
  portrait: { width: 160, height: 210, borderRadius: radius.lg, backgroundColor: ADMIN.card },
  portraitEmpty: { alignItems: "center", justifyContent: "center" },
  replaceBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ADMIN.card, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: ADMIN.border },
  replaceText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  bigName: { color: colors.white, fontSize: 24, fontWeight: "800", textAlign: "center", marginTop: spacing.lg },
  status: { color: colors.brandSecondary, fontSize: 13, textAlign: "center", marginTop: 2, marginBottom: spacing.lg },
  infoCard: { backgroundColor: ADMIN.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: ADMIN.border, marginBottom: spacing.xl },
  infoRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  infoLabel: { color: ADMIN.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  infoValue: { color: colors.white, fontSize: 15, marginTop: 2, lineHeight: 21 },
  sectionTitle: { color: colors.white, fontSize: 17, fontWeight: "800", marginBottom: spacing.md },
  label: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.white, borderWidth: 1, borderColor: ADMIN.border },
  msg: { color: colors.brandSecondary, fontSize: 14, marginBottom: spacing.md, textAlign: "center" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill },
  saveBtn: { backgroundColor: colors.brandPrimary, marginTop: spacing.sm },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: spacing.md, borderRadius: radius.md },
  actText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  approvedNote: { color: colors.success, fontSize: 13, textAlign: "center", marginTop: spacing.lg, lineHeight: 19 },
});

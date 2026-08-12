import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, Switch } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/src/api";
import { crewPortrait } from "@/src/crewAssets";
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

export default function MemberEditor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [m, setM] = useState<any>(null);
  const [e, setE] = useState<any>({});
  const [ranks, setRanks] = useState<any[]>([]);
  const [newPortrait, setNewPortrait] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadData = () => api.crewMember(id!).then((d) => {
    setM(d);
    setE({ name: d.name, role: d.role, mission: d.mission, bio: d.bio, ministry: d.ministry,
      programs: (d.programs || []).join(", "), verse: d.verse, verse_ref: d.verse_ref, published: d.published, rank_id: d.rank_id || null });
    setNewPortrait(null);
  }).catch(() => {});
  useEffect(() => { if (id) loadData(); api.adminCrewRanks().then(setRanks).catch(() => {}); }, [id]);

  const pickImage = async () => {
    const cur = await ImagePicker.getMediaLibraryPermissionsAsync();
    let st = cur.status;
    if (st !== "granted" && cur.canAskAgain) st = (await ImagePicker.requestMediaLibraryPermissionsAsync()).status;
    if (st !== "granted") { setMsg("Permesso galleria negato"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [3, 4], quality: 0.6, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) setNewPortrait(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      await api.adminEditCrew(id!, {
        name: e.name, role: e.role, mission: e.mission, bio: e.bio, ministry: e.ministry,
        programs: e.programs ? e.programs.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        verse: e.verse, verse_ref: e.verse_ref, published: e.published, rank_id: e.rank_id || null,
      });
      if (newPortrait) await api.adminCrewPortrait(id!, newPortrait);
      setMsg("Salvato"); loadData();
    } catch (err: any) { setMsg(err.message || "Errore"); } finally { setBusy(false); }
  };

  const del = async () => {
    setBusy(true);
    try { await api.adminDeleteCrew(id!); router.back(); } catch (err: any) { setMsg(err.message || "Errore"); setBusy(false); }
  };

  if (!m) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="member-back" onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="arrow-back" size={22} color={colors.white} /></PressableScale>
        <Text style={styles.headerTitle}>Modifica Membro</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.portraitWrap}>
          <Image source={newPortrait ? { uri: newPortrait } : crewPortrait(m)} style={styles.portrait} contentFit="cover" contentPosition="top" />
          <PressableScale testID="member-portrait" style={styles.replaceBtn} onPress={pickImage}>
            <Ionicons name="camera" size={16} color={colors.white} /><Text style={styles.replaceText}>Ritratto ufficiale</Text>
          </PressableScale>
        </View>

        <AInput label="Nome" value={e.name} onChangeText={(v: string) => setE({ ...e, name: v })} />
        <AInput label="Ruolo" value={e.role} onChangeText={(v: string) => setE({ ...e, role: v })} />
        <AInput label="Missione" value={e.mission} onChangeText={(v: string) => setE({ ...e, mission: v })} multiline />
        <AInput label="Biografia" value={e.bio} onChangeText={(v: string) => setE({ ...e, bio: v })} multiline />
        <AInput label="Ministero" value={e.ministry} onChangeText={(v: string) => setE({ ...e, ministry: v })} multiline />
        <AInput label="Programmi (separati da virgola)" value={e.programs} onChangeText={(v: string) => setE({ ...e, programs: v })} />
        <AInput label="Versetto preferito" value={e.verse} onChangeText={(v: string) => setE({ ...e, verse: v })} multiline />
        <AInput label="Riferimento versetto" value={e.verse_ref} onChangeText={(v: string) => setE({ ...e, verse_ref: v })} />

        <Text style={styles.label}>Grado</Text>
        <View style={styles.rankChips}>
          <PressableScale testID="rank-none" onPress={() => setE({ ...e, rank_id: null })} style={[styles.rankChip, !e.rank_id && styles.rankChipOn]}>
            <Text style={[styles.rankChipText, !e.rank_id && styles.rankChipTextOn]}>Nessuno</Text>
          </PressableScale>
          {ranks.map((r) => (
            <PressableScale key={r.id} testID={`rank-${r.id}`} onPress={() => setE({ ...e, rank_id: r.id })} style={[styles.rankChip, e.rank_id === r.id && styles.rankChipOn]}>
              <Text style={[styles.rankChipText, e.rank_id === r.id && styles.rankChipTextOn]} numberOfLines={1}>{r.name}</Text>
            </PressableScale>
          ))}
        </View>
        {ranks.length === 0 && <Text style={styles.rankHint}>Nessun grado creato. Aggiungili da Team → Gradi.</Text>}

        <View style={styles.switchRow}>
          <Text style={styles.label}>Visibile pubblicamente</Text>
          <Switch testID="member-published" value={!!e.published} onValueChange={(v) => setE({ ...e, published: v })} trackColor={{ true: colors.brandPrimary }} />
        </View>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

        <PressableScale testID="member-save" style={[styles.btn, { backgroundColor: colors.brandPrimary }, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.btnText}>Salva</Text>
        </PressableScale>
        <PressableScale testID="member-delete" style={[styles.btn, { backgroundColor: colors.error, marginTop: spacing.md }]} onPress={del} disabled={busy}>
          <Ionicons name="trash" size={18} color={colors.white} /><Text style={styles.btnText}>Elimina membro</Text>
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
  portraitWrap: { alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  portrait: { width: 160, height: 210, borderRadius: radius.lg, backgroundColor: ADMIN.card },
  replaceBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ADMIN.card, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: ADMIN.border },
  replaceText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  label: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  rankChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.lg },
  rankChip: { paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1.5, borderColor: ADMIN.border },
  rankChipOn: { backgroundColor: colors.brandPrimary + "22", borderColor: colors.brandPrimary },
  rankChipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  rankChipTextOn: { color: colors.white },
  rankHint: { color: ADMIN.muted, fontSize: 12, marginTop: -spacing.md, marginBottom: spacing.lg },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.white, borderWidth: 1, borderColor: ADMIN.border },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginBottom: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

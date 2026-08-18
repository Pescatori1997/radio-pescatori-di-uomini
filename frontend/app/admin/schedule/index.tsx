import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput } from "@/src/components/adminForm";
import MediaUpload from "@/src/components/MediaUpload";
import { colors, spacing, radius } from "@/src/theme";

const DAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

export default function AdminSchedule() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [day, setDay] = useState(DAYS[todayIdx]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [fillKind, setFillKind] = useState<string>("");
  const [fillMedia, setFillMedia] = useState<any>({ media_id: null, video_url: "" });
  const [fillMessage, setFillMessage] = useState("");
  const [fillMsg, setFillMsg] = useState("");
  const [savingFill, setSavingFill] = useState(false);

  const load = useCallback(() => {
    api.adminPrograms().then(setItems).catch(() => {}).finally(() => { setLoading(false); setRefreshing(false); });
    api.adminSettings().then((s: any) => {
      const url = s.live_filler_url || "";
      const m = url.match(/^\/api\/media\/([^/?]+)/);
      setFillKind(s.live_filler_kind || "");
      setFillMedia(m ? { media_id: m[1], video_url: "" } : { media_id: null, video_url: url });
      setFillMessage(s.live_filler_message || "");
    }).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveFiller = async () => {
    setFillMsg(""); setSavingFill(true);
    const url = fillMedia.media_id ? `/api/media/${fillMedia.media_id}` : (fillMedia.video_url || "").trim();
    try {
      await api.adminUpdateSettings({
        live_filler_kind: fillKind,
        live_filler_url: fillKind === "message" ? "" : url,
        live_filler_message: fillKind === "message" ? fillMessage : "",
      });
      setFillMsg("Impostazioni salvate ✓");
    } catch { setFillMsg("Errore nel salvataggio"); }
    finally { setSavingFill(false); }
  };

  const dayPrograms = items.filter((p) => (p.weekdays || []).includes(day)).sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  return (
    <AdminShell title="Palinsesto" activeKey="schedule">
      <View style={styles.topBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flex: 1 }}>
          {DAYS.map((d) => (
            <Pressable key={d} testID={`sched-day-${d}`} onPress={() => setDay(d)} style={[styles.chip, day === d && styles.chipActive]}>
              <Text style={[styles.chipText, day === d && styles.chipTextActive]}>{d.slice(0, 3)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <PressableScale testID="sched-create" style={styles.createBtn} onPress={() => router.push(`/admin/schedule/new?day=${encodeURIComponent(day)}`)}>
          <Ionicons name="add" size={22} color={colors.white} />
        </PressableScale>
      </View>

      <View style={styles.fillerCard}>
        <Pressable style={styles.fillerHead} onPress={() => setFillOpen((o) => !o)} testID="filler-toggle">
          <Ionicons name="tv-outline" size={18} color={colors.brandSecondary} />
          <Text style={styles.fillerTitle}>Impostazioni Diretta · Riempitivo</Text>
          <Ionicons name={fillOpen ? "chevron-up" : "chevron-down"} size={18} color={ADMIN.muted} />
        </Pressable>
        {fillOpen ? (
          <View style={styles.fillerBody}>
            <Text style={styles.fillerHint}>Cosa riprodurre nella schermata Diretta quando nessun programma è in onda.</Text>
            <View style={styles.kindRow}>
              {[["", "Nessuno"], ["video", "Video"], ["audio", "Audio"], ["message", "Messaggio"]].map(([k, lbl]) => (
                <Pressable key={k} testID={`filler-kind-${k || "none"}`} onPress={() => setFillKind(k)} style={[styles.kindChip, fillKind === k && styles.kindChipActive]}>
                  <Text style={[styles.kindChipText, fillKind === k && styles.kindChipTextActive]}>{lbl}</Text>
                </Pressable>
              ))}
            </View>
            {fillKind === "video" || fillKind === "audio" ? (
              <MediaUpload value={fillMedia} onChange={setFillMedia} accept={fillKind === "audio" ? ["audio/*"] : ["video/*"]} />
            ) : null}
            {fillKind === "message" ? (
              <AInput testID="filler-message" label="Messaggio da mostrare" value={fillMessage} onChangeText={setFillMessage} placeholder="Es. Torna più tardi per la prossima diretta 🎙️" multiline />
            ) : null}
            <PressableScale testID="filler-save" style={styles.saveBtn} onPress={saveFiller}>
              {savingFill ? <ActivityIndicator color={colors.white} size="small" /> : (
                <><Ionicons name="checkmark" size={18} color={colors.white} /><Text style={styles.saveBtnText}>Salva riempitivo</Text></>
              )}
            </PressableScale>
            {!!fillMsg && <Text style={[styles.fillMsg, fillMsg.includes("Errore") && { color: colors.error }]}>{fillMsg}</Text>}
          </View>
        ) : null}
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>
          {dayPrograms.length === 0 ? <Text style={styles.empty}>Nessun programma per {day}. Tocca + per aggiungere.</Text> : dayPrograms.map((p) => (
            <PressableScale key={p.id} testID={`sched-row-${p.id}`} style={[styles.row, p.active === false && { opacity: 0.5 }]} onPress={() => router.push(`/admin/schedule/${p.id}`)}>
              <View style={styles.timeCol}><Text style={styles.time}>{p.start_time}</Text>{!!p.end_time && <Text style={styles.timeEnd}>{p.end_time}</Text>}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{p.title}</Text>
                {!!p.host && <Text style={styles.host} numberOfLines={1}>{p.host}</Text>}
                <Text style={styles.days} numberOfLines={1}>{(p.weekdays || []).map((d: string) => d.slice(0, 3)).join(" · ")}</Text>
              </View>
              {p.active === false && <View style={styles.offBadge}><Text style={styles.offText}>OFF</Text></View>}
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
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.md },
  chips: { gap: spacing.sm, paddingRight: spacing.sm },
  chip: { height: 36, minWidth: 52, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center", flexShrink: 0, borderWidth: 1, borderColor: ADMIN.border },
  chipActive: { backgroundColor: colors.white, borderColor: colors.white },
  chipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.navy, fontWeight: "700" },
  createBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  fillerCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border, overflow: "hidden" },
  fillerHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  fillerTitle: { flex: 1, color: colors.white, fontSize: 14, fontWeight: "800" },
  fillerBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: ADMIN.border },
  fillerHint: { color: ADMIN.muted, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
  kindRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  kindChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.navy, borderWidth: 1, borderColor: ADMIN.border },
  kindChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  kindChipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  kindChipTextActive: { color: colors.white },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.xs },
  saveBtnText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  fillMsg: { color: colors.success, fontSize: 13, fontWeight: "700", textAlign: "center" },
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: spacing["2xl"], fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  timeCol: { width: 54 },
  time: { color: colors.brandPrimary, fontSize: 15, fontWeight: "800" },
  timeEnd: { color: ADMIN.muted, fontSize: 12, fontWeight: "600", marginTop: 1 },
  name: { color: colors.white, fontSize: 15, fontWeight: "800" },
  host: { color: ADMIN.muted, fontSize: 13, marginTop: 2 },
  days: { color: colors.brandSecondary, fontSize: 11, marginTop: 3, fontWeight: "600" },
  offBadge: { backgroundColor: colors.error, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  offText: { color: colors.white, fontSize: 10, fontWeight: "800" },
});

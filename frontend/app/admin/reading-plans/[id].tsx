import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import { AInput, ASwitch } from "@/src/components/adminForm";
import PressableScale from "@/src/components/PressableScale";
import { confirmAsync, alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

type Reading = { book_nr: number; book_name?: string; chapter?: number; verse_start?: number; verse_end?: number; label?: string };
type Day = { day: number; title?: string; meditation?: string; readings: Reading[] };

const emptyDay = (n: number): Day => ({ day: n, title: "", meditation: "", readings: [] });

export default function AdminPlanEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [featured, setFeatured] = useState(false);
  const [status, setStatus] = useState("draft");
  const [order, setOrder] = useState("0");
  const [days, setDays] = useState<Day[]>([emptyDay(1)]);

  const [books, setBooks] = useState<any[]>([]);
  const [picker, setPicker] = useState<{ di: number; ri: number } | null>(null);

  useEffect(() => {
    api.bibleBooks().then((b: any) => setBooks([...(b.at || []), ...(b.nt || [])])).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (isNew) return;
    api.adminReadingPlan(id!).then((p: any) => {
      setTitle(p.title || ""); setSubtitle(p.subtitle || ""); setDescription(p.description || "");
      setCategory(p.category || ""); setFeatured(!!p.featured); setStatus(p.status || "draft");
      setOrder(String(p.order ?? 0));
      setDays((p.days && p.days.length ? p.days : [emptyDay(1)]).map((d: any, i: number) => ({
        day: i + 1, title: d.title || "", meditation: d.meditation || "",
        readings: (d.readings || []).map((r: any) => ({ ...r })),
      })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id, isNew]);
  useEffect(() => { load(); }, [load]);

  const updateDay = (di: number, patch: Partial<Day>) => setDays((ds) => ds.map((d, i) => i === di ? { ...d, ...patch } : d));
  const updateReading = (di: number, ri: number, patch: Partial<Reading>) =>
    setDays((ds) => ds.map((d, i) => i === di ? { ...d, readings: d.readings.map((r, j) => j === ri ? { ...r, ...patch } : r) } : d));
  const addDay = () => setDays((ds) => [...ds, emptyDay(ds.length + 1)]);
  const removeDay = (di: number) => setDays((ds) => ds.filter((_, i) => i !== di).map((d, i) => ({ ...d, day: i + 1 })));
  const addReading = (di: number) => setDays((ds) => ds.map((d, i) => i === di ? { ...d, readings: [...d.readings, { book_nr: 0, chapter: undefined }] } : d));
  const removeReading = (di: number, ri: number) => setDays((ds) => ds.map((d, i) => i === di ? { ...d, readings: d.readings.filter((_, j) => j !== ri) } : d));

  const pickBook = (b: any) => {
    if (picker) updateReading(picker.di, picker.ri, { book_nr: b.book_nr, book_name: b.name });
    setPicker(null);
  };

  const save = async () => {
    if (!title.trim()) return alertMessage("Titolo obbligatorio", "Inserisci un titolo per il piano.");
    // Build clean days, validate readings, auto-fill labels.
    const cleanDays = days.map((d, i) => ({
      day: i + 1,
      title: d.title?.trim() || undefined,
      meditation: d.meditation?.trim() || undefined,
      readings: d.readings
        .filter((r) => r.book_nr && r.chapter)
        .map((r) => {
          const vs = r.verse_start || undefined;
          const ve = r.verse_end || undefined;
          const auto = vs ? `${r.book_name} ${r.chapter}:${vs}${ve ? `-${ve}` : ""}` : `${r.book_name} ${r.chapter}`;
          return { book_nr: r.book_nr, book_name: r.book_name, chapter: Number(r.chapter), verse_start: vs, verse_end: ve, label: (r.label?.trim() || auto) };
        }),
    }));
    const emptyDayIdx = cleanDays.findIndex((d) => d.readings.length === 0);
    if (emptyDayIdx !== -1) return alertMessage("Giorno incompleto", `Il Giorno ${emptyDayIdx + 1} non ha letture valide (serve libro + capitolo).`);

    const body = {
      title: title.trim(), subtitle: subtitle.trim() || undefined, description: description.trim() || undefined,
      category: category.trim() || undefined, featured, status, order: parseInt(order, 10) || 0, days: cleanDays,
    };
    setSaving(true);
    try {
      if (isNew) { await api.adminCreatePlan(body); } else { await api.adminUpdatePlan(id!, body); }
      alertMessage("Salvato", "Il piano di lettura è stato salvato.");
      router.back();
    } catch (e: any) { alertMessage("Errore", e?.message || "Riprova"); }
    finally { setSaving(false); }
  };

  const del = async () => {
    const ok = await confirmAsync("Elimina piano", "Vuoi eliminare definitivamente questo piano? Verranno rimossi anche i progressi degli utenti.", "Elimina", true);
    if (!ok) return;
    try { await api.adminDeletePlan(id!); router.back(); } catch (e: any) { alertMessage("Errore", e?.message || "Riprova"); }
  };

  if (loading) return <AdminShell title="Piano" activeKey="plans"><View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View></AdminShell>;

  return (
    <AdminShell title={isNew ? "Nuovo piano" : "Modifica piano"} activeKey="plans">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <AInput label="Titolo *" value={title} onChangeText={setTitle} placeholder="Es. Incontra Gesù – 7 giorni nei Vangeli" testID="plan-title" />
        <AInput label="Sottotitolo" value={subtitle} onChangeText={setSubtitle} placeholder="Breve descrizione in una riga" testID="plan-subtitle" />
        <AInput label="Descrizione" value={description} onChangeText={setDescription} multiline placeholder="Descrizione del piano" testID="plan-description" />
        <AInput label="Categoria" value={category} onChangeText={setCategory} placeholder="Es. Vangeli, Speranza" testID="plan-category" />
        <AInput label="Ordine" value={order} onChangeText={setOrder} keyboardType="number-pad" testID="plan-order" />
        <ASwitch label="In evidenza" value={featured} onValueChange={setFeatured} testID="plan-featured" />

        <Text style={styles.fieldLabel}>Stato</Text>
        <View style={styles.statusRow}>
          {[{ k: "draft", l: "Bozza" }, { k: "published", l: "Pubblicato" }].map((s) => (
            <Pressable key={s.k} testID={`plan-status-${s.k}`} onPress={() => setStatus(s.k)} style={[styles.statusBtn, status === s.k && styles.statusBtnOn]}>
              <Text style={[styles.statusText, status === s.k && styles.statusTextOn]}>{s.l}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.daysHeader}>
          <Text style={styles.sectionTitle}>Giorni ({days.length})</Text>
        </View>

        {days.map((d, di) => (
          <View key={di} style={styles.dayCard}>
            <View style={styles.dayTop}>
              <Text style={styles.dayNum}>Giorno {di + 1}</Text>
              {days.length > 1 && (
                <PressableScale testID={`plan-remove-day-${di}`} onPress={() => removeDay(di)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color="#F87171" />
                </PressableScale>
              )}
            </View>
            <TextInput testID={`plan-day-title-${di}`} value={d.title} onChangeText={(t) => updateDay(di, { title: t })} placeholder="Titolo del giorno" placeholderTextColor={ADMIN.muted} style={styles.input} />
            <TextInput testID={`plan-day-med-${di}`} value={d.meditation} onChangeText={(t) => updateDay(di, { meditation: t })} placeholder="Breve meditazione (opzionale)" placeholderTextColor={ADMIN.muted} multiline style={[styles.input, { height: 70, textAlignVertical: "top" }]} />

            {d.readings.map((r, ri) => (
              <View key={ri} style={styles.readingRow}>
                <PressableScale testID={`plan-day-${di}-book-${ri}`} style={styles.bookBtn} onPress={() => setPicker({ di, ri })}>
                  <Text style={[styles.bookBtnText, !r.book_name && { color: ADMIN.muted }]} numberOfLines={1}>{r.book_name || "Libro"}</Text>
                  <Ionicons name="chevron-down" size={14} color={ADMIN.muted} />
                </PressableScale>
                <TextInput testID={`plan-day-${di}-ch-${ri}`} value={r.chapter ? String(r.chapter) : ""} onChangeText={(t) => updateReading(di, ri, { chapter: parseInt(t, 10) || undefined })} keyboardType="number-pad" placeholder="Cap." placeholderTextColor={ADMIN.muted} style={styles.numInput} />
                <TextInput testID={`plan-day-${di}-vs-${ri}`} value={r.verse_start ? String(r.verse_start) : ""} onChangeText={(t) => updateReading(di, ri, { verse_start: parseInt(t, 10) || undefined })} keyboardType="number-pad" placeholder="v.da" placeholderTextColor={ADMIN.muted} style={styles.numInput} />
                <TextInput testID={`plan-day-${di}-ve-${ri}`} value={r.verse_end ? String(r.verse_end) : ""} onChangeText={(t) => updateReading(di, ri, { verse_end: parseInt(t, 10) || undefined })} keyboardType="number-pad" placeholder="v.a" placeholderTextColor={ADMIN.muted} style={styles.numInput} />
                <PressableScale testID={`plan-day-${di}-remove-reading-${ri}`} onPress={() => removeReading(di, ri)} hitSlop={6}>
                  <Ionicons name="close-circle" size={20} color="#F87171" />
                </PressableScale>
              </View>
            ))}
            <PressableScale testID={`plan-add-reading-${di}`} style={styles.addReadingBtn} onPress={() => addReading(di)}>
              <Ionicons name="add" size={16} color={colors.brandPrimary} />
              <Text style={styles.addReadingText}>Aggiungi lettura</Text>
            </PressableScale>
          </View>
        ))}

        <PressableScale testID="plan-add-day" style={styles.addDayBtn} onPress={addDay}>
          <Ionicons name="add-circle-outline" size={20} color={colors.white} />
          <Text style={styles.addDayText}>Aggiungi giorno</Text>
        </PressableScale>

        <PressableScale testID="plan-save" style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>{isNew ? "Crea piano" : "Salva modifiche"}</Text>}
        </PressableScale>

        {!isNew && (
          <PressableScale testID="plan-delete" style={styles.delBtn} onPress={del}>
            <Ionicons name="trash-outline" size={18} color="#F87171" />
            <Text style={styles.delText}>Elimina piano</Text>
          </PressableScale>
        )}
      </ScrollView>

      {/* Book picker */}
      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Scegli il libro</Text>
            <ScrollView>
              {books.map((b) => (
                <PressableScale key={b.book_nr} testID={`book-pick-${b.book_nr}`} style={styles.bookItem} onPress={() => pickBook(b)}>
                  <Text style={styles.bookItemText}>{b.name}</Text>
                  <Text style={styles.bookItemMeta}>{b.chapters_count} cap.</Text>
                </PressableScale>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.white, borderWidth: 1, borderColor: ADMIN.border, marginBottom: spacing.sm },
  fieldLabel: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  statusRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  statusBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, backgroundColor: ADMIN.card, alignItems: "center", borderWidth: 1, borderColor: ADMIN.border },
  statusBtnOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  statusText: { color: ADMIN.muted, fontSize: 14, fontWeight: "700" },
  statusTextOn: { color: colors.white },
  daysHeader: { marginTop: spacing.md, marginBottom: spacing.md },
  sectionTitle: { color: colors.white, fontSize: 17, fontWeight: "800" },
  dayCard: { backgroundColor: ADMIN.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  dayTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  dayNum: { color: colors.brandSecondary, fontSize: 14, fontWeight: "800" },
  readingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  bookBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: ADMIN.card, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, borderWidth: 1, borderColor: ADMIN.border },
  bookBtnText: { color: colors.white, fontSize: 14, fontWeight: "600", flex: 1 },
  numInput: { width: 48, backgroundColor: ADMIN.card, borderRadius: radius.md, paddingVertical: 10, textAlign: "center", fontSize: 13, color: colors.white, borderWidth: 1, borderColor: ADMIN.border },
  addReadingBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6 },
  addReadingText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
  addDayBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.navySoft, paddingVertical: spacing.md, borderRadius: radius.md, marginBottom: spacing.xl, borderWidth: 1, borderColor: ADMIN.border },
  addDayText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.pill, alignItems: "center" },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  delBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg, marginTop: spacing.sm },
  delText: { color: "#F87171", fontSize: 15, fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(6,10,26,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: ADMIN.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: "70%" },
  sheetTitle: { color: colors.white, fontSize: 18, fontWeight: "800", marginBottom: spacing.md },
  bookItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  bookItemText: { color: colors.white, fontSize: 15, fontWeight: "600" },
  bookItemMeta: { color: ADMIN.muted, fontSize: 12 },
});

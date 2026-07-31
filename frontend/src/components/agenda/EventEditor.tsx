import React, { useEffect, useState } from "react";
import { Modal, View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { ADMIN } from "@/src/components/AdminShell";
import { alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

const PRIORITIES = [{ k: "low", l: "Bassa" }, { k: "normal", l: "Normale" }, { k: "high", l: "Alta" }];

export default function EventEditor({ visible, onClose, onSaved, categories, collaborators, event, defaultDate }: {
  visible: boolean; onClose: () => void; onSaved: () => void;
  categories: any[]; collaborators: any[]; event?: any; defaultDate?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({});

  useEffect(() => {
    if (!visible) return;
    setF(event ? {
      title: event.title, description: event.description || "", category: event.category || "altro",
      date: event.date, start_time: event.start_time || "", end_time: event.end_time || "",
      location: event.location || "", link: event.link || "", priority: event.priority || "normal",
      invitees: event.invitees || [], tags: (event.tags || []).join(", "),
    } : {
      title: "", description: "", category: categories[0]?.key || "altro",
      date: defaultDate || "", start_time: "", end_time: "", location: "", link: "",
      priority: "normal", invitees: [], tags: "",
    });
  }, [visible, event, defaultDate, categories]);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const toggleInvitee = (id: string) => set("invitees", f.invitees?.includes(id) ? f.invitees.filter((x: string) => x !== id) : [...(f.invitees || []), id]);

  const save = async () => {
    if (!f.title?.trim()) { alertMessage("Titolo obbligatorio", "Inserisci un titolo per l'evento."); return; }
    if (!f.date?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) { alertMessage("Data non valida", "Usa il formato AAAA-MM-GG (es. 2026-07-15)."); return; }
    setSaving(true);
    const body = { ...f, tags: (f.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean) };
    try {
      if (event) await api.agendaUpdate(event.id, body);
      else await api.agendaCreate(body);
      onSaved();
      onClose();
    } catch (e: any) {
      alertMessage("Errore", e?.message || "Impossibile salvare l'evento.");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.hTitle}>{event ? "Modifica evento" : "Nuovo evento"}</Text>
            <Pressable testID="event-editor-close" onPress={onClose} hitSlop={10}><Ionicons name="close" size={26} color={colors.white} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Label t="Titolo *" />
            <TextInput testID="event-title" value={f.title} onChangeText={(v) => set("title", v)} placeholder="Es. Riunione Staff" placeholderTextColor={ADMIN.muted} style={styles.input} />

            <Label t="Descrizione" />
            <TextInput value={f.description} onChangeText={(v) => set("description", v)} placeholder="Dettagli…" placeholderTextColor={ADMIN.muted} style={[styles.input, { height: 80, textAlignVertical: "top" }]} multiline />

            <Label t="Categoria" />
            <View style={styles.chips}>
              {categories.map((c) => (
                <Pressable key={c.key} onPress={() => set("category", c.key)} style={[styles.chip, f.category === c.key && { backgroundColor: c.color, borderColor: c.color }]}>
                  <Text style={[styles.chipText, f.category === c.key && { color: "#fff" }]}>{c.emoji} {c.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}><Label t="Data *" /><TextInput testID="event-date" value={f.date} onChangeText={(v) => set("date", v)} placeholder="2026-07-15" placeholderTextColor={ADMIN.muted} style={styles.input} /></View>
            </View>
            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}><Label t="Ora inizio" /><TextInput value={f.start_time} onChangeText={(v) => set("start_time", v)} placeholder="18:00" placeholderTextColor={ADMIN.muted} style={styles.input} /></View>
              <View style={{ flex: 1 }}><Label t="Ora fine" /><TextInput value={f.end_time} onChangeText={(v) => set("end_time", v)} placeholder="19:00" placeholderTextColor={ADMIN.muted} style={styles.input} /></View>
            </View>

            <Label t="Luogo" />
            <TextInput value={f.location} onChangeText={(v) => set("location", v)} placeholder="Sede / indirizzo" placeholderTextColor={ADMIN.muted} style={styles.input} />
            <Label t="Link (Meet / Zoom / Teams)" />
            <TextInput value={f.link} onChangeText={(v) => set("link", v)} placeholder="https://…" placeholderTextColor={ADMIN.muted} autoCapitalize="none" style={styles.input} />

            <Label t="Priorità" />
            <View style={styles.chips}>
              {PRIORITIES.map((p) => (
                <Pressable key={p.k} onPress={() => set("priority", p.k)} style={[styles.chip, f.priority === p.k && styles.chipOn]}>
                  <Text style={[styles.chipText, f.priority === p.k && { color: "#fff" }]}>{p.l}</Text>
                </Pressable>
              ))}
            </View>

            <Label t="Invita collaboratori" />
            <View style={styles.chips}>
              {collaborators.map((c) => (
                <Pressable key={c.user_id} testID={`invitee-${c.user_id}`} onPress={() => toggleInvitee(c.user_id)} style={[styles.chip, f.invitees?.includes(c.user_id) && styles.chipOn]}>
                  <Text style={[styles.chipText, f.invitees?.includes(c.user_id) && { color: "#fff" }]}>{c.name}</Text>
                </Pressable>
              ))}
            </View>

            <Label t="Tag (separati da virgola)" />
            <TextInput value={f.tags} onChangeText={(v) => set("tags", v)} placeholder="podcast, urgente" placeholderTextColor={ADMIN.muted} style={styles.input} />

            <Pressable testID="event-save" onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{event ? "Salva modifiche" : "Crea evento"}</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const Label = ({ t }: { t: string }) => <Text style={styles.label}>{t}</Text>;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { height: "92%", backgroundColor: ADMIN.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  hTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  label: { color: ADMIN.muted, fontSize: 12, fontWeight: "700", marginBottom: 6, marginTop: spacing.md },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: ADMIN.border },
  rowFields: { flexDirection: "row", gap: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: ADMIN.muted, fontSize: 13, fontWeight: "600" },
  saveBtn: { backgroundColor: colors.brandPrimary, borderRadius: radius.lg, paddingVertical: 15, alignItems: "center", marginTop: spacing.xl },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});

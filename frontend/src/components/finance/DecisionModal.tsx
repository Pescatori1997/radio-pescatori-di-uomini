import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { alertMessage } from "@/src/utils/confirm";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const ADMIN = { bg: "#0A1128", card: "#1E293B", border: "#243049", muted: "#94A3B8" };
const today = () => new Date().toISOString().slice(0, 10);

export default function DecisionModal({ visible, onClose, onSaved, decision }: {
  visible: boolean; onClose: () => void; onSaved: () => void; decision: any;
}) {
  const isEdit = !!decision;
  const [date, setDate] = useState(today());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDate(decision?.date || today());
      setTitle(decision?.title || "");
      setDescription(decision?.description || "");
    }
  }, [visible, decision]);

  const save = async () => {
    if (!title.trim()) return alertMessage("Titolo obbligatorio", "Inserisci un titolo.");
    setSaving(true);
    try {
      const body = { date, title: title.trim(), description: description.trim() };
      if (isEdit) await api.financeUpdateDecision(decision.id, body); else await api.financeCreateDecision(body);
      onSaved(); onClose();
    } catch (e: any) { alertMessage("Errore", e?.message || "Riprova"); } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{isEdit ? "Modifica" : "Nuova"} Decisione</Text>
            <PressableScale onPress={onClose}><Ionicons name="close" size={24} color={colors.white} /></PressableScale>
          </View>
          <Text style={styles.label}>Data</Text>
          <TextInput testID="dec-date" value={date} onChangeText={setDate} placeholder="AAAA-MM-GG" placeholderTextColor={ADMIN.muted} style={styles.input} />
          <Text style={styles.label}>Titolo</Text>
          <TextInput testID="dec-title" value={title} onChangeText={setTitle} placeholder="Es. Rinnovato il dominio" placeholderTextColor={ADMIN.muted} style={styles.input} />
          <Text style={styles.label}>Descrizione</Text>
          <TextInput testID="dec-desc" value={description} onChangeText={setDescription} multiline placeholder="Dettagli (facoltativi)" placeholderTextColor={ADMIN.muted} style={[styles.input, { height: 90, textAlignVertical: "top" }]} />
          <PressableScale testID="dec-save" style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{isEdit ? "Salva" : "Aggiungi decisione"}</Text>}
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: ADMIN.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing["2xl"] },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: ADMIN.border, alignSelf: "center", marginBottom: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  title: { color: colors.white, fontSize: 18, fontWeight: "800" },
  label: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: ADMIN.border, marginBottom: spacing.md },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.sm },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

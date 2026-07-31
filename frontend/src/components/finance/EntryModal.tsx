import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, ScrollView, TextInput, Pressable, ActivityIndicator, Platform, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/src/api";
import { alertMessage } from "@/src/utils/confirm";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const ADMIN = { bg: "#0A1128", card: "#1E293B", border: "#243049", muted: "#94A3B8" };
const today = () => new Date().toISOString().slice(0, 10);

function Dropdown({ label, value, options, onChange, testID }: { label: string; value?: string; options: string[]; onChange: (v: string) => void; testID?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable testID={testID} style={styles.input} onPress={() => setOpen(true)}>
        <Text style={{ color: value ? colors.white : ADMIN.muted, flex: 1 }}>{value || "Seleziona..."}</Text>
        <Ionicons name="chevron-down" size={16} color={ADMIN.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.ddBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.ddSheet}>
            <ScrollView>
              {options.map((o) => (
                <PressableScale key={o} testID={`opt-${o}`} style={styles.ddItem} onPress={() => { onChange(o); setOpen(false); }}>
                  <Text style={styles.ddItemText}>{o}</Text>
                  {value === o && <Ionicons name="checkmark" size={18} color={colors.brandPrimary} />}
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function EntryModal({ visible, onClose, onSaved, entry, type, categories, paymentMethods, readOnly }: {
  visible: boolean; onClose: () => void; onSaved: () => void;
  entry: any; type: "income" | "expense";
  categories: string[]; paymentMethods: string[]; readOnly?: boolean;
}) {
  const isEdit = !!entry;
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [source, setSource] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDate(entry?.date || today());
      setDescription(entry?.description || "");
      setCategory(entry?.category || "");
      setAmount(entry?.amount != null ? String(entry.amount) : "");
      setPaymentMethod(entry?.payment_method || "");
      setSource(entry?.source || "");
      setPaidBy(entry?.paid_by || "");
      setNotes(entry?.notes || "");
      setAttachment(null);
      setAttachmentName(entry?.attachment_name || (entry?.has_attachment ? "Allegato esistente" : null));
      setRemoveAttachment(false);
    }
  }, [visible, entry]);

  const pickAttachment = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { alertMessage("Permesso necessario", "Consenti l'accesso alle foto per allegare una ricevuta."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) {
      setAttachment(`data:image/jpeg;base64,${res.assets[0].base64}`);
      setAttachmentName(res.assets[0].fileName || "ricevuta.jpg");
      setRemoveAttachment(false);
    }
  };

  const save = async () => {
    if (!description.trim()) return alertMessage("Descrizione obbligatoria", "Inserisci una descrizione.");
    if (!category) return alertMessage("Categoria obbligatoria", "Seleziona una categoria.");
    const amt = parseFloat(amount.replace(",", "."));
    if (!amt || amt <= 0) return alertMessage("Importo non valido", "Inserisci un importo maggiore di zero.");
    const body: any = {
      type, date, description: description.trim(), category, amount: amt, notes: notes.trim() || null,
    };
    if (type === "income") { body.payment_method = paymentMethod || null; body.source = source.trim() || null; }
    else { body.paid_by = paidBy.trim() || null; }
    if (attachment) { body.attachment = attachment; body.attachment_name = attachmentName; }
    else if (removeAttachment) { body.remove_attachment = true; }
    setSaving(true);
    try {
      if (isEdit) await api.financeUpdateEntry(entry.id, body); else await api.financeCreateEntry(body);
      onSaved(); onClose();
    } catch (e: any) { alertMessage("Errore", e?.message || "Riprova"); } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{readOnly ? "Dettaglio" : isEdit ? "Modifica" : "Nuova"} {type === "income" ? "Entrata" : "Uscita"}</Text>
            <PressableScale onPress={onClose}><Ionicons name="close" size={24} color={colors.white} /></PressableScale>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Data</Text>
            <TextInput testID="fin-date" value={date} onChangeText={setDate} placeholder="AAAA-MM-GG" placeholderTextColor={ADMIN.muted} style={styles.input} />
            <Text style={styles.label}>Descrizione</Text>
            <TextInput testID="fin-desc" value={description} onChangeText={setDescription} placeholder="Descrizione" placeholderTextColor={ADMIN.muted} style={styles.input} />
            <Dropdown testID="fin-category" label="Categoria" value={category} options={categories} onChange={setCategory} />
            <Text style={styles.label}>Importo (€)</Text>
            <TextInput testID="fin-amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={ADMIN.muted} style={styles.input} />
            {type === "income" ? (
              <>
                <Dropdown testID="fin-method" label="Metodo di pagamento" value={paymentMethod} options={paymentMethods} onChange={setPaymentMethod} />
                <Text style={styles.label}>Provenienza</Text>
                <TextInput testID="fin-source" value={source} onChangeText={setSource} placeholder="Es. Donazione dal sito" placeholderTextColor={ADMIN.muted} style={styles.input} />
              </>
            ) : (
              <>
                <Text style={styles.label}>Pagato da</Text>
                <TextInput testID="fin-paidby" value={paidBy} onChangeText={setPaidBy} placeholder="Nome" placeholderTextColor={ADMIN.muted} style={styles.input} />
              </>
            )}
            <Text style={styles.label}>{type === "income" ? "Allegato (facoltativo)" : "Ricevuta / Fattura"}</Text>
            {attachment ? (
              <View style={styles.attachPreview}>
                <Image source={{ uri: attachment }} style={styles.attachImg} contentFit="cover" />
                <PressableScale onPress={() => { setAttachment(null); setAttachmentName(null); }} style={styles.attachRemove}><Ionicons name="trash" size={16} color="#fff" /></PressableScale>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
                <PressableScale testID="fin-attach" style={[styles.attachBtn, { flex: 1, marginBottom: 0 }]} onPress={pickAttachment}>
                  <Ionicons name="attach" size={18} color={colors.brandPrimary} />
                  <Text style={styles.attachText} numberOfLines={1}>{attachmentName || "Allega ricevuta / fattura"}</Text>
                </PressableScale>
                {!!attachmentName && (
                  <PressableScale onPress={() => { setAttachmentName(null); setRemoveAttachment(true); }} style={styles.attachRemoveBtn}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </PressableScale>
                )}
              </View>
            )}
            <Text style={styles.label}>Note</Text>
            <TextInput testID="fin-notes" value={notes} onChangeText={setNotes} multiline placeholder="Note (facoltative)" placeholderTextColor={ADMIN.muted} style={[styles.input, { height: 70, textAlignVertical: "top" }]} />

            <PressableScale testID="fin-save" style={[styles.saveBtn, saving && { opacity: 0.6 }, readOnly && { display: "none" }]} onPress={save} disabled={saving || readOnly}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{isEdit ? "Salva modifiche" : "Aggiungi movimento"}</Text>}
            </PressableScale>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: ADMIN.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: "92%" },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: ADMIN.border, alignSelf: "center", marginBottom: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  title: { color: colors.white, fontSize: 18, fontWeight: "800" },
  label: { color: ADMIN.muted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { flexDirection: "row", alignItems: "center", backgroundColor: ADMIN.card, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: ADMIN.border, marginBottom: spacing.md },
  attachBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border, borderStyle: "dashed", marginBottom: spacing.md },
  attachText: { color: colors.brandPrimary, fontSize: 14, fontWeight: "700", flex: 1 },
  attachPreview: { marginBottom: spacing.md },
  attachImg: { width: "100%", height: 160, borderRadius: radius.md },
  attachRemove: { position: "absolute", top: 8, right: 8, backgroundColor: colors.error, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  attachRemoveBtn: { backgroundColor: colors.error, width: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.sm },
  saveText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  ddBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.xl },
  ddSheet: { backgroundColor: ADMIN.card, borderRadius: radius.md, maxHeight: "60%", borderWidth: 1, borderColor: ADMIN.border },
  ddItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  ddItemText: { color: colors.white, fontSize: 15 },
});

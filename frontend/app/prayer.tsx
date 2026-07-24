import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

export default function Prayer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [anon, setAnon] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (text.trim().length < 3) { setError("Scrivi la tua richiesta"); return; }
    setSending(true); setError("");
    try {
      await api.prayer({ text: text.trim(), name: anon ? null : name.trim() || null, anonymous: anon });
      setSent(true);
    } catch (e: any) {
      setError(e.message || "Errore di invio");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.successIcon}><Ionicons name="heart" size={40} color={colors.brandPrimary} /></View>
        <Text style={styles.successTitle}>Grazie per la tua richiesta</Text>
        <Text style={styles.successSub}>Pregheremo insieme a te. "L'Eterno è vicino a quelli che hanno il cuore rotto." (Salmo 34:18)</Text>
        <Pressable testID="prayer-done" style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Torna alla Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="prayer-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>Richiesta di Preghiera</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Condividi ciò che hai nel cuore. La tua richiesta arriverà al nostro team di preghiera.</Text>

        <Text style={styles.label}>La tua richiesta</Text>
        <TextInput
          testID="prayer-text"
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Scrivi qui la tua richiesta di preghiera..."
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.textArea]}
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Invia in forma anonima</Text>
            <Text style={styles.switchSub}>Il tuo nome non verrà mostrato</Text>
          </View>
          <Switch testID="prayer-anon" value={anon} onValueChange={setAnon} trackColor={{ true: colors.brandPrimary }} />
        </View>

        {!anon && (
          <>
            <Text style={styles.label}>Nome (facoltativo)</Text>
            <TextInput testID="prayer-name" value={name} onChangeText={setName} placeholder="Il tuo nome" placeholderTextColor={colors.muted} style={styles.input} />
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="prayer-submit" style={[styles.primaryBtn, sending && { opacity: 0.6 }]} disabled={sending} onPress={submit}>
          <Text style={styles.primaryBtnText}>{sending ? "Invio..." : "Invia richiesta"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  intro: { fontSize: 15, color: colors.onSurfaceSecondary, lineHeight: 22, marginBottom: spacing.xl },
  label: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.onSurface },
  textArea: { height: 140, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl },
  switchLabel: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  switchSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  error: { color: colors.error, marginTop: spacing.md, fontSize: 14 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  primaryBtn: { backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center" },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  successTitle: { fontSize: 22, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  successSub: { fontSize: 15, color: colors.onSurfaceSecondary, textAlign: "center", marginTop: spacing.md, lineHeight: 22, marginBottom: spacing.xl },
});

import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

export default function Prayer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"board" | "private">("private");
  const [showName, setShowName] = useState(true); // board only: true = show name, false = anonymous
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!user) { router.push("/login"); return; }
    if (text.trim().length < 3) { setError("Scrivi la tua richiesta"); return; }
    setSending(true); setError("");
    try {
      await api.prayer({
        text: text.trim(),
        visibility,
        show_name: visibility === "board" ? showName : false,
        name: name.trim() || null,
      });
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
        <Text style={styles.successSub}>{visibility === "board" ? "La tua richiesta sarà pubblicata sulla Bacheca dopo l'approvazione di un amministratore." : "Pregheremo insieme a te."} "L'Eterno è vicino a chi ha il cuore spezzato." (Salmo 34:18)</Text>
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
        <Pressable testID="open-prayer-board" onPress={() => router.push("/prayer-board")} hitSlop={12}><Ionicons name="heart-circle" size={26} color={colors.brandPrimary} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Condividi ciò che hai nel cuore. La tua richiesta arriverà al nostro team di preghiera.</Text>

        {!user && (
          <Pressable testID="prayer-login-prompt" style={styles.guestPrompt} onPress={() => router.push("/login")}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.brandPrimary} />
            <Text style={styles.guestPromptText}>Accedi o registrati per inviare la tua richiesta di preghiera.</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brandPrimary} />
          </Pressable>
        )}

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

        <Text style={styles.label}>Dove vuoi inviarla?</Text>
        <View style={styles.optionCol}>
          <Pressable testID="prayer-vis-board" onPress={() => setVisibility("board")} style={[styles.optionCard, visibility === "board" && styles.optionCardOn]}>
            <Ionicons name={visibility === "board" ? "radio-button-on" : "radio-button-off"} size={20} color={visibility === "board" ? colors.brandPrimary : colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>📢 Pubblica sulla Bacheca</Text>
              <Text style={styles.optionSub}>Visibile alla comunità dopo l'approvazione di un amministratore.</Text>
            </View>
          </Pressable>
          <Pressable testID="prayer-vis-private" onPress={() => setVisibility("private")} style={[styles.optionCard, visibility === "private" && styles.optionCardOn]}>
            <Ionicons name={visibility === "private" ? "radio-button-on" : "radio-button-off"} size={20} color={visibility === "private" ? colors.brandPrimary : colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>🔒 Invia solo agli amministratori</Text>
              <Text style={styles.optionSub}>Solo il team di preghiera vedrà la tua richiesta.</Text>
            </View>
          </Pressable>
        </View>

        {visibility === "board" && (
          <>
            <Text style={styles.label}>Come vuoi apparire sulla Bacheca?</Text>
            <View style={styles.optionCol}>
              <Pressable testID="prayer-showname-yes" onPress={() => setShowName(true)} style={[styles.optionCard, showName && styles.optionCardOn]}>
                <Ionicons name={showName ? "radio-button-on" : "radio-button-off"} size={20} color={showName ? colors.brandPrimary : colors.muted} />
                <Text style={styles.optionTitle}>Mostra il mio nome</Text>
              </Pressable>
              <Pressable testID="prayer-showname-no" onPress={() => setShowName(false)} style={[styles.optionCard, !showName && styles.optionCardOn]}>
                <Ionicons name={!showName ? "radio-button-on" : "radio-button-off"} size={20} color={!showName ? colors.brandPrimary : colors.muted} />
                <Text style={styles.optionTitle}>Pubblica in forma anonima</Text>
              </Pressable>
            </View>
          </>
        )}

        {((visibility === "board" && showName) || visibility === "private") && (
          <>
            <Text style={styles.label}>Nome {visibility === "private" ? "(facoltativo)" : ""}</Text>
            <TextInput testID="prayer-name" value={name} onChangeText={setName} placeholder="Il tuo nome" placeholderTextColor={colors.muted} style={styles.input} />
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="prayer-submit" style={[styles.primaryBtn, sending && { opacity: 0.6 }]} disabled={sending} onPress={submit}>
          <Text style={styles.primaryBtnText}>{!user ? "Accedi per inviare" : sending ? "Invio..." : "Invia richiesta"}</Text>
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
  guestPrompt: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  guestPromptText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.onBrandTertiary },
  label: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.onSurface },
  textArea: { height: 140, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl },
  switchLabel: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  switchSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  optionCol: { gap: spacing.sm, marginTop: spacing.sm },
  optionCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1.5, borderColor: colors.border },
  optionCardOn: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  optionTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  optionSub: { fontSize: 12.5, color: colors.onSurfaceSecondary, marginTop: 2 },
  error: { color: colors.error, marginTop: spacing.md, fontSize: 14 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  primaryBtn: { backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center" },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  successTitle: { fontSize: 22, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  successSub: { fontSize: 15, color: colors.onSurfaceSecondary, textAlign: "center", marginTop: spacing.md, lineHeight: 22, marginBottom: spacing.xl },
});

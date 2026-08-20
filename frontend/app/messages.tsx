import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { useSiteText } from "@/src/context/SiteTextsContext";
import { colors, spacing, radius } from "@/src/theme";

export default function Messages() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { sm } = useSiteText();
  const meta = sm("messages");
  const [type, setType] = useState<"message" | "testimony">("message");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [testimonies, setTestimonies] = useState<any[]>([]);

  const loadTestimonies = useCallback(() => {
    api.testimonies().then(setTestimonies).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { loadTestimonies(); }, [loadTestimonies]));

  const submit = async () => {
    if (!user) { router.push("/login"); return; }
    if (text.trim().length < 3) return;
    setBusy(true);
    try {
      await api.message({ text: text.trim(), name: name.trim() || null, type });
      setSent(true); setText("");
    } catch {} finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="messages-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>{meta.name ?? "Messaggi"}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{meta.subtitle ?? "Invia un messaggio o una testimonianza: la leggeremo durante le dirette."}</Text>

        {!user && (
          <Pressable testID="msg-login-prompt" style={styles.guestPrompt} onPress={() => router.push("/login")}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.brandPrimary} />
            <Text style={styles.guestPromptText}>Accedi o registrati per inviare il tuo messaggio.</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brandPrimary} />
          </Pressable>
        )}

        <View style={styles.toggle}>
          {(["message", "testimony"] as const).map((t) => (
            <Pressable key={t} testID={`msg-type-${t}`} onPress={() => setType(t)} style={[styles.toggleBtn, type === t && styles.toggleActive]}>
              <Text style={[styles.toggleText, type === t && styles.toggleTextActive]}>{t === "message" ? "Messaggio" : "Testimonianza"}</Text>
            </Pressable>
          ))}
        </View>

        {sent && <Text style={styles.success}>Grazie! Il tuo {type === "message" ? "messaggio" : "racconto"} è stato inviato.</Text>}

        <Text style={styles.label}>Nome (facoltativo)</Text>
        <TextInput testID="msg-name" value={name} onChangeText={setName} placeholder="Il tuo nome" placeholderTextColor={colors.muted} style={styles.input} />

        <Text style={styles.label}>{type === "message" ? "Il tuo messaggio" : "La tua testimonianza"}</Text>
        <TextInput testID="msg-text" value={text} onChangeText={setText} multiline placeholder="Scrivi qui..." placeholderTextColor={colors.muted} style={[styles.input, { height: 160, textAlignVertical: "top" }]} />

        <View style={styles.voiceNote}>
          <Ionicons name="mic-outline" size={20} color={colors.brandPrimary} />
          <Text style={styles.voiceText}>L'invio di messaggi vocali sarà disponibile al lancio di settembre.</Text>
        </View>

        <Pressable testID="msg-submit" style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>{!user ? "Accedi per inviare" : busy ? "Invio..." : "Invia"}</Text>
        </Pressable>

        {testimonies.length > 0 && (
          <View style={styles.testiSection}>
            <Text style={styles.testiTitle}>Testimonianze della comunità</Text>
            {testimonies.map((t) => (
              <View key={t.id} testID={`testimony-${t.id}`} style={styles.testiCard}>
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.testiText}>{t.text}</Text>
                  <Text style={styles.testiName}>— {t.name || "Anonimo"}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  intro: { fontSize: 15, color: colors.onSurfaceSecondary, lineHeight: 22 },
  guestPrompt: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  guestPromptText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.onBrandTertiary },
  toggle: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 4, marginTop: spacing.lg },
  toggleBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: "center" },
  toggleActive: { backgroundColor: colors.navy },
  toggleText: { fontSize: 14, fontWeight: "700", color: colors.onSurfaceSecondary },
  toggleTextActive: { color: colors.white },
  success: { color: colors.success, fontSize: 14, marginTop: spacing.lg },
  label: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.onSurface },
  voiceNote: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  voiceText: { flex: 1, fontSize: 13, color: colors.onBrandTertiary },
  primaryBtn: { backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.xl },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  testiSection: { marginTop: spacing["2xl"] },
  testiTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.md },
  testiCard: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  testiText: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  testiName: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700", marginTop: spacing.sm },
});

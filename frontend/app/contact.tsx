import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

export default function Contact() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const channels = [
    { icon: "mail", label: "Email", value: "info@pescatoridiuomini.it", action: () => Linking.openURL("mailto:info@pescatoridiuomini.it") },
    { icon: "logo-whatsapp", label: "WhatsApp", value: "+39 000 000 0000", action: () => Linking.openURL("https://wa.me/390000000000") },
    { icon: "logo-instagram", label: "Instagram", value: "@pescatoridiuomini", action: () => Linking.openURL("https://instagram.com") },
    { icon: "logo-facebook", label: "Facebook", value: "Pescatori di Uomini", action: () => Linking.openURL("https://facebook.com") },
  ];

  const submit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setBusy(true);
    try {
      await api.contact({ name: name.trim(), email: email.trim(), message: message.trim() });
      setSent(true); setName(""); setEmail(""); setMessage("");
    } catch {} finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="contact-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>Contatti</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.channels}>
          {channels.map((c) => (
            <Pressable key={c.label} testID={`contact-${c.label}`} style={styles.channelRow} onPress={c.action}>
              <Ionicons name={c.icon as any} size={22} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.channelLabel}>{c.label}</Text>
                <Text style={styles.channelValue}>{c.value}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.formTitle}>Scrivici un messaggio</Text>
        {sent && <Text style={styles.success}>Messaggio inviato! Ti risponderemo presto.</Text>}
        <TextInput testID="contact-name" placeholder="Nome" placeholderTextColor={colors.muted} value={name} onChangeText={setName} style={styles.input} />
        <TextInput testID="contact-email" placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} />
        <TextInput testID="contact-message" placeholder="Il tuo messaggio" placeholderTextColor={colors.muted} value={message} onChangeText={setMessage} multiline style={[styles.input, { height: 120, textAlignVertical: "top" }]} />
        <Pressable testID="contact-submit" style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? "Invio..." : "Invia"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  channels: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, overflow: "hidden" },
  channelRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  channelLabel: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  channelValue: { fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 2 },
  formTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  success: { color: colors.success, fontSize: 14, marginBottom: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.onSurface, marginBottom: spacing.md },
  primaryBtn: { backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center" },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

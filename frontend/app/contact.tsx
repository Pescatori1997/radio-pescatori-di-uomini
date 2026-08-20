import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useSiteText } from "@/src/context/SiteTextsContext";
import { colors, spacing, radius } from "@/src/theme";

const digits = (s: string) => (s || "").replace(/[^\d+]/g, "").replace(/^\+/, "");

function buildChannels(s: Record<string, string>) {
  const list: { icon: string; label: string; value: string; action: () => void }[] = [];
  if (s.contact_email) list.push({ icon: "mail", label: "Email", value: s.contact_email, action: () => Linking.openURL(`mailto:${s.contact_email}`) });
  if (s.contact_phone) list.push({ icon: "call", label: "Telefono", value: s.contact_phone, action: () => Linking.openURL(`tel:${digits(s.contact_phone)}`) });
  if (s.whatsapp) list.push({ icon: "logo-whatsapp", label: "WhatsApp", value: s.whatsapp, action: () => Linking.openURL(`https://wa.me/${digits(s.whatsapp)}`) });
  if (s.address) list.push({ icon: "location", label: "Indirizzo", value: s.address, action: () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`) });
  if (s.website) list.push({ icon: "globe", label: "Sito web", value: s.website, action: () => Linking.openURL(s.website.startsWith("http") ? s.website : `https://${s.website}`) });
  if (s.facebook) list.push({ icon: "logo-facebook", label: "Facebook", value: s.facebook, action: () => Linking.openURL(s.facebook.startsWith("http") ? s.facebook : `https://${s.facebook}`) });
  if (s.instagram) list.push({ icon: "logo-instagram", label: "Instagram", value: s.instagram, action: () => Linking.openURL(s.instagram.startsWith("http") ? s.instagram : `https://${s.instagram}`) });
  if (s.youtube) list.push({ icon: "logo-youtube", label: "YouTube", value: s.youtube, action: () => Linking.openURL(s.youtube.startsWith("http") ? s.youtube : `https://${s.youtube}`) });
  return list;
}

export default function Contact() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sm } = useSiteText();
  const meta = sm("contact");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [channels, setChannels] = useState<ReturnType<typeof buildChannels>>([]);

  useFocusEffect(
    useCallback(() => {
      api.settings().then((d: any) => setChannels(buildChannels(d || {}))).catch(() => {});
    }, [])
  );

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
        <Text style={styles.headerTitle}>{meta.name ?? "Contatti"}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {!!meta.subtitle && <Text style={styles.headerSub}>{meta.subtitle}</Text>}
        {channels.length > 0 && (
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
        )}

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
  headerSub: { fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 20, marginBottom: spacing.lg },
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

import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import PressableScale from "@/src/components/PressableScale";
import { Image } from "expo-image";
import { colors, spacing, radius } from "@/src/theme";

const LOGO = require("@/assets/images/logo.png");

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { loginEmail, register, loginGoogle, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError(""); setBusy(true);
    try {
      if (mode === "register") await register(name.trim(), email.trim(), password);
      else await loginEmail(email.trim(), password);
      // Root gate redirects to the app once `user` is set.
    } catch (e: any) {
      setError(e.message || "Errore");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(""); setBusy(true);
    try {
      await loginGoogle();
    } catch (e: any) {
      setError(e.message || "Errore accesso Google");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logoBadge}><Image source={LOGO} style={styles.logoImg} contentFit="contain" /></View>
          <Text style={styles.brand}>Pescatori di Uomini</Text>
          <Text style={styles.tagline}>Radio Evangelica Cristiana</Text>
        </View>

        <Text style={styles.title}>{mode === "login" ? "Bentornato" : "Crea un account"}</Text>
        <Text style={styles.sub}>Accedi per salvare preferiti, cronologia, richieste di preghiera e ricevere aggiornamenti.</Text>

        <PressableScale testID="welcome-google" style={styles.googleBtn} onPress={google} disabled={busy}>
          <Ionicons name="logo-google" size={20} color={colors.navy} />
          <Text style={styles.googleText}>Continua con Google</Text>
        </PressableScale>

        <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>oppure</Text><View style={styles.line} /></View>

        {mode === "register" && (
          <TextInput testID="welcome-name" placeholder="Nome" placeholderTextColor={colors.muted} value={name} onChangeText={setName} style={styles.input} />
        )}
        <TextInput testID="welcome-email" placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} />
        <TextInput testID="welcome-password" placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PressableScale testID="welcome-submit" style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{mode === "login" ? "Accedi" : "Registrati"}</Text>}
        </PressableScale>

        <Pressable testID="welcome-toggle" onPress={() => setMode(mode === "login" ? "register" : "login")} style={{ marginTop: spacing.lg }}>
          <Text style={styles.toggle}>
            {mode === "login" ? "Non hai un account? " : "Hai già un account? "}
            <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>{mode === "login" ? "Registrati" : "Accedi"}</Text>
          </Text>
        </Pressable>

        <View style={styles.guestDivider}><View style={styles.line} /></View>

        <Pressable testID="welcome-guest" onPress={continueAsGuest} disabled={busy} style={styles.guestBtn}>
          <Ionicons name="eye-outline" size={18} color={colors.onSurfaceSecondary} />
          <Text style={styles.guestText}>Continua come Ospite</Text>
        </Pressable>
        <Text style={styles.guestNote}>Come ospite puoi ascoltare ed esplorare. Accedi per salvare preferiti e interagire.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { alignItems: "center", marginBottom: spacing.xl },
  logoBadge: { width: 84, height: 84, borderRadius: 24, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  logoImg: { width: 68, height: 68 },
  brand: { fontSize: 22, fontWeight: "800", color: colors.onSurface, marginTop: spacing.md },
  tagline: { fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 2 },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: 14, color: colors.onSurfaceSecondary, marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 20 },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: spacing.md },
  googleText: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.xl },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.muted, fontSize: 13 },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.onSurface, marginBottom: spacing.md },
  error: { color: colors.error, fontSize: 14, marginBottom: spacing.md },
  primaryBtn: { backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.sm },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  toggle: { textAlign: "center", color: colors.onSurfaceSecondary, fontSize: 14 },
  guestDivider: { marginVertical: spacing.xl },
  guestBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  guestText: { fontSize: 15, fontWeight: "700", color: colors.onSurfaceSecondary },
  guestNote: { textAlign: "center", color: colors.muted, fontSize: 12, marginTop: spacing.md, lineHeight: 18 },
});

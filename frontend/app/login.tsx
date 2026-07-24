import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import PressableScale from "@/src/components/PressableScale";
import { Image } from "expo-image";
import { colors, spacing, radius } from "@/src/theme";

const LOGO = require("@/assets/images/logo.png");

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loginEmail, register, loginGoogle } = useAuth();
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
      router.back();
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
      router.back();
    } catch (e: any) {
      setError(e.message || "Errore accesso Google");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg }} keyboardShouldPersistTaps="handled">
        <Pressable testID="login-close" onPress={() => router.back()} hitSlop={12} style={{ alignSelf: "flex-start" }}>
          <Ionicons name="close" size={28} color={colors.onSurface} />
        </Pressable>
        <View style={styles.logoBadge}><Image source={LOGO} style={styles.logoImg} contentFit="contain" /></View>
        <Text style={styles.title}>{mode === "login" ? "Bentornato" : "Crea un account"}</Text>
        <Text style={styles.sub}>Accedi per salvare preferiti, cronologia e notifiche.</Text>

        <PressableScale testID="google-login" style={styles.googleBtn} onPress={google} disabled={busy}>
          <Ionicons name="logo-google" size={20} color={colors.navy} />
          <Text style={styles.googleText}>Continua con Google</Text>
        </PressableScale>

        <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>oppure</Text><View style={styles.line} /></View>

        {mode === "register" && (
          <TextInput testID="login-name" placeholder="Nome" placeholderTextColor={colors.muted} value={name} onChangeText={setName} style={styles.input} />
        )}
        <TextInput testID="login-email" placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} />
        <TextInput testID="login-password" placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PressableScale testID="login-submit" style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{mode === "login" ? "Accedi" : "Registrati"}</Text>}
        </PressableScale>

        <Pressable testID="toggle-mode" onPress={() => setMode(mode === "login" ? "register" : "login")} style={{ marginTop: spacing.lg }}>
          <Text style={styles.toggle}>
            {mode === "login" ? "Non hai un account? " : "Hai già un account? "}
            <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>{mode === "login" ? "Registrati" : "Accedi"}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  logoBadge: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border },
  logoImg: { width: 60, height: 60 },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface, marginTop: spacing.lg },
  sub: { fontSize: 15, color: colors.onSurfaceSecondary, marginTop: spacing.sm, marginBottom: spacing.xl },
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
});

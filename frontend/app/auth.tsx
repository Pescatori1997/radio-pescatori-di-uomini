import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import PressableScale from "@/src/components/PressableScale";
import { Image } from "expo-image";
import { colors, spacing, radius } from "@/src/theme";

const LOGO = require("@/assets/images/logo.png");

export default function Auth() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isAdmin = params.mode === "admin";
  const { loginEmail, register, loginGoogle } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(params.mode === "register" ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const goAfterAuth = () => {
    if (isAdmin) router.replace("/admin");
    else router.replace("/(tabs)");
  };

  const submit = async () => {
    setError(""); setBusy(true);
    try {
      if (mode === "register") await register(name.trim(), email.trim(), password);
      else await loginEmail(email.trim(), password);
      goAfterAuth();
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
      // On web this triggers a full-page redirect; on native we continue here.
      if (Platform.OS !== "web") goAfterAuth();
    } catch (e: any) {
      setError(e.message || "Errore accesso Google");
    } finally {
      setBusy(false);
    }
  };

  const title = isAdmin ? "Area Amministrazione" : mode === "login" ? "Bentornato" : "Crea un account";
  const sub = isAdmin
    ? "Accesso riservato agli amministratori e collaboratori autorizzati."
    : "Accedi per salvare preferiti, cronologia, richieste di preghiera e ricevere aggiornamenti.";

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable testID="auth-back" onPress={() => router.back()} hitSlop={12} style={{ alignSelf: "flex-start" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>

        <View style={[styles.logoBadge, isAdmin && { backgroundColor: "#7C3AED22", borderColor: "#7C3AED44" }]}>
          {isAdmin ? <Ionicons name="shield-checkmark" size={34} color="#7C3AED" /> : <Image source={LOGO} style={styles.logoImg} contentFit="contain" />}
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>

        <PressableScale testID="auth-google" style={styles.googleBtn} onPress={google} disabled={busy}>
          <Ionicons name="logo-google" size={20} color={colors.navy} />
          <Text style={styles.googleText}>Continua con Google</Text>
        </PressableScale>

        <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>oppure</Text><View style={styles.line} /></View>

        {mode === "register" && (
          <TextInput testID="auth-name" placeholder="Nome" placeholderTextColor={colors.muted} value={name} onChangeText={setName} style={styles.input} />
        )}
        <TextInput testID="auth-email" placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} />
        <TextInput testID="auth-password" placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PressableScale testID="auth-submit" style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{mode === "login" ? "Accedi" : "Registrati"}</Text>}
        </PressableScale>

        {!isAdmin && (
          <Pressable testID="auth-toggle" onPress={() => setMode(mode === "login" ? "register" : "login")} style={{ marginTop: spacing.lg }}>
            <Text style={styles.toggle}>
              {mode === "login" ? "Non hai un account? " : "Hai già un account? "}
              <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>{mode === "login" ? "Registrati" : "Accedi"}</Text>
            </Text>
          </Pressable>
        )}

        {isAdmin && (
          <View style={styles.adminNote}>
            <Ionicons name="information-circle-outline" size={18} color={colors.onSurfaceSecondary} />
            <Text style={styles.adminNoteText}>Se non disponi dei permessi, verrà mostrata la pagina "Accesso Negato".</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  logoBadge: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border },
  logoImg: { width: 60, height: 60 },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface, marginTop: spacing.lg },
  sub: { fontSize: 15, color: colors.onSurfaceSecondary, marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 21 },
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
  adminNote: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  adminNoteText: { flex: 1, fontSize: 12, color: colors.onSurfaceSecondary, lineHeight: 17 },
});

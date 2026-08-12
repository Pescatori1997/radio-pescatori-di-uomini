import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function ResetPassword() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const requestCode = async () => {
    setError(""); setInfo(""); setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      setInfo("Ti abbiamo inviato un codice via email. Controlla la posta (anche lo spam) e inseriscilo qui sotto.");
      setStep("reset");
    } catch (e: any) {
      const msg = String(e?.message || "");
      setError(msg && !msg.includes("<") && msg.length < 160 ? msg : "Impossibile inviare l'email in questo momento. Riprova più tardi.");
    } finally { setBusy(false); }
  };

  const doReset = async () => {
    setError(""); setBusy(true);
    try {
      await api.resetPassword({ email: email.trim(), code: code.trim(), new_password: pw });
      router.replace("/auth?mode=login" as any);
    } catch (e: any) {
      setError(e.message || "Errore");
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg }} keyboardShouldPersistTaps="handled">
        <Pressable testID="reset-back" onPress={() => router.back()} hitSlop={12} style={{ alignSelf: "flex-start" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.iconCircle}><Ionicons name="lock-closed" size={30} color={colors.white} /></View>
        <Text style={styles.title}>{step === "request" ? "Password dimenticata" : "Reimposta password"}</Text>
        <Text style={styles.sub}>
          {step === "request"
            ? "Inserisci la tua email: ti invieremo un codice per reimpostare la password."
            : "Inserisci il codice ricevuto e scegli una nuova password."}
        </Text>

        {step === "request" ? (
          <TextInput testID="reset-email" placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} />
        ) : (
          <>
            <TextInput testID="reset-code" placeholder="Codice di verifica" placeholderTextColor={colors.muted} keyboardType="number-pad" value={code} onChangeText={setCode} style={styles.input} />
            <TextInput testID="reset-newpw" placeholder="Nuova password (min. 6 caratteri)" placeholderTextColor={colors.muted} secureTextEntry value={pw} onChangeText={setPw} style={styles.input} />
          </>
        )}

        {info ? <Text style={styles.info}>{info}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PressableScale
          testID="reset-submit"
          style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
          onPress={step === "request" ? requestCode : doReset}
          disabled={busy || (step === "request" ? !email.trim() : !code.trim() || pw.length < 6)}
        >
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{step === "request" ? "Invia codice" : "Reimposta password"}</Text>}
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface, marginTop: spacing.lg },
  sub: { fontSize: 15, color: colors.onSurfaceSecondary, marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 21 },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.onSurface, marginBottom: spacing.md },
  info: { color: colors.brandPrimary, fontSize: 13, marginBottom: spacing.md, lineHeight: 19 },
  error: { color: colors.error, fontSize: 14, marginBottom: spacing.md },
  primaryBtn: { backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.sm },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

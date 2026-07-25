import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { Image } from "expo-image";
import { colors, spacing, radius } from "@/src/theme";

const LOGO = require("@/assets/images/logo.png");

const SECTION_LABELS: Record<string, string> = {
  podcasts: "Podcast", news: "Notizie", merch: "Merchandising", schedule: "Palinsesto",
  prayers: "Preghiere", messages: "Messaggi", team: "Team", radio: "Radio",
};

export default function Invite() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { acceptInvite } = useAuth();
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setLoadError("Token mancante"); setLoading(false); return; }
    api.getInvitation(token)
      .then((inv) => setInvite(inv))
      .catch((e: any) => setLoadError(e.message || "Invito non valido"))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    if (name.trim().length < 2) { setError("Inserisci il tuo nome"); return; }
    if (password.length < 6) { setError("La password deve avere almeno 6 caratteri"); return; }
    setBusy(true); setError("");
    try {
      const user = await acceptInvite(token!, name.trim(), password);
      router.replace(user.role === "administrator" || user.role === "collaborator" ? "/admin" : "/(tabs)");
    } catch (e: any) {
      setError(e.message || "Errore");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <View style={[styles.container, styles.center]}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  }

  if (loadError) {
    return (
      <View style={[styles.container, styles.center, { padding: spacing.xl }]}>
        <View style={styles.errIcon}><Ionicons name="close-circle-outline" size={44} color={colors.error} /></View>
        <Text style={styles.errTitle}>Invito non valido</Text>
        <Text style={styles.errSub}>{loadError}</Text>
        <PressableScale testID="invite-home" style={styles.primaryBtn} onPress={() => router.replace("/welcome")}>
          <Text style={styles.primaryText}>Vai alla Home</Text>
        </PressableScale>
      </View>
    );
  }

  const perms: string[] = invite?.permissions || [];
  const roleLabel = invite?.role === "collaborator" ? "Collaboratore" : "Ascoltatore";

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logoBadge}><Image source={LOGO} style={styles.logoImg} contentFit="contain" /></View>
          <Text style={styles.brand}>Pescatori di Uomini</Text>
        </View>

        <Text style={styles.title}>Sei stato invitato!</Text>
        <Text style={styles.sub}>{invite?.invited_by || "L'amministratore"} ti ha invitato come <Text style={{ color: colors.brandPrimary, fontWeight: "800" }}>{roleLabel}</Text>. Crea il tuo account per iniziare.</Text>

        <View style={styles.emailBox}>
          <Ionicons name="mail-outline" size={18} color={colors.onSurfaceSecondary} />
          <Text style={styles.emailText}>{invite?.email}</Text>
        </View>

        {perms.length > 0 && (
          <View style={styles.permsWrap}>
            <Text style={styles.permsTitle}>Sezioni che potrai gestire</Text>
            <View style={styles.permsRow}>
              {perms.map((p) => (
                <View key={p} style={styles.permChip}><Text style={styles.permChipText}>{SECTION_LABELS[p] || p}</Text></View>
              ))}
            </View>
          </View>
        )}

        <TextInput testID="invite-name" placeholder="Il tuo nome" placeholderTextColor={colors.muted} value={name} onChangeText={setName} style={styles.input} />
        <TextInput testID="invite-password" placeholder="Crea una password" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PressableScale testID="invite-submit" style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Accetta e crea account</Text>}
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: spacing.xl },
  logoBadge: { width: 80, height: 80, borderRadius: 22, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  logoImg: { width: 64, height: 64 },
  brand: { fontSize: 20, fontWeight: "800", color: colors.onSurface, marginTop: spacing.md },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: 15, color: colors.onSurfaceSecondary, marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 21 },
  emailBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  emailText: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  permsWrap: { marginBottom: spacing.lg },
  permsTitle: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceSecondary, marginBottom: spacing.sm },
  permsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  permChip: { backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  permChipText: { color: colors.onBrandTertiary, fontSize: 13, fontWeight: "700" },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.onSurface, marginBottom: spacing.md },
  error: { color: colors.error, fontSize: 14, marginBottom: spacing.md },
  primaryBtn: { backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.sm },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  errIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.error + "18", alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  errTitle: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  errSub: { fontSize: 15, color: colors.onSurfaceSecondary, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl },
});

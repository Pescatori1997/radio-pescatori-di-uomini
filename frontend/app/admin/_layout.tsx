import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { ADMIN } from "@/src/components/AdminShell";
import { colors, spacing, radius } from "@/src/theme";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<"checking" | "allowed" | "denied" | "unauth">("checking");

  useEffect(() => {
    if (loading) return;
    if (!user) { setState("unauth"); return; }
    let cancelled = false;
    api.adminMe()
      .then(() => { if (!cancelled) setState("allowed"); })
      .catch(() => { if (!cancelled) setState("denied"); });
    return () => { cancelled = true; };
  }, [user, loading]);

  if (loading || state === "checking") {
    return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  }

  if (state === "allowed") {
    return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: ADMIN.bg } }} />;
  }

  // Access denied / unauthenticated
  return (
    <View style={styles.center}>
      <View style={styles.icon}><Ionicons name="lock-closed" size={40} color={colors.brandPrimary} /></View>
      <Text style={styles.title}>Accesso Negato</Text>
      <Text style={styles.sub}>
        {state === "unauth"
          ? "Devi accedere con un account amministratore autorizzato."
          : "Il tuo account non ha i permessi di amministratore."}
      </Text>
      {state === "unauth" ? (
        <PressableScale testID="admin-login" style={styles.btn} onPress={() => router.push("/login")}>
          <Text style={styles.btnText}>Accedi</Text>
        </PressableScale>
      ) : (
        <PressableScale testID="admin-back-home" style={styles.btn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.btnText}>Torna alla Home</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: ADMIN.bg, padding: spacing.xl },
  icon: { width: 84, height: 84, borderRadius: 42, backgroundColor: "rgba(14,165,233,0.15)", alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  title: { color: colors.white, fontSize: 24, fontWeight: "800" },
  sub: { color: ADMIN.muted, fontSize: 15, textAlign: "center", marginTop: spacing.md, lineHeight: 22 },
  btn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing["2xl"], paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.xl },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

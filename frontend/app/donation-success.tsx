import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

type State = "checking" | "paid" | "pending" | "error" | "expired";
const MAX_POLLS = 6;
const POLL_MS = 2000;

export default function DonationSuccess() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string }>();
  const sessionId = typeof params.session_id === "string" ? params.session_id : undefined;
  const [state, setState] = useState<State>("checking");
  const [amount, setAmount] = useState<number>(0);
  const pollCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    if (!sessionId) { setState("error"); return; }
    try {
      const r = await api.donationStatus(sessionId);
      if (r.payment_status === "paid") { setAmount(r.amount || 0); setState("paid"); return; }
      if (r.status === "expired") { setState("expired"); return; }
      pollCount.current += 1;
      if (pollCount.current >= MAX_POLLS) { setState("pending"); return; }
      timer.current = setTimeout(poll, POLL_MS);
    } catch {
      pollCount.current += 1;
      if (pollCount.current >= MAX_POLLS) { setState("error"); return; }
      timer.current = setTimeout(poll, POLL_MS);
    }
  }, [sessionId]);

  useEffect(() => {
    poll();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [poll]);

  const config = {
    checking: { icon: "hourglass", color: colors.brandPrimary, title: "Verifica del pagamento...", sub: "Attendi qualche istante." },
    paid: { icon: "check-circle", color: colors.success, title: "Grazie di cuore! ❤️", sub: `La tua offerta di €${amount.toFixed(2).replace(/\.00$/, "")} è stata ricevuta. Che Dio ti benedica per la tua generosità.` },
    pending: { icon: "clock-outline", color: colors.warning, title: "Pagamento in elaborazione", sub: "Il tuo pagamento è in fase di conferma. Riceverai l'aggiornamento a breve." },
    expired: { icon: "close-circle", color: colors.error, title: "Sessione scaduta", sub: "La sessione di pagamento è scaduta. Puoi riprovare quando vuoi." },
    error: { icon: "alert-circle", color: colors.error, title: "Qualcosa è andato storto", sub: "Non siamo riusciti a verificare il pagamento. Se l'importo è stato addebitato, contattaci." },
  }[state];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.center}>
        {state === "checking" ? (
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        ) : (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
            <MaterialCommunityIcons name={config.icon as any} size={72} color={config.color} />
            <Text style={styles.title}>{config.title}</Text>
            <Text style={styles.sub}>{config.sub}</Text>
          </Animated.View>
        )}
        {state === "checking" && <Text style={styles.checking}>{config.title}</Text>}
      </View>

      {state !== "checking" && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
          {state === "paid" && (
            <PressableScale testID="success-history" style={styles.ghostBtn} onPress={() => router.replace("/donations-history" as any)}>
              <Ionicons name="receipt-outline" size={18} color={colors.onSurface} />
              <Text style={styles.ghostText}>Le mie offerte</Text>
            </PressableScale>
          )}
          {(state === "expired" || state === "error" || state === "pending") && (
            <PressableScale testID="success-retry" style={styles.ghostBtn} onPress={() => router.replace("/donate" as any)}>
              <Ionicons name="refresh" size={18} color={colors.onSurface} />
              <Text style={styles.ghostText}>Riprova</Text>
            </PressableScale>
          )}
          <PressableScale testID="success-home" style={styles.primaryBtn} onPress={() => router.replace("/(tabs)" as any)}>
            <Text style={styles.primaryText}>Torna alla Home</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { alignItems: "center" },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: "800", marginTop: spacing.lg, textAlign: "center" },
  sub: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 23, marginTop: spacing.md, textAlign: "center" },
  checking: { color: colors.onSurfaceSecondary, fontSize: 15, marginTop: spacing.lg },
  actions: { padding: spacing.xl, gap: spacing.md },
  ghostBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border },
  ghostText: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  primaryBtn: { backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

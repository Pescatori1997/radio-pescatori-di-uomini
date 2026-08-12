import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, ActivityIndicator, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { DEFAULT_DONATE, mergeDonate, DonateConfig } from "@/src/donateConfig";
import { colors, spacing, radius } from "@/src/theme";

function appOrigin(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return process.env.EXPO_PUBLIC_BACKEND_URL || "";
}

export default function Donate() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [cfg, setCfg] = useState<DonateConfig>(DEFAULT_DONATE);
  const [amount, setAmount] = useState<number>(DEFAULT_DONATE.default_amount);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [subLoading, setSubLoading] = useState<string | null>(null);

  useEffect(() => {
    api.settings().then((s: any) => {
      const merged = mergeDonate(s?.donate_config);
      setCfg(merged);
      setAmount(merged.default_amount);
    }).catch(() => {});
  }, []);

  const effectiveAmount = custom ? parseFloat(custom.replace(",", ".")) : amount;
  const valid = !!effectiveAmount && effectiveAmount >= 1 && effectiveAmount <= 5000;

  const selectPreset = (a: number) => { setAmount(a); setCustom(""); };

  const openCheckout = async (url: string, sessionId?: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = url;
    } else {
      await WebBrowser.openBrowserAsync(url);
      if (sessionId) router.push(`/donation-success?session_id=${sessionId}` as any);
    }
  };

  const subscribe = async (plan: string) => {
    setSubLoading(plan);
    try {
      const res = await api.donationSubscribe({ plan, origin_url: appOrigin() });
      await openCheckout(res.url, res.session_id);
    } catch (e: any) {
      Alert.alert("Errore", e?.message || "Impossibile avviare l'abbonamento.");
    } finally {
      setSubLoading(null);
    }
  };

  const donate = async () => {
    if (!valid) { Alert.alert("Importo non valido", "Inserisci un importo tra €1 e €5000."); return; }
    setLoading(true);
    try {
      const origin = appOrigin();
      const res = await api.donationCheckout({
        amount: Number(effectiveAmount.toFixed(2)),
        origin_url: origin,
        donor_name: name || undefined,
        message: message || undefined,
      });
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = res.url;
      } else {
        await WebBrowser.openBrowserAsync(res.url);
        router.push(`/donation-success?session_id=${res.session_id}` as any);
      }
    } catch (e: any) {
      Alert.alert("Errore", e?.message || "Impossibile avviare la donazione.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={[colors.navy, colors.navySoft]} style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
          <Pressable testID="donate-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.white} /></Pressable>
          <View style={styles.heartCircle}><Ionicons name="gift" size={34} color={colors.white} /></View>
          <Text style={styles.title}>{cfg.title}</Text>
          <Text style={styles.subtitle}>{cfg.subtitle}</Text>
        </LinearGradient>

        <Text style={styles.body}>{cfg.body}</Text>

        <Text style={styles.sectionTitle}>{cfg.amounts_title}</Text>
        <View style={styles.amounts}>
          {cfg.presets.map((a) => {
            const active = !custom && amount === a;
            return (
              <Pressable key={a} testID={`donate-${a}`} onPress={() => selectPreset(a)} style={[styles.amountChip, active && styles.amountChipActive]}>
                <Text style={[styles.amountText, active && styles.amountTextActive]}>€{a}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.customWrap}>
          <Text style={styles.euro}>€</Text>
          <TextInput
            testID="donate-custom"
            value={custom}
            onChangeText={setCustom}
            placeholder="Altro importo"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={styles.customInput}
          />
        </View>

        <Text style={styles.sectionTitle}>{cfg.message_title}</Text>
        <TextInput
          testID="donate-name"
          value={name}
          onChangeText={setName}
          placeholder="Il tuo nome"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <TextInput
          testID="donate-message"
          value={message}
          onChangeText={setMessage}
          placeholder="Un messaggio o una preghiera..."
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.textarea]}
        />

        <PressableScale testID="donate-button" style={[styles.primaryBtn, (!valid || loading) && styles.primaryBtnDisabled]} onPress={donate} disabled={!valid || loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : (
            <>
              <Ionicons name="heart" size={18} color={colors.white} />
              <Text style={styles.primaryText}>Dona €{valid ? effectiveAmount.toFixed(2).replace(/\.00$/, "") : "—"}</Text>
            </>
          )}
        </PressableScale>
        <View style={styles.secureRow}>
          <Ionicons name="lock-closed" size={13} color={colors.muted} />
          <Text style={styles.note}>{cfg.secure_note}</Text>
        </View>

        {cfg.monthly_enabled && cfg.monthly_plans.length > 0 && (
        <View style={styles.monthlyCard}>
          <View style={styles.monthlyHeader}>
            <View style={styles.monthlyIcon}><Ionicons name="repeat" size={20} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.monthlyTitle}>{cfg.monthly_title}</Text>
              <Text style={styles.monthlySub}>{cfg.monthly_sub}</Text>
            </View>
          </View>
          {cfg.monthly_plans.map((m) => (
            <PressableScale
              key={m.plan}
              testID={`donate-monthly-${m.plan}`}
              style={styles.planRow}
              onPress={() => subscribe(m.plan)}
              disabled={subLoading !== null}
            >
              <View style={styles.planLeft}>
                <Text style={styles.planAmount}>{m.label}<Text style={styles.planPer}>/mese</Text></Text>
                <Text style={styles.planDesc}>{m.desc}</Text>
              </View>
              {subLoading === m.plan
                ? <ActivityIndicator color={colors.brandPrimary} />
                : <Ionicons name="arrow-forward-circle" size={26} color={colors.brandPrimary} />}
            </PressableScale>
          ))}
        </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { padding: spacing.xl, alignItems: "flex-start" },
  heartCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  title: { color: colors.white, fontSize: 24, fontWeight: "800", marginTop: spacing.lg },
  subtitle: { color: colors.brandSecondary, fontSize: 14, marginTop: spacing.sm },
  body: { padding: spacing.xl, paddingBottom: spacing.md, fontSize: 15, lineHeight: 24, color: colors.onSurfaceSecondary },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface, paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  amounts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  amountChip: { minWidth: 74, alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, borderColor: colors.border },
  amountChipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  amountText: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  amountTextActive: { color: colors.onBrandTertiary },
  customWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.lg },
  euro: { fontSize: 18, fontWeight: "800", color: colors.onSurfaceTertiary },
  customInput: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, fontSize: 17, fontWeight: "700", color: colors.onSurface },
  input: { marginHorizontal: spacing.xl, marginTop: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 15, color: colors.onSurface },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  primaryBtn: { flexDirection: "row", gap: spacing.sm, marginHorizontal: spacing.xl, marginTop: spacing.xl, backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  secureRow: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, marginTop: spacing.md },
  note: { fontSize: 12, color: colors.muted, textAlign: "center", lineHeight: 18, flexShrink: 1 },
  monthlyCard: { marginHorizontal: spacing.xl, marginTop: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, padding: spacing.lg },
  monthlyHeader: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  monthlyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  monthlyTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
  monthlySub: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 },
  planRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginTop: spacing.sm },
  planLeft: { flex: 1 },
  planAmount: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  planPer: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  planDesc: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
});

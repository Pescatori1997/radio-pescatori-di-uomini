import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Platform, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

function appOrigin(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return process.env.EXPO_PUBLIC_BACKEND_URL || "";
}
function parsePrice(s?: string): number {
  const m = /(\d+(?:[.,]\d{1,2})?)/.exec(s || "");
  return m ? parseFloat(m[1].replace(",", ".")) : 0;
}

const PICKUP_INFO = "Il ritiro avviene su appuntamento. Dopo il pagamento ti contatteremo su WhatsApp per concordare giorno, ora e luogo del ritiro.";

export default function Checkout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ product_id: string; qty?: string; size?: string; color?: string }>();
  const qty = Math.max(1, parseInt(params.qty || "1", 10) || 1);

  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<"shipping" | "pickup">("shipping");
  const [f, setF] = useState({ name: "", surname: "", address: "", cap: "", city: "", province: "", phone: "" });
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const set = (k: string, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    api.product(params.product_id!).then(setP).catch(() => {}).finally(() => setLoading(false));
  }, [params.product_id]);

  const total = useMemo(() => (p ? parsePrice(p.price) * qty : 0), [p, qty]);

  const valid = method === "pickup"
    ? f.name.trim() && f.phone.trim()
    : f.name.trim() && f.surname.trim() && f.address.trim() && f.cap.trim() && f.city.trim() && f.province.trim() && f.phone.trim();

  const pay = async () => {
    if (!valid) { Alert.alert("Dati mancanti", "Compila tutti i campi richiesti."); return; }
    setSubmitting(true);
    try {
      const res = await api.orderCheckout({
        items: [{ product_id: params.product_id, quantity: qty, size: params.size || undefined, color: params.color || undefined }],
        delivery: { method, ...f },
        origin_url: appOrigin(),
        note,
      });
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = res.url;
      } else {
        await WebBrowser.openBrowserAsync(res.url);
        router.push(`/order-success?session_id=${res.session_id}` as any);
      }
    } catch (e: any) {
      Alert.alert("Errore", e?.message || "Impossibile avviare il pagamento.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>;
  if (!p) return <View style={styles.center}><Text style={{ color: colors.onSurface }}>Prodotto non trovato.</Text></View>;

  const opts = [params.size, params.color].filter(Boolean).join(" · ");

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="checkout-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="arrow-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.topTitle}>Completa l'ordine</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text style={styles.summaryName} numberOfLines={2}>{p.name}</Text>
          {!!opts && <Text style={styles.summaryOpts}>{opts}</Text>}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryQty}>Quantità: {qty}</Text>
            <Text style={styles.summaryTotal}>€{total.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.section}>Come vuoi ricevere il tuo ordine?</Text>
        <View style={styles.methodRow}>
          <Pressable testID="method-shipping" onPress={() => setMethod("shipping")} style={[styles.methodCard, method === "shipping" && styles.methodActive]}>
            <Ionicons name="cube-outline" size={22} color={method === "shipping" ? colors.brandPrimary : colors.onSurfaceTertiary} />
            <Text style={[styles.methodText, method === "shipping" && styles.methodTextActive]}>Spedizione</Text>
          </Pressable>
          <Pressable testID="method-pickup" onPress={() => setMethod("pickup")} style={[styles.methodCard, method === "pickup" && styles.methodActive]}>
            <Ionicons name="storefront-outline" size={22} color={method === "pickup" ? colors.brandPrimary : colors.onSurfaceTertiary} />
            <Text style={[styles.methodText, method === "pickup" && styles.methodTextActive]}>Ritiro in sede</Text>
          </Pressable>
        </View>

        {method === "pickup" && (
          <View style={styles.infoBox}><Ionicons name="information-circle" size={18} color={colors.brandPrimary} /><Text style={styles.infoText}>{PICKUP_INFO}</Text></View>
        )}

        <View style={styles.form}>
          <Field testID="f-name" label="Nome *" value={f.name} onChangeText={(v) => set("name", v)} />
          {method === "shipping" && <Field testID="f-surname" label="Cognome *" value={f.surname} onChangeText={(v) => set("surname", v)} />}
          {method === "shipping" && <Field testID="f-address" label="Via e numero civico *" value={f.address} onChangeText={(v) => set("address", v)} />}
          {method === "shipping" && (
            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}><Field testID="f-cap" label="CAP *" value={f.cap} onChangeText={(v) => set("cap", v)} keyboardType="number-pad" /></View>
              <View style={{ flex: 2 }}><Field testID="f-city" label="Città *" value={f.city} onChangeText={(v) => set("city", v)} /></View>
            </View>
          )}
          {method === "shipping" && <Field testID="f-province" label="Provincia *" value={f.province} onChangeText={(v) => set("province", v)} />}
          <Field testID="f-phone" label="Telefono *" value={f.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" />
          <Field testID="f-note" label="Note (facoltativo)" value={note} onChangeText={setNote} multiline />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PressableScale testID="checkout-pay" onPress={pay} disabled={!valid || submitting} style={[styles.payBtn, (!valid || submitting) && styles.payDisabled]}>
          {submitting ? <ActivityIndicator color={colors.white} /> : (
            <>
              <Ionicons name="lock-closed" size={18} color={colors.white} />
              <Text style={styles.payText}>Vai al pagamento · €{total.toFixed(2)}</Text>
            </>
          )}
        </PressableScale>
      </View>
    </View>
  );
}

function Field({ label, value, onChangeText, multiline, keyboardType, testID }: any) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && { minHeight: 70, textAlignVertical: "top" }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  topTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  summary: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  summaryName: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  summaryOpts: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  summaryQty: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "600" },
  summaryTotal: { color: colors.brandPrimary, fontSize: 20, fontWeight: "800" },
  section: { color: colors.onSurface, fontSize: 16, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.md },
  methodRow: { flexDirection: "row", gap: spacing.md },
  methodCard: { flex: 1, alignItems: "center", gap: 6, paddingVertical: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1.5, borderColor: colors.border },
  methodActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary },
  methodText: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "700" },
  methodTextActive: { color: colors.onBrandTertiary },
  infoBox: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  infoText: { flex: 1, color: colors.onBrandTertiary, fontSize: 13, lineHeight: 19 },
  form: { marginTop: spacing.lg },
  rowFields: { flexDirection: "row", gap: spacing.md },
  label: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 15, color: colors.onSurface },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  payBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy, paddingVertical: spacing.md + 2, borderRadius: radius.pill },
  payDisabled: { opacity: 0.5 },
  payText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

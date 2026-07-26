import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const WHATSAPP = "393517556255";
const MAX_TRIES = 8;

export default function OrderSuccess() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [status, setStatus] = useState<"checking" | "paid" | "pending" | "error">("checking");

  useEffect(() => {
    let tries = 0;
    let timer: any;
    const poll = async () => {
      try {
        const o = await api.orderStatus(session_id!);
        setOrder(o);
        if (o.payment_status === "paid") { setStatus("paid"); return; }
        if (tries++ < MAX_TRIES) { timer = setTimeout(poll, 2000); }
        else setStatus("pending");
      } catch {
        if (tries++ < MAX_TRIES) timer = setTimeout(poll, 2000);
        else setStatus("error");
      }
    };
    if (session_id) poll();
    return () => timer && clearTimeout(timer);
  }, [session_id]);

  const fmtDate = (iso?: string) => { try { return new Date(iso || Date.now()).toLocaleString("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

  const sendWhatsApp = () => {
    if (!order) return;
    const d = order.delivery || {};
    const lines = [
      "🧾 *Nuovo ordine - Pescatori di Uomini*",
      `Numero ordine: ${order.order_number}`,
      `Data: ${fmtDate(order.created_at)}`,
      `Cliente: ${d.name || ""} ${d.surname || ""}`.trim(),
      `Telefono: ${d.phone || ""}`,
      "",
      "*Prodotti:*",
      ...order.items.map((it: any) => `• ${it.name}${it.options ? ` (${it.options})` : ""} x${it.quantity} - €${(it.line_total).toFixed(2)}`),
      "",
      `*Totale pagato:* €${Number(order.total).toFixed(2)}`,
      `Pagamento: ${order.payment_status === "paid" ? "✅ Confermato" : "in verifica"}`,
      d.method === "shipping"
        ? `Spedizione: ${d.address || ""}, ${d.cap || ""} ${d.city || ""} (${d.province || ""})`
        : "Ritiro in sede (su appuntamento)",
      ...(order.note ? ["", `Note: ${order.note}`] : []),
    ];
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`;
    Linking.openURL(url).catch(() => {});
  };

  if (status === "checking") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
        <Text style={styles.checkingText}>Stiamo confermando il pagamento…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <View style={[styles.iconCircle, status !== "paid" && { backgroundColor: colors.warning }]}>
            <Ionicons name={status === "paid" ? "checkmark" : "time-outline"} size={44} color={colors.white} />
          </View>
        </View>
        <Text style={styles.title}>{status === "paid" ? "Ordine confermato!" : "Ordine in verifica"}</Text>
        <Text style={styles.subtitle}>
          {status === "paid"
            ? "Grazie per il tuo acquisto. Trovi qui sotto il riepilogo del tuo ordine."
            : "Stiamo ancora verificando il pagamento. Puoi comunque inviarci i dettagli su WhatsApp."}
        </Text>

        {order && (
          <View style={styles.card}>
            <View style={styles.cardRow}><Text style={styles.k}>Numero ordine</Text><Text style={styles.vStrong}>{order.order_number}</Text></View>
            <View style={styles.cardRow}><Text style={styles.k}>Data</Text><Text style={styles.v}>{fmtDate(order.created_at)}</Text></View>
            <View style={styles.divider} />
            {order.items.map((it: any, i: number) => (
              <View key={i} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{it.name}</Text>
                  {!!it.options && <Text style={styles.itemOpts}>{it.options}</Text>}
                </View>
                <Text style={styles.itemQty}>x{it.quantity}</Text>
                <Text style={styles.itemPrice}>€{Number(it.line_total).toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.cardRow}><Text style={styles.totalK}>Totale pagato</Text><Text style={styles.totalV}>€{Number(order.total).toFixed(2)}</Text></View>
            <View style={[styles.cardRow, { marginTop: spacing.xs }]}>
              <Text style={styles.k}>Consegna</Text>
              <Text style={styles.v}>{order.delivery?.method === "shipping" ? "Spedizione" : "Ritiro in sede"}</Text>
            </View>
          </View>
        )}

        <PressableScale testID="order-whatsapp" onPress={sendWhatsApp} style={styles.waBtn}>
          <Ionicons name="logo-whatsapp" size={22} color={colors.white} />
          <Text style={styles.waText}>Invia dettagli ordine su WhatsApp</Text>
        </PressableScale>
        <Text style={styles.hint}>Ti basterà premere INVIA: il messaggio è già compilato con tutti i dettagli.</Text>

        <Pressable testID="order-home" onPress={() => router.replace("/(tabs)")} style={styles.homeBtn}>
          <Text style={styles.homeText}>Torna alla home</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: spacing.md },
  checkingText: { color: colors.onSurfaceSecondary, fontSize: 14 },
  iconWrap: { alignItems: "center", marginBottom: spacing.lg },
  iconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: "800", textAlign: "center" },
  subtitle: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl, paddingHorizontal: spacing.md },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  k: { color: colors.onSurfaceSecondary, fontSize: 14 },
  v: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  vStrong: { color: colors.brandPrimary, fontSize: 15, fontWeight: "800" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  itemName: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  itemOpts: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 1 },
  itemQty: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "600" },
  itemPrice: { color: colors.onSurface, fontSize: 14, fontWeight: "800", minWidth: 64, textAlign: "right" },
  totalK: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  totalV: { color: colors.brandPrimary, fontSize: 20, fontWeight: "800" },
  waBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: "#25D366", paddingVertical: spacing.md + 2, borderRadius: radius.pill, marginTop: spacing.xl },
  waText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  hint: { color: colors.onSurfaceTertiary, fontSize: 12, textAlign: "center", marginTop: spacing.sm, lineHeight: 17 },
  homeBtn: { alignItems: "center", paddingVertical: spacing.lg, marginTop: spacing.sm },
  homeText: { color: colors.brandPrimary, fontSize: 15, fontWeight: "700" },
});

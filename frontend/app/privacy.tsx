import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/src/theme";

const SECTIONS: { h: string; p: string }[] = [
  { h: "Introduzione", p: "Pescatori di Uomini è una web radio evangelica cristiana. Rispettiamo la tua privacy e ci impegniamo a proteggere i dati personali che ci affidi. Questa informativa spiega quali dati raccogliamo e come li utilizziamo." },
  { h: "Dati che raccogliamo", p: "Se crei un account, raccogliamo il tuo nome, l'indirizzo email e (facoltativamente) un'immagine del profilo. Se effettui un'offerta, il pagamento è gestito in modo sicuro da Stripe: non memorizziamo i dati della tua carta. Il widget meteo utilizza la tua posizione approssimativa solo se concedi il permesso, per mostrarti le previsioni locali." },
  { h: "Notifiche", p: "Se attivi le notifiche, registriamo un identificativo del dispositivo per inviarti aggiornamenti su podcast, meditazioni, notizie e dirette. Puoi disattivare ogni categoria in qualsiasi momento dalle impostazioni del tuo profilo o dal dispositivo." },
  { h: "Come usiamo i dati", p: "Utilizziamo i tuoi dati esclusivamente per fornire e migliorare i servizi dell'app: gestione dell'account, invio di contenuti e notifiche da te richieste, gestione delle offerte. Non vendiamo né cediamo i tuoi dati personali a terzi per finalità commerciali." },
  { h: "Conservazione ed eliminazione", p: "Conserviamo i dati finché mantieni l'account attivo. Puoi eliminare il tuo account in qualsiasi momento da \"Il mio account\": i tuoi dati personali verranno rimossi in modo permanente. Le registrazioni contabili delle offerte possono essere conservate in forma anonima per obblighi di legge." },
  { h: "Contatti", p: "Per qualsiasi richiesta relativa alla privacy o ai tuoi dati, puoi contattarci tramite la pagina Contatti dell'app." },
];

export default function Privacy() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="privacy-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}>
        {SECTIONS.map((s) => (
          <View key={s.h} style={{ marginBottom: spacing.lg }}>
            <Text style={styles.h}>{s.h}</Text>
            <Text style={styles.p}>{s.p}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  h: { color: colors.onSurface, fontSize: 17, fontWeight: "800", marginBottom: spacing.xs },
  p: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 23 },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import AdminShell from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput } from "@/src/components/adminForm";
import { colors, spacing, radius } from "@/src/theme";

export default function AdminSettings() {
  const [f, setF] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const load = useCallback(() => {
    api.adminSettings().then((d) => setF({
      contact_email: d.contact_email || "", contact_phone: d.contact_phone || "", address: d.address || "",
      facebook: d.facebook || "", instagram: d.instagram || "", youtube: d.youtube || "", whatsapp: d.whatsapp || "",
      about_short: d.about_short || "",
    })).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setBusy(true); setMsg("");
    try { await api.adminUpdateSettings(f); setMsg("Impostazioni salvate"); }
    catch (e: any) { setMsg(e.message || "Errore"); } finally { setBusy(false); }
  };

  return (
    <AdminShell title="Impostazioni" activeKey="settings">
      {loading || !f ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.section}>Contatti</Text>
          <AInput testID="set-email" label="Email di contatto" value={f.contact_email} onChangeText={(v: string) => set("contact_email", v)} keyboardType="email-address" />
          <AInput testID="set-phone" label="Telefono" value={f.contact_phone} onChangeText={(v: string) => set("contact_phone", v)} keyboardType="phone-pad" />
          <AInput testID="set-address" label="Indirizzo" value={f.address} onChangeText={(v: string) => set("address", v)} />

          <Text style={styles.section}>Social</Text>
          <AInput testID="set-facebook" label="Facebook" value={f.facebook} onChangeText={(v: string) => set("facebook", v)} placeholder="https://facebook.com/..." keyboardType="url" />
          <AInput testID="set-instagram" label="Instagram" value={f.instagram} onChangeText={(v: string) => set("instagram", v)} placeholder="https://instagram.com/..." keyboardType="url" />
          <AInput testID="set-youtube" label="YouTube" value={f.youtube} onChangeText={(v: string) => set("youtube", v)} placeholder="https://youtube.com/..." keyboardType="url" />
          <AInput testID="set-whatsapp" label="WhatsApp" value={f.whatsapp} onChangeText={(v: string) => set("whatsapp", v)} placeholder="+39..." keyboardType="phone-pad" />

          <Text style={styles.section}>Info App</Text>
          <AInput testID="set-about" label="Descrizione breve" value={f.about_short} onChangeText={(v: string) => set("about_short", v)} multiline />

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          <PressableScale testID="set-save" style={[styles.btn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
            <Ionicons name="save-outline" size={18} color={colors.white} /><Text style={styles.btnText}>Salva</Text>
          </PressableScale>
        </ScrollView>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { color: colors.white, fontSize: 16, fontWeight: "800", marginTop: spacing.md, marginBottom: spacing.md },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginVertical: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, marginTop: spacing.lg },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

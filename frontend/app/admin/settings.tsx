import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { useSettings } from "@/src/context/SettingsContext";
import AdminShell from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { AInput, ASwitch } from "@/src/components/adminForm";
import { colors, spacing, radius } from "@/src/theme";

// Toggleable site sections (must match SECTION_DEFAULTS keys in the backend).
const SECTIONS: { key: string; label: string }[] = [
  { key: "podcast", label: "Podcast" },
  { key: "meditazioni", label: "Meditazioni" },
  { key: "news", label: "Notizie" },
  { key: "palinsesto", label: "Palinsesto" },
  { key: "bibbia", label: "Bibbia / Biblioteca" },
  { key: "piani", label: "Piani di Lettura (Home)" },
  { key: "verse", label: "Versetto del Giorno (Home)" },
  { key: "prayer", label: "Richieste di Preghiera" },
  { key: "traguardi", label: "Traguardi del Cammino" },
  { key: "meteo", label: "Meteo (Home)" },
  { key: "vetrina", label: "Vetrina (Home)" },
  { key: "community", label: "Statistiche Community (Home)" },
  { key: "team", label: "Il nostro Team" },
  { key: "merch", label: "Merchandising" },
  { key: "donate", label: "Sostieni il progetto" },
  { key: "about", label: "Chi Siamo" },
  { key: "contact", label: "Contatti" },
];

export default function AdminSettings() {
  const { refresh } = useSettings();
  const [f, setF] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const load = useCallback(() => {
    api.adminSettings().then((d) => setF({
      contact_email: d.contact_email || "", contact_phone: d.contact_phone || "", address: d.address || "",
      facebook: d.facebook || "", instagram: d.instagram || "", youtube: d.youtube || "", whatsapp: d.whatsapp || "",
      website: d.website || "",
      about_short: d.about_short || "",
      about_title: d.about_title || "", about_verse: d.about_verse || "", about_description: d.about_description || "",
      about_card1_title: d.about_card1_title || "", about_card1_text: d.about_card1_text || "",
      about_card2_title: d.about_card2_title || "", about_card2_text: d.about_card2_text || "",
      about_card3_title: d.about_card3_title || "", about_card3_text: d.about_card3_text || "",
      about_quote: d.about_quote || "",
      section_visibility: d.section_visibility || {},
    })).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleSection = (key: string, val: boolean) =>
    setF((p: any) => ({ ...p, section_visibility: { ...(p.section_visibility || {}), [key]: val } }));

  const save = async () => {
    setBusy(true); setMsg("");
    try { await api.adminUpdateSettings(f); refresh(); setMsg("Impostazioni salvate"); }
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
          <AInput testID="set-website" label="Sito web" value={f.website} onChangeText={(v: string) => set("website", v)} placeholder="https://..." keyboardType="url" />

          <Text style={styles.section}>Info App</Text>
          <AInput testID="set-about" label="Descrizione breve" value={f.about_short} onChangeText={(v: string) => set("about_short", v)} multiline />

          <Text style={styles.section}>Pagina "Chi Siamo"</Text>
          <AInput testID="set-about-title" label="Titolo" value={f.about_title} onChangeText={(v: string) => set("about_title", v)} />
          <AInput testID="set-about-verse" label="Sottotitolo / Versetto" value={f.about_verse} onChangeText={(v: string) => set("about_verse", v)} multiline />
          <AInput testID="set-about-description" label="Descrizione principale" value={f.about_description} onChangeText={(v: string) => set("about_description", v)} multiline />
          <AInput testID="set-about-c1-title" label="Scheda 1 · Titolo" value={f.about_card1_title} onChangeText={(v: string) => set("about_card1_title", v)} />
          <AInput testID="set-about-c1-text" label="Scheda 1 · Testo" value={f.about_card1_text} onChangeText={(v: string) => set("about_card1_text", v)} multiline />
          <AInput testID="set-about-c2-title" label="Scheda 2 · Titolo" value={f.about_card2_title} onChangeText={(v: string) => set("about_card2_title", v)} />
          <AInput testID="set-about-c2-text" label="Scheda 2 · Testo" value={f.about_card2_text} onChangeText={(v: string) => set("about_card2_text", v)} multiline />
          <AInput testID="set-about-c3-title" label="Scheda 3 · Titolo" value={f.about_card3_title} onChangeText={(v: string) => set("about_card3_title", v)} />
          <AInput testID="set-about-c3-text" label="Scheda 3 · Testo" value={f.about_card3_text} onChangeText={(v: string) => set("about_card3_text", v)} multiline />
          <AInput testID="set-about-quote" label="Citazione finale" value={f.about_quote} onChangeText={(v: string) => set("about_quote", v)} multiline />

          <Text style={styles.section}>Visibilità sezioni</Text>
          <Text style={styles.hint}>Decidi cosa mostrare sul sito. Spegnendo una voce, sparisce ovunque (menu, Home e barra in basso).</Text>
          {SECTIONS.map((s) => (
            <ASwitch
              key={s.key}
              testID={`sec-${s.key}`}
              label={s.label}
              value={f.section_visibility?.[s.key] !== false}
              onValueChange={(v: boolean) => toggleSection(s.key, v)}
            />
          ))}

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
  hint: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: -6, marginBottom: spacing.md },
  msg: { color: colors.brandSecondary, fontSize: 14, textAlign: "center", marginVertical: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, marginTop: spacing.lg },
  btnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});

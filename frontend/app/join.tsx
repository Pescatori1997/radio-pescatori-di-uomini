import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/src/api";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

const ROLES = ["Speaker", "Conduttore", "Tecnico del suono", "Redazione", "Social & Comunicazione", "Altro"];

function Field({ label, children, required }: any) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.label}>{label}{required ? " *" : ""}</Text>
      {children}
    </View>
  );
}

export default function Join() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [f, setF] = useState<any>({ name: "", surname: "", age: "", city: "", email: "", phone: "", desired_role: "", testimony: "", motivation: "", experience: "" });
  const [portrait, setPortrait] = useState<string | null>(null);
  const [permDenied, setPermDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setF((p: any) => ({ ...p, [k]: v }));

  const pickImage = async () => {
    setPermDenied(false);
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = current.status;
    if (status !== "granted" && current.canAskAgain) {
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") { setPermDenied(true); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: [3, 4], quality: 0.6, base64: true,
    });
    if (!res.canceled && res.assets?.[0]?.base64) {
      setPortrait(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  };

  const submit = async () => {
    if (!f.name.trim() || !f.surname.trim() || !f.email.trim() || !f.desired_role || !f.motivation.trim()) {
      setError("Compila i campi obbligatori (*)");
      return;
    }
    setError(""); setBusy(true);
    try {
      await api.applyCrew({
        name: f.name.trim(), surname: f.surname.trim(),
        age: f.age ? parseInt(f.age, 10) : null, city: f.city.trim() || null,
        email: f.email.trim(), phone: f.phone.trim() || null,
        desired_role: f.desired_role, testimony: f.testimony.trim() || null,
        motivation: f.motivation.trim(), experience: f.experience.trim() || null,
        portrait,
      });
      setSent(true);
    } catch (e: any) {
      setError(e.message || "Errore di invio");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.successIcon}><MaterialCommunityIcons name="anchor" size={40} color={colors.brandPrimary} /></View>
        <Text style={styles.successTitle}>Candidatura inviata!</Text>
        <Text style={styles.successSub}>Grazie per il tuo cuore. Il nostro team esaminerà la tua candidatura e ti contatterà presto. Che Dio ti benedica.</Text>
        <PressableScale testID="join-done" style={styles.primaryBtn} onPress={() => router.replace("/equipaggio")}>
          <Text style={styles.primaryText}>{"Torna all'Equipaggio"}</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale testID="join-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </PressableScale>
        <Text style={styles.headerTitle}>Collabora con noi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Raccontaci di te. Ogni chiamata è preziosa per il Regno di Dio.</Text>

        {/* Portrait */}
        <PressableScale testID="join-portrait" style={styles.portraitPicker} onPress={pickImage}>
          {portrait ? (
            <Image source={{ uri: portrait }} style={styles.portraitPreview} contentFit="cover" />
          ) : (
            <View style={styles.portraitEmpty}>
              <Ionicons name="camera" size={26} color={colors.brandPrimary} />
              <Text style={styles.portraitText}>Carica foto ritratto</Text>
            </View>
          )}
        </PressableScale>
        {permDenied && (
          <View style={styles.permBox}>
            <Text style={styles.permText}>Permesso galleria negato. Abilitalo dalle impostazioni per caricare una foto.</Text>
            <PressableScale testID="open-settings" style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
              <Text style={styles.settingsText}>Apri Impostazioni</Text>
            </PressableScale>
          </View>
        )}

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label="Nome" required>
              <TextInput testID="join-name" value={f.name} onChangeText={(v) => set("name", v)} placeholder="Nome" placeholderTextColor={colors.muted} style={styles.input} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Cognome" required>
              <TextInput testID="join-surname" value={f.surname} onChangeText={(v) => set("surname", v)} placeholder="Cognome" placeholderTextColor={colors.muted} style={styles.input} />
            </Field>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label="Età">
              <TextInput testID="join-age" value={f.age} onChangeText={(v) => set("age", v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="Età" placeholderTextColor={colors.muted} style={styles.input} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Città">
              <TextInput testID="join-city" value={f.city} onChangeText={(v) => set("city", v)} placeholder="Città" placeholderTextColor={colors.muted} style={styles.input} />
            </Field>
          </View>
        </View>

        <Field label="Email" required>
          <TextInput testID="join-email" value={f.email} onChangeText={(v) => set("email", v)} autoCapitalize="none" keyboardType="email-address" placeholder="tua@email.it" placeholderTextColor={colors.muted} style={styles.input} />
        </Field>

        <Field label="Telefono (facoltativo)">
          <TextInput testID="join-phone" value={f.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" placeholder="+39..." placeholderTextColor={colors.muted} style={styles.input} />
        </Field>

        <Field label="Ruolo desiderato" required>
          <View style={styles.chips}>
            {ROLES.map((r) => (
              <PressableScale key={r} testID={`join-role-${r}`} onPress={() => set("desired_role", r)} style={[styles.roleChip, f.desired_role === r && styles.roleChipActive]}>
                <Text style={[styles.roleChipText, f.desired_role === r && styles.roleChipTextActive]}>{r}</Text>
              </PressableScale>
            ))}
          </View>
        </Field>

        <Field label="La tua testimonianza">
          <TextInput testID="join-testimony" value={f.testimony} onChangeText={(v) => set("testimony", v)} multiline placeholder="Come hai incontrato il Signore..." placeholderTextColor={colors.muted} style={[styles.input, styles.area]} />
        </Field>

        <Field label="Perché vorresti servire?" required>
          <TextInput testID="join-motivation" value={f.motivation} onChangeText={(v) => set("motivation", v)} multiline placeholder="Il tuo desiderio..." placeholderTextColor={colors.muted} style={[styles.input, styles.area]} />
        </Field>

        <Field label="Esperienza precedente">
          <TextInput testID="join-experience" value={f.experience} onChangeText={(v) => set("experience", v)} multiline placeholder="Radio, musica, media, ministero..." placeholderTextColor={colors.muted} style={[styles.input, styles.area]} />
        </Field>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PressableScale testID="join-submit" style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? "Invio..." : "Invia candidatura"}</Text>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  intro: { fontSize: 15, color: colors.onSurfaceSecondary, lineHeight: 22, marginBottom: spacing.lg },
  portraitPicker: { alignSelf: "center", width: 150, height: 200, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceTertiary, borderWidth: 2, borderColor: colors.border, borderStyle: "dashed", marginBottom: spacing.lg },
  portraitPreview: { width: "100%", height: "100%" },
  portraitEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  portraitText: { color: colors.onBrandTertiary, fontSize: 13, fontWeight: "700" },
  permBox: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  permText: { color: colors.onSurfaceSecondary, fontSize: 13, marginBottom: spacing.sm },
  settingsBtn: { alignSelf: "flex-start", backgroundColor: colors.navy, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  settingsText: { color: colors.white, fontWeight: "700", fontSize: 13 },
  twoCol: { flexDirection: "row", gap: spacing.md },
  label: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.onSurface },
  area: { height: 100, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  roleChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: "transparent" },
  roleChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  roleChipText: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceSecondary },
  roleChipTextActive: { color: colors.white },
  error: { color: colors.error, fontSize: 14, marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  primaryBtn: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center" },
  primaryText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  successTitle: { fontSize: 22, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  successSub: { fontSize: 15, color: colors.onSurfaceSecondary, textAlign: "center", marginTop: spacing.md, lineHeight: 22, marginBottom: spacing.xl },
});

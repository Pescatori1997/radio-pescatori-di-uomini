import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { confirmAsync, alertMessage } from "@/src/utils/confirm";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export default function Account() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [picture, setPicture] = useState<string | null>(user?.picture || null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const hasPassword = user?.provider !== "google";
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) Alert.alert("Permesso negato", "Consenti l'accesso alle foto dalle impostazioni per cambiare l'immagine.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) {
      setPicture(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  };

  const saveProfile = async () => {
    setProfileMsg(""); setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), picture: picture || undefined });
      setProfileMsg("Profilo aggiornato");
    } catch (e: any) {
      setProfileMsg(e.message || "Errore");
    } finally { setSavingProfile(false); }
  };

  const savePassword = async () => {
    setPwErr(""); setPwMsg("");
    if (next.length < 6) { setPwErr("La nuova password deve avere almeno 6 caratteri"); return; }
    setSavingPw(true);
    try {
      await api.changePassword({ current_password: hasPassword ? current : undefined, new_password: next });
      setPwMsg("Password aggiornata");
      setCurrent(""); setNext("");
    } catch (e: any) {
      setPwErr(e.message || "Errore");
    } finally { setSavingPw(false); }
  };

  const remove = async () => {
    const ok = await confirmAsync(
      "Elimina account",
      "Questa azione è definitiva: il tuo account e i tuoi dati personali verranno eliminati e non potranno essere recuperati. Vuoi continuare?",
      "Elimina account",
      true
    );
    if (!ok) return;
    try {
      await api.deleteAccount();
      await logout();
      router.replace("/welcome" as any);
    } catch (e: any) {
      alertMessage("Errore", e.message || "Eliminazione non riuscita");
    }
  };

  const initials = (user?.name || "?").slice(0, 1).toUpperCase();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="account-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>Il mio account</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarWrap}>
          <Pressable testID="account-avatar" onPress={pickAvatar} style={styles.avatar}>
            {picture ? <Image source={{ uri: picture }} style={styles.avatarImg} contentFit="cover" /> : <Text style={styles.avatarInitials}>{initials}</Text>}
            <View style={styles.avatarEdit}><Ionicons name="camera" size={15} color={colors.white} /></View>
          </Pressable>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <Text style={styles.section}>Profilo</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Nome</Text>
          <TextInput testID="account-name" value={name} onChangeText={setName} placeholder="Il tuo nome" placeholderTextColor={colors.muted} style={styles.input} />
          {profileMsg ? <Text style={styles.ok}>{profileMsg}</Text> : null}
          <PressableScale testID="account-save-profile" style={[styles.btn, savingProfile && { opacity: 0.6 }]} onPress={saveProfile} disabled={savingProfile}>
            {savingProfile ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnText}>Salva profilo</Text>}
          </PressableScale>
        </View>

        <Text style={styles.section}>{hasPassword ? "Cambia password" : "Imposta password"}</Text>
        <View style={styles.card}>
          {!hasPassword && <Text style={styles.hint}>Hai effettuato l'accesso con Google. Imposta una password per accedere anche via email.</Text>}
          {hasPassword && (
            <>
              <Text style={styles.label}>Password attuale</Text>
              <TextInput testID="account-current-pw" value={current} onChangeText={setCurrent} secureTextEntry placeholder="••••••" placeholderTextColor={colors.muted} style={styles.input} />
            </>
          )}
          <Text style={styles.label}>Nuova password</Text>
          <TextInput testID="account-new-pw" value={next} onChangeText={setNext} secureTextEntry placeholder="Min. 6 caratteri" placeholderTextColor={colors.muted} style={styles.input} />
          {pwMsg ? <Text style={styles.ok}>{pwMsg}</Text> : null}
          {pwErr ? <Text style={styles.err}>{pwErr}</Text> : null}
          <PressableScale testID="account-save-pw" style={[styles.btn, savingPw && { opacity: 0.6 }]} onPress={savePassword} disabled={savingPw}>
            {savingPw ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnText}>{hasPassword ? "Aggiorna password" : "Imposta password"}</Text>}
          </PressableScale>
        </View>

        <Text style={styles.section}>Zona pericolosa</Text>
        <View style={styles.card}>
          <Text style={styles.hint}>Eliminando l'account, i tuoi dati personali verranno rimossi in modo permanente.</Text>
          <Pressable testID="account-delete" onPress={remove} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={styles.deleteText}>Elimina account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  avatarWrap: { alignItems: "center", marginVertical: spacing.lg },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 96, height: 96 },
  avatarInitials: { color: colors.white, fontSize: 36, fontWeight: "800" },
  avatarEdit: { position: "absolute", bottom: 4, right: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  email: { color: colors.onSurfaceSecondary, fontSize: 14, marginTop: spacing.md },
  section: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  label: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: spacing.sm },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.onSurface },
  hint: { color: colors.onSurfaceTertiary, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm },
  ok: { color: colors.success, fontSize: 13, marginTop: spacing.sm },
  err: { color: colors.error, fontSize: 13, marginTop: spacing.sm },
  btn: { backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.lg },
  btnText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  deleteBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", marginTop: spacing.md, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.error },
  deleteText: { color: colors.error, fontSize: 15, fontWeight: "800" },
});

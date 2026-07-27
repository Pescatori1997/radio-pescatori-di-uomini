import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator, Platform, Linking } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { getWebPushState, subscribeWebPush } from "@/src/utils/webpush";
import { colors, spacing, radius } from "@/src/theme";

const CATEGORIES: { key: string; label: string; desc: string; icon: string }[] = [
  { key: "podcasts", label: "Podcast", desc: "Nuovi podcast pubblicati", icon: "podcast" },
  { key: "meditations", label: "Meditazioni", desc: "Nuove meditazioni quotidiane", icon: "book-open-variant" },
  { key: "news", label: "Notizie", desc: "Nuovi articoli e novità", icon: "newspaper-variant" },
  { key: "live", label: "Dirette", desc: "Quando iniziamo una diretta", icon: "access-point" },
  { key: "announcements", label: "Annunci", desc: "Comunicazioni importanti", icon: "bullhorn" },
  { key: "events", label: "Eventi in programma", desc: "Eventi ed appuntamenti live", icon: "calendar-star" },
  { key: "prayers", label: "Richieste di preghiera", desc: "Aggiornamenti sulle preghiere", icon: "hand-heart" },
];

export default function NotificationsSettings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [webState, setWebState] = useState<"unsupported" | "granted" | "denied" | "default" | "loading">("loading");

  const load = useCallback(() => {
    api.getNotifPrefs().then(setPrefs).catch(() => setPrefs(Object.fromEntries(CATEGORIES.map((c) => [c.key, true]))));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => { getWebPushState().then(setWebState); }, []);

  const enableWebPush = async () => {
    setWebState("loading");
    const res = await subscribeWebPush(user?.user_id || null);
    setWebState(await getWebPushState());
    if (!res.ok && res.reason === "denied") {
      // permission blocked -> guide the user to browser settings
    }
  };

  const toggle = async (key: string, value: boolean) => {
    if (!prefs) return;
    const nextPrefs = { ...prefs, [key]: value };
    setPrefs(nextPrefs); // optimistic
    try { await api.setNotifPrefs(nextPrefs); } catch { load(); }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="notif-back" onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>Notifiche</Text>
        <View style={{ width: 26 }} />
      </View>

      {!prefs ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}>
          <Text style={styles.intro}>Scegli quali notifiche ricevere. Puoi cambiare queste preferenze in qualsiasi momento.</Text>

          {Platform.OS === "web" && webState !== "unsupported" && (
            <View style={styles.webCard}>
              <View style={styles.webIcon}><Ionicons name="notifications" size={22} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.webTitle}>Notifiche su questo dispositivo</Text>
                <Text style={styles.webSub}>
                  {webState === "granted"
                    ? "Attive su questo browser/PWA. Riceverai gli avvisi anche ad app chiusa."
                    : webState === "denied"
                    ? "Bloccate. Abilitale dalle impostazioni del browser per questo sito."
                    : "Attivale per ricevere gli avvisi anche quando l'app è chiusa."}
                </Text>
              </View>
              {webState === "granted" ? (
                <View style={styles.webBadge}><Ionicons name="checkmark" size={16} color={colors.white} /></View>
              ) : webState === "loading" ? (
                <ActivityIndicator color={colors.brandPrimary} />
              ) : webState === "denied" ? (
                <Pressable testID="webpush-settings" onPress={() => Linking.openSettings?.()} style={styles.webBtn}><Text style={styles.webBtnText}>Impostazioni</Text></Pressable>
              ) : (
                <Pressable testID="webpush-enable" onPress={enableWebPush} style={styles.webBtn}><Text style={styles.webBtnText}>Attiva</Text></Pressable>
              )}
            </View>
          )}

          <View style={styles.card}>
            {CATEGORIES.map((c, i) => (
              <View key={c.key}>
                <View style={styles.row}>
                  <View style={styles.iconWrap}><MaterialCommunityIcons name={c.icon as any} size={20} color={colors.brandPrimary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{c.label}</Text>
                    <Text style={styles.rowSub}>{c.desc}</Text>
                  </View>
                  <Switch
                    testID={`notif-${c.key}`}
                    value={!!prefs[c.key]}
                    onValueChange={(v) => toggle(c.key, v)}
                    trackColor={{ true: colors.brandPrimary, false: colors.border }}
                    thumbColor={colors.white}
                  />
                </View>
                {i < CATEGORIES.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={18} color={colors.muted} />
            <Text style={styles.noteText}>Su iOS/Android le notifiche arrivano sull'app installata dopo aver concesso il permesso. Sul web (PWA) attiva le notifiche con il pulsante qui sopra.</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  webCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  webIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  webTitle: { color: colors.white, fontSize: 15, fontWeight: "800" },
  webSub: { color: colors.muted, fontSize: 12, marginTop: 3, lineHeight: 16 },
  webBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, paddingVertical: 9, borderRadius: radius.pill },
  webBtnText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  webBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  rowSub: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg + 40 + spacing.md },
  note: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", marginTop: spacing.lg, paddingHorizontal: spacing.xs },
  noteText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
});

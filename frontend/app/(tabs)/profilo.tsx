import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { usePlayer } from "@/src/context/PlayerContext";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

export default function Profilo() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { playTrack } = usePlayer();
  const [favs, setFavs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        api.favorites().then(setFavs).catch(() => {});
        api.history().then(setHistory).catch(() => {});
        api.adminMe().then(() => setIsAdmin(true)).catch(() => setIsAdmin(false));
      } else {
        setIsAdmin(false);
      }
    }, [user])
  );

  const menu = [
    ...(isAdmin ? [{ icon: "shield-checkmark-outline", label: "Pannello Amministratore", route: "/admin" }] : []),
    { icon: "boat-outline", label: "Il nostro Team", route: "/equipaggio" },
    { icon: "heart-outline", label: "Richieste di Preghiera", route: "/prayer" },
    { icon: "bag-handle-outline", label: "Merchandising", route: "/merch" },
    { icon: "information-circle-outline", label: "Chi Siamo", route: "/about" },
    { icon: "gift-outline", label: "Sostieni il progetto", route: "/donate" },
    ...(user ? [{ icon: "receipt-outline", label: "Le mie offerte", route: "/donations-history" }] : []),
    ...(user ? [{ icon: "person-circle-outline", label: "Il mio account", route: "/account" }] : []),
    ...(user ? [{ icon: "notifications-outline", label: "Notifiche", route: "/notifications-settings" }] : []),
    { icon: "mail-outline", label: "Contatti", route: "/contact" },
    { icon: "alert-circle-outline", label: "Segnala un problema", route: "/report" },
    { icon: "shield-checkmark-outline", label: "Privacy Policy", route: "/privacy" },
    { icon: "settings-outline", label: "Impostazioni", route: "/settings" },
  ];

  const play = (p: any) =>
    playTrack({ id: p.id, title: p.title, artist: p.author, artwork: p.artwork, url: p.audio_url, isLive: false });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: 180 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.h1}>Profilo</Text>

      {user ? (
        <View style={styles.userCard}>
          {user.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInit}>{user.name?.[0]?.toUpperCase() || "U"}</Text></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
          <Pressable testID="logout-button" onPress={logout} hitSlop={10}><Ionicons name="log-out-outline" size={24} color={colors.error} /></Pressable>
        </View>
      ) : (
        <Pressable testID="login-cta" style={styles.loginCard} onPress={() => router.push("/login")}>
          <View style={styles.loginIcon}><Ionicons name="person-add" size={22} color={colors.white} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.loginTitle}>Accedi o registrati</Text>
            <Text style={styles.loginSub}>Salva i preferiti e la cronologia</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      )}

      {user && favs.length > 0 && (
        <Section title="Podcast preferiti">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
            {favs.map((p) => (
              <Pressable key={p.id} style={styles.miniCard} onPress={() => play(p)}>
                <Image source={{ uri: p.artwork }} style={styles.miniArt} contentFit="cover" />
                <Text numberOfLines={2} style={styles.miniTitle}>{p.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Section>
      )}

      {user && history.length > 0 && (
        <Section title="Cronologia">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
            {history.map((p) => (
              <Pressable key={p.id} style={styles.miniCard} onPress={() => play(p)}>
                <Image source={{ uri: p.artwork }} style={styles.miniArt} contentFit="cover" />
                <Text numberOfLines={2} style={styles.miniTitle}>{p.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Section>
      )}

      <View style={styles.menu}>
        {menu.map((m) => (
          <Pressable key={m.label} testID={`menu-${m.route}`} style={styles.menuRow} onPress={() => router.push(m.route as any)}>
            <Ionicons name={m.icon as any} size={22} color={colors.navy} />
            <Text style={styles.menuLabel}>{m.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.version}>Pescatori di Uomini · v1.0</Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 30, fontWeight: "800", color: colors.onSurface, paddingHorizontal: spacing.lg },
  userCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
  avatarInit: { color: colors.white, fontSize: 22, fontWeight: "800" },
  userName: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  userEmail: { fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 2 },
  loginCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg },
  loginIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  loginTitle: { fontSize: 16, fontWeight: "800", color: colors.white },
  loginSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  hRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  miniCard: { width: 120 },
  miniArt: { width: 120, height: 120, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  miniTitle: { fontSize: 13, fontWeight: "700", color: colors.onSurface, marginTop: spacing.sm },
  menu: { marginTop: spacing.xl, marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.onSurface },
  version: { textAlign: "center", color: colors.muted, fontSize: 12, marginTop: spacing.xl },
});

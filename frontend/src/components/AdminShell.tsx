import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { SlideInLeft } from "react-native-reanimated";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

const NAV = [
  { key: "dash", label: "Dashboard", icon: "view-dashboard", route: "/admin", perm: null },
  { key: "team", label: "Team", icon: "anchor", route: "/admin/team", perm: null },
  { key: "podcast", label: "Podcast", icon: "microphone", route: "/admin/podcasts", perm: "podcasts" },
  { key: "news", label: "News", icon: "newspaper-variant", route: "/admin/news", perm: "news" },
  { key: "merch", label: "Merchandising", icon: "storefront", route: "/admin/products", perm: "merch" },
  { key: "schedule", label: "Palinsesto", icon: "calendar-month", route: "/admin/schedule", perm: "schedule" },
  { key: "radio", label: "Radio", icon: "radio", route: "/admin/radio", perm: "radio" },
  { key: "control", label: "Radio Control Center", icon: "access-point", route: "/admin/control", perm: "radio" },
  { key: "streaming", label: "Live Streaming", icon: "video-wireless", route: "/admin/streaming", perm: "radio" },
  { key: "prayer", label: "Richieste di Preghiera", icon: "hands-pray", route: "/admin/prayers", perm: "prayers" },
  { key: "messages", label: "Messaggi & Testimonianze", icon: "message-text", route: "/admin/messages", perm: "messages" },
  { key: "donations", label: "Donazioni", icon: "gift", route: "/admin/donations", perm: null },
  { key: "users", label: "Utenti", icon: "account-group", route: "/admin/users", perm: null },
  { key: "activity", label: "Registro Attività", icon: "history", route: "/admin/activity", perm: null },
  { key: "settings", label: "Impostazioni", icon: "cog", route: "/admin/settings", perm: null },
];

const ADMIN = {
  bg: "#0A1128", surface: "#16213E", card: "#1E293B", border: "#243049",
  text: "#FFFFFF", muted: "#94A3B8", accent: colors.brandPrimary,
};

export default function AdminShell({ title, activeKey, children }: { title: string; activeKey: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const wide = Dimensions.get("window").width >= 900;

  useEffect(() => {
    let cancelled = false;
    api.adminMe()
      .then((r: any) => { if (!cancelled) { setRole(r.role); setPerms(r.permissions || []); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const isCollab = role === "collaborator";
  const navItems = isCollab ? NAV.filter((n) => n.perm && perms.includes(n.perm)) : NAV;

  // Collaborators that land on an admin-only section get redirected to their first allowed one.
  useEffect(() => {
    if (!isCollab) return;
    const current = NAV.find((n) => n.key === activeKey);
    const allowed = current && current.perm && perms.includes(current.perm);
    if (!allowed && navItems.length > 0) {
      router.replace(navItems[0].route as any);
    }
  }, [isCollab, activeKey, perms, navItems, router]);

  const Sidebar = ({ onNav }: { onNav?: () => void }) => (
    <View style={[styles.sidebar, { paddingTop: wide ? insets.top + spacing.lg : spacing.lg }]}>
      <View style={styles.brand}>
        <View style={styles.brandBadge}><MaterialCommunityIcons name="anchor" size={20} color={colors.white} /></View>
        <View>
          <Text style={styles.brandName}>Admin Panel</Text>
          <Text style={styles.brandSub}>{isCollab ? "Collaboratore" : "Pescatori di Uomini"}</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {navItems.map((n) => {
          const active = n.key === activeKey;
          return (
            <Pressable
              key={n.key}
              testID={`admin-nav-${n.key}`}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => { onNav?.(); router.push(n.route as any); }}
            >
              <MaterialCommunityIcons name={n.icon as any} size={20} color={active ? colors.white : ADMIN.muted} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{n.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable testID="admin-exit" style={styles.exit} onPress={() => { onNav?.(); router.replace("/(tabs)"); }}>
        <Ionicons name="exit-outline" size={18} color={ADMIN.muted} />
        <Text style={styles.exitText}>Torna all'app</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.root, { flexDirection: wide ? "row" : "column" }]}>
      {wide && <Sidebar />}
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          {!wide && (
            <Pressable testID="admin-menu" onPress={() => setOpen(true)} hitSlop={10} style={styles.menuBtn}>
              <Ionicons name="menu" size={24} color={colors.white} />
            </Pressable>
          )}
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>

      {!wide && open && (
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <Animated.View entering={SlideInLeft.duration(220)} style={styles.drawer}>
            <Sidebar onNav={() => setOpen(false)} />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

export { ADMIN };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ADMIN.bg },
  sidebar: { width: 260, backgroundColor: ADMIN.surface, paddingHorizontal: spacing.md, paddingBottom: spacing.lg, borderRightWidth: 1, borderRightColor: ADMIN.border, flex: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, marginBottom: spacing.xl },
  brandBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: ADMIN.accent, alignItems: "center", justifyContent: "center" },
  brandName: { color: colors.white, fontSize: 16, fontWeight: "800" },
  brandSub: { color: ADMIN.muted, fontSize: 12 },
  navItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, marginBottom: 4 },
  navItemActive: { backgroundColor: ADMIN.accent },
  navLabel: { color: ADMIN.muted, fontSize: 14, fontWeight: "600" },
  navLabelActive: { color: colors.white, fontWeight: "800" },
  exit: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginTop: spacing.sm },
  exitText: { color: ADMIN.muted, fontSize: 14, fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: ADMIN.bg, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  menuBtn: { width: 24 },
  headerTitle: { color: colors.white, fontSize: 20, fontWeight: "800" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", flexDirection: "row" },
  drawer: { width: 280, height: "100%" },
});

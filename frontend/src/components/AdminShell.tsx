import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { SlideInLeft } from "react-native-reanimated";
import { api } from "@/src/api";
import Logo from "@/src/components/Logo";
import { CMS_SECTIONS } from "@/src/utils/sections";
import { colors, spacing, radius } from "@/src/theme";

// Generic CMS sections (managed by the universal engine). Adding a section in
// src/utils/sections.ts automatically adds it here — no panel restructuring needed.
const CMS_NAV = CMS_SECTIONS.map((s) => ({
  key: s.key, label: s.label, icon: s.icon, route: `/admin/content/${s.key}`, perm: "content",
}));

const NAV = [
  { key: "dash", label: "Dashboard", icon: "view-dashboard", route: "/admin", perm: "dashboard" },
  { key: "stats", label: "Statistiche", icon: "chart-line", route: "/admin/statistiche", perm: "stats" },
  { key: "agenda", label: "Agenda", icon: "calendar-check", route: "/admin/agenda", perm: "agenda.view" },
  { key: "team", label: "Team", icon: "anchor", route: "/admin/team", perm: "team" },
  { key: "podcast", label: "Podcast", icon: "microphone", route: "/admin/podcasts", perm: "podcasts" },
  { key: "meditations", label: "Meditazioni", icon: "book-open-variant", route: "/admin/meditations", perm: "meditations" },
  ...CMS_NAV,
  { key: "news", label: "Notizie", icon: "newspaper-variant", route: "/admin/news", perm: "news" },
  { key: "showcase", label: "Vetrina", icon: "star-circle", route: "/admin/showcase", perm: "showcase" },
  { key: "verses", label: "Versetto del Giorno", icon: "book-cross", route: "/admin/verses", perm: "verses" },
  { key: "plans", label: "Piani di Lettura", icon: "book-open-page-variant", route: "/admin/reading-plans", perm: "plans" },
  { key: "achievements", label: "Traguardi del Cammino", icon: "medal", route: "/admin/achievements", perm: "achievements" },
  { key: "merch", label: "Merchandising", icon: "storefront", route: "/admin/products", perm: "merch" },
  { key: "schedule", label: "Palinsesto", icon: "calendar-month", route: "/admin/schedule", perm: "schedule" },
  { key: "prayer", label: "Richieste di Preghiera", icon: "hands-pray", route: "/admin/prayers", perm: "prayers" },
  { key: "messages", label: "Messaggi & Testimonianze", icon: "message-text", route: "/admin/messages", perm: "messages" },
  { key: "donations", label: "Donazioni", icon: "gift", route: "/admin/donations", perm: "donations" },
  { key: "donate_config", label: "Sostieni il Progetto", icon: "hand-heart", route: "/admin/donate-config", perm: "donate_config" },
  { key: "finance", label: "Trasparenza Economica", icon: "chart-box", route: "/admin/finance", perm: "finance" },
  { key: "notifications", label: "Notifiche", icon: "bell-ring", route: "/admin/notifications", perm: "notifications" },
  { key: "reports", label: "Segnalazioni", icon: "message-alert", route: "/admin/reports", perm: "reports" },
  { key: "users", label: "Utenti", icon: "account-group", route: "/admin/users", perm: "users" },
  { key: "activity", label: "Registro Attività", icon: "history", route: "/admin/activity", perm: "activity" },
  { key: "settings", label: "Impostazioni", icon: "cog", route: "/admin/settings", perm: "settings" },
  { key: "home_layout", label: "Layout Home", icon: "view-dashboard", route: "/admin/home-layout", perm: "home_layout" },
  { key: "nav_icons", label: "Personalizzazione Navigazione", icon: "gesture-tap-button", route: "/admin/nav-icons", perm: "nav_icons" },
  { key: "section_names", label: "Nomi delle sezioni", icon: "rename-box", route: "/admin/section-names", perm: "section_names" },
  { key: "library_folders", label: "Cartelle Biblioteca", icon: "folder-multiple", route: "/admin/library-folders", perm: "library_folders" },
  { key: "content_folders", label: "Assegna contenuti", icon: "folder-move", route: "/admin/content-folders", perm: "content_folders" },
];

const ADMIN = {
  bg: "#0A1128", surface: "#16213E", card: "#1E293B", border: "#243049",
  text: "#FFFFFF", muted: "#94A3B8", accent: colors.brandPrimary,
};

export default function AdminShell({ title, activeKey, children }: { title: string; activeKey: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [unread, setUnread] = useState(0);
  // Reactive breakpoint: the sidebar auto-switches between a fixed rail (wide
  // screens) and a slide-in drawer (narrow) as the window/resolution changes.
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  // On wide screens the fixed sidebar can be collapsed on demand to free space.
  const showFixedSidebar = wide && !collapsed;

  useEffect(() => {
    let cancelled = false;
    api.adminMe()
      .then((r: any) => { if (!cancelled) { setRole(r.role); setPerms(r.permissions || []); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setReady(true); });
    const loadUnread = () => api.inboxUnread().then((r: any) => { if (!cancelled) setUnread(r.count || 0); }).catch(() => {});
    loadUnread();
    const iv = setInterval(loadUnread, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const isCollab = role === "collaborator";
  const hasPerm = (p?: string | null) => !!p && (p === "agenda.view" ? perms.some((x) => x.startsWith("agenda.")) : perms.includes(p));
  const navItems = useMemo(() => {
    if (!ready) return [];                       // avoid flashing the full menu before role is known
    return isCollab ? NAV.filter((n) => hasPerm(n.perm)) : NAV;
  }, [ready, isCollab, perms]); // eslint-disable-line react-hooks/exhaustive-deps

  // Is the current screen permitted for this user? (full admins & non-sidebar sub-screens allowed)
  const current = NAV.find((n) => n.key === activeKey);
  const allowedHere = role === "administrator" || !current || (isCollab && hasPerm(current.perm));
  const showContent = ready && allowedHere;

  // Collaborators that land on an admin-only section get redirected to their first allowed one.
  useEffect(() => {
    if (!ready || !isCollab) return;
    if (!current) return; // screens not in the sidebar (inbox, detail views) are allowed
    if (!hasPerm(current.perm) && navItems.length > 0) {
      router.replace(navItems[0].route as any);
    }
    // `router` is stable in expo-router and intentionally excluded from deps.
  }, [ready, isCollab, activeKey, perms, navItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const Sidebar = ({ onNav }: { onNav?: () => void }) => (
    <View style={[styles.sidebar, { paddingTop: wide ? insets.top + spacing.lg : spacing.lg }]}>
      <View style={styles.brand}>
        <Logo size={44} />
        <View>
          <Text style={styles.brandName}>Pannello Admin</Text>
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
        <Text style={styles.exitText}>Torna all&apos;app</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.root, { flexDirection: showFixedSidebar ? "row" : "column" }]}>
      {showFixedSidebar && <Sidebar />}
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            testID="admin-menu"
            onPress={() => (wide ? setCollapsed((c) => !c) : setOpen(true))}
            hitSlop={10}
            style={styles.menuBtn}
          >
            <Ionicons name={wide && !collapsed ? "chevron-back" : "menu"} size={24} color={colors.white} />
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <Pressable testID="admin-bell" onPress={() => router.push("/admin/inbox" as any)} hitSlop={10} style={styles.bell}>
            <Ionicons name="notifications-outline" size={24} color={colors.white} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
              </View>
            )}
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          {showContent ? children : (
            <View style={styles.gate}><ActivityIndicator color={colors.brandSecondary} size="large" /></View>
          )}
        </View>
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
  gate: { flex: 1, alignItems: "center", justifyContent: "center" },
  sidebar: { width: 260, backgroundColor: ADMIN.surface, paddingHorizontal: spacing.md, paddingBottom: spacing.lg, borderRightWidth: 1, borderRightColor: ADMIN.border, flex: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, marginBottom: spacing.xl },
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
  bell: { width: 30, alignItems: "flex-end" },
  badge: { position: "absolute", top: -6, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  headerTitle: { color: colors.white, fontSize: 20, fontWeight: "800" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", flexDirection: "row" },
  drawer: { width: 280, height: "100%" },
});

import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/src/context/SettingsContext";
import { colors } from "@/src/theme";

// Same items/icons as the in-tabs GlassTabBar so navigation looks identical
// everywhere. `section` gates visibility via the admin section toggles.
const ITEMS: { name: string; label: string; route: string; icon: keyof typeof Ionicons.glyphMap; section?: string }[] = [
  { name: "index", label: "Home", route: "/", icon: "home-outline" },
  { name: "podcast", label: "Podcast", route: "/podcast", icon: "mic-outline", section: "podcast" },
  { name: "meditazioni", label: "Meditazioni", route: "/meditazioni", icon: "book-outline", section: "meditazioni" },
  { name: "news", label: "Notizie", route: "/news", icon: "newspaper-outline", section: "news" },
  { name: "palinsesto", label: "Palinsesto", route: "/palinsesto", icon: "calendar-outline", section: "palinsesto" },
  { name: "profilo", label: "Altro", route: "/profilo", icon: "menu-outline" },
];

// Roots where the app bottom bar must NOT appear (the tabs group renders its own
// GlassTabBar; the others are pre-auth / admin / full-screen modal screens).
const HIDE_ROOTS = new Set(["", "(tabs)", "welcome", "auth", "login", "invite", "reset-password", "admin", "player", "join"]);

/**
 * Persistent bottom navigation shown on every stack screen (Bibbia, Preghiera,
 * Live, Donazioni, ecc.) so the main sections are always one tap away, matching
 * the request to keep the bottom bar visible everywhere.
 */
export default function GlobalTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const { sectionVisible } = useSettings();

  const root = (segments[0] as string) || "";
  if (HIDE_ROOTS.has(root)) return null;

  const isDark = colors.surface !== "#FFFFFF" && colors.surface !== "#F8FAFC";
  const items = ITEMS.filter((it) => !it.section || sectionVisible(it.section));

  const go = (route: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    router.navigate(route as any);
  };

  return (
    <View style={[styles.shadowWrap, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
      <View style={styles.clip}>
        <BlurView intensity={Platform.OS === "android" ? 40 : 60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={styles.tint} />
        <View style={styles.row}>
          {items.map((it) => (
            <Pressable key={it.name} testID={`globalnav-${it.name}`} style={styles.item} onPress={() => go(it.route)} hitSlop={6}>
              <View style={styles.iconWrap}>
                <Ionicons name={it.icon} size={23} color={colors.muted} />
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} allowFontScaling={false} style={styles.label}>
                {it.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
    zIndex: 40,
  },
  clip: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    overflow: "hidden",
  },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: Platform.OS === "android" ? colors.white : "rgba(255,255,255,0.72)" },
  row: { flexDirection: "row", alignItems: "flex-start", paddingTop: 8, paddingHorizontal: 4, minHeight: 58 },
  item: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  iconWrap: { width: 48, height: 30, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  label: { fontSize: Platform.OS === "web" ? 9.5 : 10.5, textAlign: "center", width: "100%", paddingHorizontal: 1, color: colors.muted, fontWeight: "600" },
});

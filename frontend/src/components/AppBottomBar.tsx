import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, Easing } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors } from "@/src/theme";
import { useNavItems, activeKeyForPath, NavCatalogItem } from "@/src/components/navConfig";

function NavItem({ item, focused, width, onPress }: { item: NavCatalogItem; focused: boolean; width?: number; onPress: () => void }) {
  const p = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(focused ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  const pillStyle = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: interpolate(p.value, [0, 1], [0.6, 1]) }] }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scaleX: p.value }] }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(p.value, [0, 1], [0, -1]) }] }));

  return (
    <Pressable style={[styles.item, width ? { width } : { flex: 1 }]} onPress={onPress} hitSlop={6} accessibilityRole="tab" accessibilityState={{ selected: focused }}>
      <Animated.View style={[styles.dot, dotStyle]} />
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, pillStyle]} />
        <Animated.View style={iconStyle}>
          <Ionicons name={focused ? item.iconOn : item.icon} size={23} color={focused ? colors.brandPrimary : colors.muted} />
        </Animated.View>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} allowFontScaling={false}
        style={[styles.label, { color: focused ? colors.navy : colors.muted, fontWeight: focused ? "800" : "600" }]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

/** Shared, admin-configurable bottom navigation bar. Rendered both inside the
 * tabs group (in-flow) and on stack screens (floating). Items, order and count
 * come from settings.nav_items. When many items are configured, the row becomes
 * horizontally scrollable so nothing gets crushed. */
export default function AppBottomBar({ floating }: { floating?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const items = useNavItems();
  const isDark = colors.surface !== "#FFFFFF" && colors.surface !== "#F8FAFC";
  const activeKey = activeKeyForPath(pathname, items);
  const scrollable = items.length > 6;

  const go = (route: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    router.navigate(route as any);
  };

  const cells = items.map((it) => (
    <NavItem key={it.key} item={it} width={scrollable ? 76 : undefined} focused={activeKey === it.key} onPress={() => go(it.route)} />
  ));

  return (
    <View style={[styles.shadowWrap, floating && styles.floating, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
      <View style={styles.clip}>
        <BlurView intensity={Platform.OS === "android" ? 40 : 60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={styles.tint} />
        {scrollable ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
            {cells}
          </ScrollView>
        ) : (
          <View style={styles.row}>{cells}</View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    backgroundColor: "transparent",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: colors.navy, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 16,
  },
  floating: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 40 },
  clip: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, overflow: "hidden" },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: Platform.OS === "android" ? colors.white : "rgba(255,255,255,0.72)" },
  row: { flexDirection: "row", alignItems: "flex-start", paddingTop: 8, paddingHorizontal: 4, minHeight: 58 },
  rowScroll: { flexDirection: "row", alignItems: "flex-start", paddingTop: 8, paddingHorizontal: 6, minHeight: 58 },
  item: { alignItems: "center", justifyContent: "flex-start" },
  dot: { position: "absolute", top: 0, width: 18, height: 3, borderRadius: 2, backgroundColor: colors.brandPrimary },
  iconWrap: { width: 48, height: 30, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  pill: { position: "absolute", width: 46, height: 28, borderRadius: 14, backgroundColor: colors.brandPrimary + "1F" },
  label: { fontSize: Platform.OS === "web" ? 9.5 : 10.5, textAlign: "center", width: "100%", paddingHorizontal: 1 },
});

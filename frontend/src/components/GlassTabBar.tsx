import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, interpolate, Easing } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors } from "@/src/theme";

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  index: { on: "home", off: "home-outline" },
  podcast: { on: "mic", off: "mic-outline" },
  meditazioni: { on: "book", off: "book-outline" },
  news: { on: "newspaper", off: "newspaper-outline" },
  palinsesto: { on: "calendar", off: "calendar-outline" },
  profilo: { on: "menu", off: "menu-outline" },
};

function TabItem({ label, icon, focused, onPress, onLongPress }: {
  label: string; icon: { on: any; off: any }; focused: boolean; onPress: () => void; onLongPress: () => void;
}) {
  const p = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(focused ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  const pillStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: interpolate(p.value, [0, 1], [0.6, 1]) }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scaleX: p.value }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(p.value, [0, 1], [0, -1]) }],
  }));

  return (
    <Pressable style={styles.item} onPress={onPress} onLongPress={onLongPress} hitSlop={6} accessibilityRole="tab" accessibilityState={{ selected: focused }}>
      <Animated.View style={[styles.dot, dotStyle]} />
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, pillStyle]} />
        <Animated.View style={iconStyle}>
          <Ionicons name={focused ? icon.on : icon.off} size={23} color={focused ? colors.brandPrimary : colors.muted} />
        </Animated.View>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        allowFontScaling={false}
        style={[styles.label, { color: focused ? colors.navy : colors.muted, fontWeight: focused ? "800" : "600" }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Modern glassmorphism bottom navigation: responsive labels (no truncation),
 * blur + soft shadow, rounded top, animated active indicator. */
export default function GlassTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const isDark = colors.surface !== "#FFFFFF" && colors.surface !== "#F8FAFC";

  return (
    <View style={[styles.shadowWrap, { paddingBottom: insets.bottom }]} pointerEvents="box-none">
      <View style={styles.clip}>
        <BlurView intensity={Platform.OS === "android" ? 40 : 60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={styles.tint} />
        <View style={styles.row}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const label = options.title ?? route.name;
            const focused = state.index === index;
            const icon = ICONS[route.name] || { on: "ellipse", off: "ellipse-outline" };

            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                navigation.navigate(route.name);
              }
            };
            const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key });

            return <TabItem key={route.key} label={label} icon={icon} focused={focused} onPress={onPress} onLongPress={onLongPress} />;
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    backgroundColor: "transparent",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
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
  item: { flex: 1, alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 0 },
  dot: { position: "absolute", top: 0, width: 18, height: 3, borderRadius: 2, backgroundColor: colors.brandPrimary },
  iconWrap: { width: 48, height: 30, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  pill: { position: "absolute", width: 46, height: 28, borderRadius: 14, backgroundColor: colors.brandPrimary + "1F" },
  label: { fontSize: Platform.OS === "web" ? 9.5 : 10.5, letterSpacing: 0, textAlign: "center", width: "100%", paddingHorizontal: 1 },
});

import React from "react";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MiniPlayer from "@/src/components/MiniPlayer";
import GlassTabBar from "@/src/components/GlassTabBar";
import { useSettings } from "@/src/context/SettingsContext";
import { colors } from "@/src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 58 + insets.bottom;
  const { sectionVisible } = useSettings();
  const hide = (key: string) => (sectionVisible(key) ? undefined : { href: null as any });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <GlassTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="podcast" options={{ title: "Podcast", ...hide("podcast") }} />
        <Tabs.Screen name="meditazioni" options={{ title: "Meditazioni", ...hide("meditazioni") }} />
        <Tabs.Screen name="news" options={{ title: "Notizie", ...hide("news") }} />
        <Tabs.Screen name="palinsesto" options={{ title: "Palinsesto", ...hide("palinsesto") }} />
        <Tabs.Screen name="profilo" options={{ title: "Altro" }} />
      </Tabs>
      <MiniPlayer bottom={tabBarHeight + 8} />
    </View>
  );
}

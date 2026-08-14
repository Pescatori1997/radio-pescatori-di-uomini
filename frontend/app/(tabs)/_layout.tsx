import React from "react";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MiniPlayer from "@/src/components/MiniPlayer";
import GlassTabBar from "@/src/components/GlassTabBar";
import { colors } from "@/src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 58 + insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <GlassTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="podcast" options={{ title: "Podcast" }} />
        <Tabs.Screen name="meditazioni" options={{ title: "Meditazioni" }} />
        <Tabs.Screen name="news" options={{ title: "Notizie" }} />
        <Tabs.Screen name="palinsesto" options={{ title: "Palinsesto" }} />
        <Tabs.Screen name="profilo" options={{ title: "Altro" }} />
      </Tabs>
      <MiniPlayer bottom={tabBarHeight + 8} />
    </View>
  );
}

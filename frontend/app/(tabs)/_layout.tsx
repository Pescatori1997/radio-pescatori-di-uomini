import React from "react";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MiniPlayer from "@/src/components/MiniPlayer";
import { colors } from "@/src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 58 + insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.navy,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopColor: colors.border,
            height: tabBarHeight,
            paddingTop: 6,
            paddingBottom: insets.bottom,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="podcast"
          options={{
            title: "Podcast",
            tabBarIcon: ({ color, size }) => <Ionicons name="mic" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="news"
          options={{
            title: "Notizie",
            tabBarIcon: ({ color, size }) => <Ionicons name="newspaper" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="palinsesto"
          options={{
            title: "Palinsesto",
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profilo"
          options={{
            title: "Profilo",
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
      </Tabs>
      <MiniPlayer bottom={tabBarHeight + 8} />
    </View>
  );
}

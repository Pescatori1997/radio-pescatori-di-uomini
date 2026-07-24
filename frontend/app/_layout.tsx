import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { PlayerProvider } from "@/src/context/PlayerContext";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PlayerProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="player" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="login" options={{ presentation: "modal" }} />
              <Stack.Screen name="prayer" options={{ presentation: "card" }} />
              <Stack.Screen name="about" />
              <Stack.Screen name="contact" />
              <Stack.Screen name="donate" />
              <Stack.Screen name="messages" />
              <Stack.Screen name="equipaggio/index" />
              <Stack.Screen name="equipaggio/[id]" />
              <Stack.Screen name="join" options={{ presentation: "card" }} />
              <Stack.Screen name="news/[id]" />
              <Stack.Screen name="podcast/[id]" />
              <Stack.Screen name="admin" />
            </Stack>
          </PlayerProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

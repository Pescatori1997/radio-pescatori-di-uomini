import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { ensureIconFontFaces } from "@/src/iconFonts";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { PlayerProvider } from "@/src/context/PlayerContext";
import { WeatherProvider } from "@/src/weather/WeatherContext";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// Inject @expo/vector-icons @font-face rules on web before any icon mounts, so the
// fontfaceobserver 6000ms-timeout polyfill never runs (prevents a hard crash on some
// Chromium browsers / slow networks). No-op on native. See src/iconFonts.ts.
ensureIconFontFaces();

// Root auth gate: force the welcome screen until the user logs in or chooses guest mode.
function AuthGate() {
  const { loading, user, guestChosen } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const root = segments[0] as string | undefined;
    const inWelcomeOrAuth = root === "welcome" || root === "auth";
    // Public routes reachable before deciding (welcome cards + auth form + invite accept + in-app login modal + Stripe return page).
    const inPublic = inWelcomeOrAuth || root === "login" || root === "invite" || root === "donation-success";
    const decided = !!user || guestChosen;
    if (!decided && !inPublic) {
      router.replace("/welcome");
    } else if (decided && inWelcomeOrAuth) {
      // Administrators land straight on the dashboard; everyone else on the app.
      router.replace(user?.role === "administrator" ? "/admin" : "/(tabs)");
    }
  }, [loading, user, guestChosen, segments, router]);

  return null;
}

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
            <WeatherProvider>
            <StatusBar style="light" />
            <AuthGate />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}>
              <Stack.Screen name="welcome" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="invite" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="player" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="login" options={{ presentation: "modal" }} />
              <Stack.Screen name="prayer" options={{ presentation: "card" }} />
              <Stack.Screen name="weather" options={{ presentation: "card", animation: "slide_from_right" }} />
              <Stack.Screen name="settings" options={{ presentation: "card" }} />
              <Stack.Screen name="about" />
              <Stack.Screen name="contact" />
              <Stack.Screen name="donate" />
              <Stack.Screen name="messages" />
              <Stack.Screen name="merch/index" />
              <Stack.Screen name="merch/[id]" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="equipaggio/index" />
              <Stack.Screen name="equipaggio/[id]" />
              <Stack.Screen name="join" options={{ presentation: "card" }} />
              <Stack.Screen name="news/[id]" />
              <Stack.Screen name="podcast/[id]" />
              <Stack.Screen name="admin" />
            </Stack>
            </WeatherProvider>
          </PlayerProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

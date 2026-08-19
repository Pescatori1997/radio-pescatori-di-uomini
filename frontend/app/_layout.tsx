import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform, Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { ensureIconFontFaces } from "@/src/iconFonts";
import { setupPWA } from "@/src/utils/pwa";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { PlayerProvider } from "@/src/context/PlayerContext";
import { LiveMiniProvider } from "@/src/context/LiveMiniContext";
import GlobalLiveMini from "@/src/components/live/GlobalLiveMini";
import { WeatherProvider } from "@/src/weather/WeatherContext";
import { SettingsProvider } from "@/src/context/SettingsContext";
import InstallPrompt from "@/src/components/InstallPrompt";
import Timoteo from "@/src/components/timoteo/Timoteo";
import GlobalTabBar from "@/src/components/GlobalTabBar";
import DesktopFrame from "@/src/components/DesktopFrame";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// --- Push notifications: module-scope config (must run before any component mounts) ---
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Predefinito",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

// Inject @expo/vector-icons @font-face rules on web before any icon mounts, so the
// fontfaceobserver 6000ms-timeout polyfill never runs (prevents a hard crash on some
// Chromium browsers / slow networks). No-op on native. See src/iconFonts.ts.
ensureIconFontFaces();

// Web-only: inject PWA manifest/meta tags + register the service worker so the
// app is installable in the browser. No-op on native (Expo mobile app untouched).
setupPWA();

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
    const inPublic = inWelcomeOrAuth || root === "login" || root === "invite" || root === "donation-success" || root === "reset-password";
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

// Handles tapping a push notification (warm + cold start) and nudges denied users weekly.
function PushListeners() {
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS === "web") return;
    const open = (data: any) => {
      const url = data?.deeplink || data?.action_url;
      if (!url) return;
      if (String(url).startsWith("http")) Linking.openURL(url);
      else router.push(url);
    };
    const tapSub = Notifications.addNotificationResponseReceivedListener(
      (r) => open(r.notification.request.content.data || {})
    );
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) open(r.notification.request.content.data || {});
    });
    (async () => {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status !== "denied" || canAskAgain) return;
      const last = await AsyncStorage.getItem("pushNudgeAt");
      const week = 7 * 24 * 60 * 60 * 1000;
      if (last && Date.now() - Number(last) <= week) return;
      Alert.alert(
        "Notifiche disattivate",
        "Attiva le notifiche per ricevere podcast, dirette e annunci di Pescatori di Uomini.",
        [
          { text: "Più tardi", style: "cancel", onPress: async () => { await AsyncStorage.setItem("pushNudgeAt", String(Date.now())); } },
          { text: "Apri Impostazioni", onPress: async () => { await AsyncStorage.setItem("pushNudgeAt", String(Date.now())); Linking.openSettings(); } },
        ]
      );
    })();
    return () => { tapSub.remove(); };
  }, [router]);
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
          <SettingsProvider>
          <PlayerProvider>
            <WeatherProvider>
            <LiveMiniProvider>
            <StatusBar style="light" />
            <AuthGate />
            <PushListeners />
            <InstallPrompt />
            <DesktopFrame>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}>
              <Stack.Screen name="welcome" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="invite" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="player" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="login" options={{ presentation: "modal" }} />
              <Stack.Screen name="prayer" options={{ presentation: "card" }} />
              <Stack.Screen name="weather" options={{ presentation: "card", animation: "slide_from_right" }} />
              <Stack.Screen name="meditazioni/[id]" options={{ presentation: "card" }} />
              <Stack.Screen name="biblioteca" options={{ presentation: "card", animation: "slide_from_right" }} />
              <Stack.Screen name="c/[section]/index" options={{ presentation: "card", animation: "slide_from_right" }} />
              <Stack.Screen name="c/[section]/[id]" options={{ presentation: "card" }} />
              <Stack.Screen name="settings" options={{ presentation: "card" }} />
              <Stack.Screen name="account" options={{ presentation: "card" }} />
              <Stack.Screen name="notifications-settings" options={{ presentation: "card" }} />
              <Stack.Screen name="reset-password" options={{ presentation: "card" }} />
              <Stack.Screen name="privacy" options={{ presentation: "card" }} />
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
            <GlobalTabBar />
            <GlobalLiveMini />
            <Timoteo />
            </DesktopFrame>
            </LiveMiniProvider>
            </WeatherProvider>
          </PlayerProvider>
          </SettingsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

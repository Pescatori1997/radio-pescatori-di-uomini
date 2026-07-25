// Web-only "Installa l'app" (Add to Home) banner.
// - Android/desktop Chrome/Edge: captures `beforeinstallprompt` and shows an
//   Install button that triggers the native install prompt.
// - iOS Safari: no beforeinstallprompt, so we show short "Condividi → Aggiungi
//   a Home" instructions instead.
// Hidden when already installed (standalone) or after the user dismisses it.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";

const DISMISS_KEY = "pdu_pwa_install_dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect touch Macs too.
  const iPadOS = navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return (iOSDevice || iPadOS) && isSafari;
}

export default function InstallPrompt() {
  const insets = useSafeAreaInsets();
  const [deferred, setDeferred] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    if (isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {}

    const onBIP = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const onInstalled = () => {
      setVisible(false);
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {}
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS never fires beforeinstallprompt -> show manual instructions.
    let t: any;
    if (isIOS()) {
      t = setTimeout(() => setVisible(true), 1500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      if (t) clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {}
      setDeferred(null);
      setVisible(false);
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {}
    } else if (isIOS()) {
      setIosHint((v) => !v);
    }
  };

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.card}>
        <Image source={require("@/assets/images/icon.png")} style={styles.icon} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Installa Pescatori di Uomini</Text>
          <Text style={styles.sub}>
            {iosHint
              ? "Tocca Condividi ⎋ in basso, poi \u201CAggiungi a Home\u201D."
              : "Aggiungila alla schermata Home per un accesso rapido."}
          </Text>
        </View>
        <Pressable testID="pwa-install-btn" onPress={install} style={styles.installBtn}>
          <Ionicons name="download-outline" size={16} color={colors.white} />
          <Text style={styles.installText}>Installa</Text>
        </Pressable>
        <Pressable testID="pwa-install-dismiss" onPress={dismiss} hitSlop={10} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    zIndex: 9999,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.navySoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    // subtle elevation on web
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)" as any,
  },
  icon: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.navy },
  title: { color: colors.white, fontSize: 14, fontWeight: "800" },
  sub: { color: "#CBD5E1", fontSize: 12, marginTop: 2, lineHeight: 16 },
  installBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  installText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  closeBtn: { padding: 4 },
});

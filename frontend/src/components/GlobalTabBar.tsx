import React from "react";
import { useSegments } from "expo-router";
import AppBottomBar from "@/src/components/AppBottomBar";

// Roots where the app bottom bar must NOT appear (the tabs group renders its own
// bar; the others are pre-auth / admin / full-screen modal screens).
const HIDE_ROOTS = new Set(["", "(tabs)", "welcome", "auth", "login", "invite", "reset-password", "admin", "player", "join"]);

/**
 * Persistent bottom navigation shown on every stack screen (Bibbia, Preghiera,
 * Live, Donazioni, ecc.) so the configured sections are always one tap away.
 * Uses the same admin-configurable items as the in-tabs bar.
 */
export default function GlobalTabBar() {
  const segments = useSegments();
  const root = (segments[0] as string) || "";
  if (HIDE_ROOTS.has(root)) return null;
  return <AppBottomBar floating />;
}

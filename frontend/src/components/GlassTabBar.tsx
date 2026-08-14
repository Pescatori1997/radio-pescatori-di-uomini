import React from "react";
import AppBottomBar from "@/src/components/AppBottomBar";

/** In-tabs bottom navigation. Fully driven by the admin-configured nav items
 * (see AppBottomBar); the expo-router tab props are intentionally ignored. */
export default function GlassTabBar() {
  return <AppBottomBar />;
}

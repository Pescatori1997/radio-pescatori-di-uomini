import React from "react";
import { View, useWindowDimensions, Platform, StyleSheet } from "react-native";

// Max content width for the centered desktop column (medium, airy).
export const MAX_CONTENT_WIDTH = 640;

/**
 * On wide web viewports (desktop), constrain the whole app to a centered column
 * so it no longer looks "stretched", with an elegant letterbox on the sides.
 * On mobile (and narrow web) it renders full-width, exactly as before.
 *
 * The wrapper structure is ALWAYS identical (two nested Views) — only styles
 * change with width — so crossing the breakpoint on resize never remounts the
 * app / loses state. All fixed children (tab bar, mini player, Timoteo bubble)
 * live inside the relatively-positioned frame, so they align to the column.
 */
export default function DesktopFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === "web" && width > MAX_CONTENT_WIDTH;
  return (
    <View style={[styles.outer, wide && styles.outerWide]}>
      <View style={[styles.frame, wide && styles.frameWide]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  outerWide: { backgroundColor: "#0A1128", alignItems: "center" },
  frame: { flex: 1, width: "100%", position: "relative" },
  frameWide: {
    maxWidth: MAX_CONTENT_WIDTH,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    // subtle depth so the column reads as a polished app surface
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
  },
});

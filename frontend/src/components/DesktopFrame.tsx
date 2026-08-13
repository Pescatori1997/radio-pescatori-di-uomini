import React from "react";
import { View, StyleSheet } from "react-native";

// Max content width for the centered desktop column (medium, airy).
export const MAX_CONTENT_WIDTH = 640;

/**
 * The app renders full-width on every viewport (mobile and desktop web). On the
 * Meditazioni reels player the vertical video is still clamped to a sensible
 * width (MAX_CONTENT_WIDTH) and centered on black, Instagram-style.
 *
 * The wrapper structure is ALWAYS identical (two nested Views) so nothing
 * remounts / loses state on resize.
 */
export default function DesktopFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.outer}>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  frame: { flex: 1, width: "100%", position: "relative", backgroundColor: "#FFFFFF" },
});

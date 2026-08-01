import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/src/theme";

// Shared official "Pescatori di Uomini" logo badge. Single source of truth used
// across the public app (Home hero) and the Admin panel sidebar, so any future
// logo update reflects everywhere automatically. We use a TIGHTLY CROPPED SQUARE
// emblem (logo-badge.png) so it fills the circular badge crisply — the original
// logo.png is a tall portrait with large transparent padding that rendered the
// emblem too small (and blurry when captured for share cards).
const LOGO = require("@/assets/images/logo-badge.png");

export default function Logo({
  size = 52,
  shadow = false,
  style,
}: {
  size?: number;
  shadow?: boolean;
  style?: any;
}) {
  const inner = Math.round(size * 0.9);
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
        shadow && styles.shadow,
        style,
      ]}
    >
      <Image source={LOGO} style={{ width: inner, height: inner }} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  shadow: {
    shadowColor: colors.brandPrimary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});

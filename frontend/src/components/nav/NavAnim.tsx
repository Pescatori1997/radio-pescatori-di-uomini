import React from "react";
import { Image } from "expo-image";

export type NavAnimProps = {
  url: string;
  kind?: "lottie" | "raster";
  size: number;
  playToken: number;
  onError?: () => void;
};

/**
 * Base fallback (used only by the type checker). At runtime Metro always resolves
 * the platform-specific implementations: NavAnim.web.tsx (web) and
 * NavAnim.native.tsx (iOS/Android). This raster-only version keeps types valid
 * without importing any platform-only libraries.
 */
export default function NavAnim({ url, size, playToken, onError }: NavAnimProps) {
  return (
    <Image
      key={playToken}
      source={{ uri: url }}
      style={{ width: size, height: size }}
      contentFit="contain"
      onError={() => onError?.()}
    />
  );
}

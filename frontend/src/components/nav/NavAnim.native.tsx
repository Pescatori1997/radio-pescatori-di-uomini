import React from "react";
import { Image } from "expo-image";
import LottieView from "lottie-react-native";

export type NavAnimProps = {
  url: string;
  kind?: "lottie" | "raster";
  size: number;
  playToken: number;
  onError?: () => void;
};

/**
 * Plays a nav-icon animation ONCE (native). Lottie files use lottie-react-native;
 * GIF / animated WebP use expo-image. Remounted via `playToken` so the animation
 * restarts each time its section is selected, then holds on the final frame.
 */
export default function NavAnim({ url, kind, size, playToken, onError }: NavAnimProps) {
  if (kind === "lottie") {
    return (
      <LottieView
        key={playToken}
        source={{ uri: url }}
        autoPlay
        loop={false}
        style={{ width: size + 8, height: size + 8 }}
        onAnimationFailure={() => onError?.()}
      />
    );
  }
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

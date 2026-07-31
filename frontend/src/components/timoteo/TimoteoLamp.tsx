import React from "react";
import Svg, { Path } from "react-native-svg";

/** A stylized oil lamp with a small flame — evokes Salmo 119:105
 * ("Lampada al mio piede è la tua parola"). Minimal, warm, non-cyber. */
export default function TimoteoLamp({ size = 26, bodyColor = "#FFFFFF", flameColor = "#FBBF24" }:
  { size?: number; bodyColor?: string; flameColor?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 48" fill="none">
      {/* flame */}
      <Path
        d="M9 25 C5 20 6 13 9 9 C12 13 14 20 9 25 Z"
        fill={flameColor}
      />
      {/* lamp body (bowl) */}
      <Path
        d="M13 30 C13 26 23 25 33 25 C47 25 55 27 55 31 C55 37 45 40 31 40 C19 40 13 35 13 30 Z"
        fill={bodyColor}
      />
      {/* spout */}
      <Path d="M13 30 L5 26 L6 30 L5 34 Z" fill={bodyColor} />
      {/* base */}
      <Path
        d="M26 40 h12 l-1 4 a2 2 0 0 1 -2 1 h-6 a2 2 0 0 1 -2 -1 Z"
        fill={bodyColor}
      />
      {/* handle */}
      <Path
        d="M54 29 C62 28 62 37 53 36"
        stroke={bodyColor}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

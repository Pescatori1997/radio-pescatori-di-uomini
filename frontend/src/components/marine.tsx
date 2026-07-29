import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Line, Defs, LinearGradient as SvgGradient, RadialGradient, Stop, G } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";

/**
 * Reusable marine graphic elements for the "Pescatori di Uomini" theme.
 * All elements are decorative, very low-opacity, and non-interactive so they
 * never disturb readability. Animations run on the UI thread (Reanimated).
 */

/* Semi-transparent diagonal fishing net. */
export function FishingNet({ width, height, gap = 22, color = "#FFFFFF", opacity = 0.08 }: { width: number; height: number; gap?: number; color?: string; opacity?: number }) {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let k = -height; k < width; k += gap) lines.push({ x1: k, y1: 0, x2: k + height, y2: height });      // ↘
  for (let k = 0; k < width + height; k += gap) lines.push({ x1: k, y1: 0, x2: k - height, y2: height });   // ↙
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <G opacity={opacity}>
        {lines.map((l, i) => (
          <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={color} strokeWidth={1} />
        ))}
      </G>
    </Svg>
  );
}

/* Layered sea waves anchored to the bottom of a container. */
export function SeaWaves({ width, height = 90, colors = ["#0EA5E9", "#38BDF8", "#7DD3FC"], opacity = [0.18, 0.14, 0.1] }: { width: number; height?: number; colors?: string[]; opacity?: number[] }) {
  const w = width;
  const p = (yBase: number, amp: number) =>
    `M0 ${yBase} C ${w * 0.2} ${yBase - amp}, ${w * 0.3} ${yBase + amp}, ${w * 0.5} ${yBase} S ${w * 0.8} ${yBase - amp}, ${w} ${yBase} L ${w} ${height} L 0 ${height} Z`;
  return (
    <Svg width={w} height={height} style={styles.bottom} pointerEvents="none">
      <Path d={p(height * 0.5, height * 0.16)} fill={colors[0]} opacity={opacity[0]} />
      <Path d={p(height * 0.62, height * 0.13)} fill={colors[1]} opacity={opacity[1]} />
      <Path d={p(height * 0.74, height * 0.1)} fill={colors[2]} opacity={opacity[2]} />
    </Svg>
  );
}

/* Warm sunrise glow (top-center). */
export function SunriseGlow({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="sun" cx="50%" cy="18%" r="60%">
          <Stop offset="0%" stopColor="#FDE68A" stopOpacity={0.55} />
          <Stop offset="35%" stopColor="#FBBF24" stopOpacity={0.22} />
          <Stop offset="100%" stopColor="#FBBF24" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={`M0 0 H${width} V${height} H0 Z`} fill="url(#sun)" />
    </Svg>
  );
}

/* Diagonal light rays coming from the top. */
export function LightRays({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgGradient id="ray" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.16} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <G>
        {[0.15, 0.4, 0.62].map((x, i) => (
          <Path key={i} d={`M ${width * x} 0 L ${width * (x + 0.06)} 0 L ${width * (x + 0.24)} ${height} L ${width * (x + 0.14)} ${height} Z`} fill="url(#ray)" />
        ))}
      </G>
    </Svg>
  );
}

/* Small bubbles slowly rising through the container. */
export function Bubbles({ height, count = 6, color = "#FFFFFF" }: { height: number; count?: number; color?: string }) {
  const cfg = React.useMemo(
    () => Array.from({ length: count }).map((_, i) => ({
      left: `${8 + (i * 84) / count + (i % 2) * 4}%`,
      size: 4 + (i % 3) * 3,
      dur: 4200 + (i % 4) * 900,
      delay: i * 700,
    })),
    [count],
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cfg.map((b, i) => (
        <Bubble key={i} left={b.left} size={b.size} dur={b.dur} delay={b.delay} height={height} color={color} />
      ))}
    </View>
  );
}

function Bubble({ left, size, dur, delay, height, color }: { left: string; size: number; dur: number; delay: number; height: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) }), -1, false));
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 0.1, 0.85, 1], [0, 0.5, 0.5, 0]),
    transform: [
      { translateY: interpolate(v.value, [0, 1], [height * 0.9, -8]) },
      { translateX: interpolate(v.value, [0, 0.5, 1], [0, size * 0.8, 0]) },
    ],
  }));
  return <Animated.View style={[{ position: "absolute", bottom: 0, left: left as any, width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" }, st]} />;
}

/* A soft accent blob (used behind headers). */
export function Blob({ style, color, opacity = 0.14 }: { style?: any; color: string; opacity?: number }) {
  return <View pointerEvents="none" style={[{ position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: color, opacity }, style]} />;
}

const styles = StyleSheet.create({
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
});

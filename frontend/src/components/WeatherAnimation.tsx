import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import type { WeatherCategory } from "@/src/weather/weatherCodes";

/**
 * Lightweight, battery-friendly weather illustration. Pure RN Views + Reanimated
 * transforms (no per-frame JS), so animations run on the UI thread and stay smooth.
 */
export default function WeatherAnimation({ category, size = 56 }: { category: WeatherCategory; size?: number }) {
  switch (category) {
    case "sun": return <Sun size={size} />;
    case "moon": return <Moon size={size} />;
    case "rain": return <Rain size={size} />;
    case "thunder": return <Thunder size={size} />;
    case "snow": return <Snow size={size} />;
    case "fog": return <Fog size={size} />;
    default: return <Cloud size={size} />;
  }
}

const C = {
  sun: "#F59E0B", sunLight: "#FBBF24", glow: "rgba(251,191,36,0.35)",
  cloud: "#CBD5E1", cloudDark: "#94A3B8",
  moon: "#93C5FD", moonCore: "#3B82F6", star: "#60A5FA",
  rain: "#38BDF8", snow: "#E2E8F0", fog: "#B4C2D4", bolt: "#FBBF24",
};

function useLoop(duration: number, delay = 0) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
  }, []);
  return v;
}

/* ---------------- SUN: rotating rays + breathing glow ---------------- */
function Sun({ size }: { size: number }) {
  const rot = useLoop(16000);
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const rayStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 360}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: interpolate(pulse.value, [0, 1], [0.3, 0.7]), transform: [{ scale: interpolate(pulse.value, [0, 1], [0.9, 1.1]) }] }));
  const core = size * 0.42;
  const rayLen = size * 0.16;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Animated.View style={[styles.center, { width: size * 0.8, height: size * 0.8, borderRadius: size * 0.4, backgroundColor: C.glow }, glowStyle]} />
      <Animated.View style={[styles.center, { width: size, height: size }, rayStyle]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[styles.ray, { width: 3, height: rayLen, backgroundColor: C.sunLight, borderRadius: 2, transform: [{ rotate: `${i * 45}deg` }, { translateY: -size * 0.42 }] }]} />
        ))}
      </Animated.View>
      <View style={[styles.center, { width: core, height: core, borderRadius: core / 2, backgroundColor: C.sun }]} />
    </View>
  );
}

/* ---------------- MOON: crescent + twinkling stars ---------------- */
function Moon({ size }: { size: number }) {
  const core = size * 0.5;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={[styles.center, { width: core, height: core, borderRadius: core / 2, backgroundColor: C.moon }]} />
      <View style={[styles.center, { width: core, height: core, borderRadius: core / 2, backgroundColor: "#F8FAFC", transform: [{ translateX: core * 0.28 }, { translateY: -core * 0.22 }] }]} />
      <Star size={size} x={-size * 0.32} y={-size * 0.28} delay={0} s={5} />
      <Star size={size} x={size * 0.34} y={size * 0.2} delay={700} s={4} />
      <Star size={size} x={size * 0.3} y={-size * 0.34} delay={1400} s={3} />
    </View>
  );
}

function Star({ size, x, y, delay, s }: { size: number; x: number; y: number; delay: number; s: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: interpolate(v.value, [0, 1], [0.2, 1]), transform: [{ scale: interpolate(v.value, [0, 1], [0.6, 1.1]) }] }));
  return <Animated.View style={[styles.center, { width: s, height: s, borderRadius: s / 2, backgroundColor: C.star, transform: [{ translateX: x }, { translateY: y }] }, st]} />;
}

/* ---------------- CLOUD: slow horizontal drift ---------------- */
function Cloud({ size, color = C.cloud }: { size: number; color?: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(v.value, [0, 1], [-size * 0.06, size * 0.06]) }] }));
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Animated.View style={st}><CloudShape size={size} color={color} /></Animated.View>
    </View>
  );
}

function CloudShape({ size, color = C.cloud, y = 0 }: { size: number; color?: string; y?: number }) {
  const w = size * 0.72;
  const h = size * 0.3;
  return (
    <View style={{ width: w, height: h + size * 0.14, justifyContent: "flex-end", transform: [{ translateY: y }] }}>
      <View style={{ position: "absolute", left: w * 0.12, top: 0, width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15, backgroundColor: color }} />
      <View style={{ position: "absolute", right: w * 0.02, top: size * 0.05, width: size * 0.26, height: size * 0.26, borderRadius: size * 0.13, backgroundColor: color }} />
      <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: color }} />
    </View>
  );
}

/* ---------------- RAIN: cloud + falling drops ---------------- */
function Rain({ size }: { size: number }) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ transform: [{ translateY: -size * 0.12 }] }}><CloudShape size={size} color={C.cloudDark} /></View>
      {[-0.18, 0, 0.18].map((dx, i) => (
        <Drop key={i} size={size} x={dx * size} delay={i * 300} color={C.rain} />
      ))}
    </View>
  );
}

function Drop({ size, x, delay, color }: { size: number; x: number; delay: number; color: string }) {
  const v = useLoop(1100, delay);
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 0.15, 0.85, 1], [0, 1, 1, 0]),
    transform: [{ translateX: x }, { translateY: interpolate(v.value, [0, 1], [size * 0.16, size * 0.42]) }],
  }));
  return <Animated.View style={[styles.center, { width: 3, height: size * 0.14, borderRadius: 2, backgroundColor: color }, st]} />;
}

/* ---------------- SNOW: falling flakes with slight sway ---------------- */
function Snow({ size }: { size: number }) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ transform: [{ translateY: -size * 0.12 }] }}><CloudShape size={size} color={C.cloud} /></View>
      {[-0.2, 0.02, 0.2].map((dx, i) => (
        <Flake key={i} size={size} x={dx * size} delay={i * 500} />
      ))}
    </View>
  );
}

function Flake({ size, x, delay }: { size: number; x: number; delay: number }) {
  const v = useLoop(2600, delay);
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 0.15, 0.85, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: x + interpolate(v.value, [0, 0.5, 1], [0, size * 0.05, 0]) },
      { translateY: interpolate(v.value, [0, 1], [size * 0.16, size * 0.44]) },
    ],
  }));
  const d = size * 0.1;
  return <Animated.View style={[styles.center, { width: d, height: d, borderRadius: d / 2, backgroundColor: C.snow, borderWidth: 1, borderColor: "#CBD5E1" }, st]} />;
}

/* ---------------- THUNDER: cloud + occasional flash ---------------- */
function Thunder({ size }: { size: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2200 }),
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 110 }),
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 900 }),
      ), -1, false);
  }, []);
  const bolt = useAnimatedStyle(() => ({ opacity: interpolate(v.value, [0, 1], [0.35, 1]), transform: [{ scale: interpolate(v.value, [0, 1], [0.9, 1.05]) }] }));
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ transform: [{ translateY: -size * 0.14 }] }}><CloudShape size={size} color={C.cloudDark} /></View>
      <Animated.View style={[styles.center, { transform: [{ translateY: size * 0.16 }] }, bolt]}>
        <View style={{ width: 0, height: 0, borderLeftWidth: size * 0.09, borderRightWidth: size * 0.05, borderTopWidth: size * 0.18, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: C.bolt, transform: [{ skewX: "-8deg" }] }} />
      </Animated.View>
    </View>
  );
}

/* ---------------- FOG: horizontal drifting bands ---------------- */
function Fog({ size }: { size: number }) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={{ transform: [{ translateY: -size * 0.18 }] }}><CloudShape size={size} color={C.cloud} /></View>
      {[0.12, 0.26, 0.4].map((ty, i) => (
        <FogBand key={i} size={size} y={size * ty} delay={i * 500} w={size * (0.6 - i * 0.08)} />
      ))}
    </View>
  );
}

function FogBand({ size, y, delay, w }: { size: number; y: number; delay: number; w: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 0.5, 1], [0.35, 0.7, 0.35]),
    transform: [{ translateX: interpolate(v.value, [0, 1], [-size * 0.12, size * 0.12]) }],
  }));
  return <Animated.View style={[{ position: "absolute", top: y, width: w, height: size * 0.06, borderRadius: size * 0.03, backgroundColor: C.fog }, st]} />;
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  center: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ray: { position: "absolute" },
});

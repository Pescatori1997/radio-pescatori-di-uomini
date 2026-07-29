import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";

/** Slowly pulsing status dot (used by the "IN DIRETTA ORA" badge when live). */
export function PulsingDot({ color, size = 8 }: { color: string; size?: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 1], [0.55, 0]),
    transform: [{ scale: interpolate(v.value, [0, 1], [1, 2.4]) }],
  }));
  const core = useAnimatedStyle(() => ({ opacity: interpolate(v.value, [0, 1], [1, 0.7]) }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]} />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, core]} />
    </View>
  );
}

/** Concentric sound waves that expand and fade behind the radio logo when live. */
export function SoundRings({ size = 52, color = "rgba(56,189,248,0.5)" }: { size?: number; color?: string }) {
  return (
    <View pointerEvents="none" style={[styles.ringsWrap, { width: size, height: size }]}>
      <Ring size={size} color={color} delay={0} />
      <Ring size={size} color={color} delay={900} />
      <Ring size={size} color={color} delay={1800} />
    </View>
  );
}

function Ring({ size, color, delay }: { size: number; color: string; delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2700, easing: Easing.out(Easing.ease) }), -1, false));
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 0.1, 1], [0, 0.6, 0]),
    transform: [{ scale: interpolate(v.value, [0, 1], [0.7, 2.1]) }],
  }));
  return <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color }, st]} />;
}

const styles = StyleSheet.create({
  ringsWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
});

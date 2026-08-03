import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors } from "@/src/theme";

function Dot({ delay }: { delay: number }) {
  const a = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.3, duration: 350, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a, delay]);
  return <Animated.View style={[styles.dot, { opacity: a, transform: [{ scale: a }] }]} />;
}

/** WhatsApp-style "is typing" indicator: avatar with initial + 3 animated dots. */
export default function TypingBubble({ name }: { name?: string }) {
  const initial = (name || "?").trim()[0]?.toUpperCase() || "?";
  return (
    <View style={styles.row}>
      <View style={styles.avatar}><Text style={styles.init}>{initial}</Text></View>
      <View style={styles.bubble}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  init: { color: colors.navy, fontWeight: "800", fontSize: 13 },
  bubble: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.10)", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderBottomLeftRadius: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#CBD5E1" },
});

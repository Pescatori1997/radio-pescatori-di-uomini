import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Rect, Line, Circle, G, Defs, LinearGradient as SvgGrad, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";

/**
 * "Pescatori di Uomini" fishing-net FRAME.
 *
 * A premium, responsive decorative frame that wraps the Live Player so it looks
 * "caught in the net" rather than being a bare iframe. The net + rope + knots
 * live ONLY in the border band around the video (the inner surface is opaque),
 * so nothing ever covers the actual content. Corners use slightly different
 * radii for a natural, hand-tied feel.
 */

const PAD = 14;          // width of the decorative border band
const ROPE = "#C9A36A";  // warm nautical rope
const ROPE_DK = "#9C7A45";

function NetBand({ w, h }: { w: number; h: number }) {
  // Diagonal net woven across the whole frame — the opaque inner view drawn on
  // top hides it in the center, leaving the net visible only in the border band.
  const gap = 13;
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let k = -h; k < w; k += gap) lines.push({ x1: k, y1: 0, x2: k + h, y2: h });
  for (let k = 0; k < w + h; k += gap) lines.push({ x1: k, y1: 0, x2: k - h, y2: h });
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <G opacity={0.5}>
        {lines.map((l, i) => (
          <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#7FB2D6" strokeWidth={0.8} />
        ))}
      </G>
    </Svg>
  );
}

function RopeBorder({ w, h }: { w: number; h: number }) {
  const inset = 5;
  const rx = 20;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgGrad id="rope" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={ROPE} />
          <Stop offset="0.5" stopColor={ROPE_DK} />
          <Stop offset="1" stopColor={ROPE} />
        </SvgGrad>
      </Defs>
      {/* Twisted rope simulated by a thick dashed stroke over a solid one. */}
      <Rect x={inset} y={inset} width={w - inset * 2} height={h - inset * 2} rx={rx} ry={rx}
        fill="none" stroke={ROPE_DK} strokeWidth={6} opacity={0.9} />
      <Rect x={inset} y={inset} width={w - inset * 2} height={h - inset * 2} rx={rx} ry={rx}
        fill="none" stroke="url(#rope)" strokeWidth={5} strokeDasharray="6 5" strokeLinecap="round" />
      {/* Knot dots at the four corners. */}
      {[
        { cx: inset + 2, cy: inset + 2 },
        { cx: w - inset - 2, cy: inset + 2 },
        { cx: inset + 2, cy: h - inset - 2 },
        { cx: w - inset - 2, cy: h - inset - 2 },
      ].map((k, i) => (
        <G key={i}>
          <Circle cx={k.cx} cy={k.cy} r={6.5} fill={ROPE} stroke={ROPE_DK} strokeWidth={1.5} />
          <Circle cx={k.cx} cy={k.cy} r={2} fill={ROPE_DK} />
        </G>
      ))}
    </Svg>
  );
}

export default function FishingNetFrame({
  children,
  aspectRatio = 16 / 9,
}: {
  children: React.ReactNode;
  aspectRatio?: number;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  return (
    <View style={styles.shadow}>
      <View
        style={styles.frame}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {/* Deep-sea gradient band */}
        <LinearGradient colors={["#0B2A4A", "#0A1B3A", "#081227"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {size.w > 0 && <NetBand w={size.w} h={size.h} />}
        {size.w > 0 && <RopeBorder w={size.w} h={size.h} />}

        {/* Small buoys/floats at the top corners (discreet). */}
        <View style={[styles.float, { top: -7, left: 22 }]} />
        <View style={[styles.float, { top: -7, right: 22, backgroundColor: "#F8FAFC" }]} />

        {/* Opaque inner surface holding the actual player. */}
        <View style={[styles.inner, { aspectRatio }]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 22,
    shadowColor: "#03060F",
    shadowOpacity: 0.5,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  frame: {
    borderRadius: 22,
    padding: PAD,
    overflow: "hidden",
    // Slightly irregular corners for a natural, hand-tied net feel.
    borderTopLeftRadius: 26,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 26,
  },
  inner: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  float: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});

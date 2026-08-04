import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, AccessibilityInfo } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from "react-native-reanimated";
import Medal, { Achievement } from "./Medal";
import MedalDetailOverlay from "./MedalDetailOverlay";
import { WOODS, WoodKey } from "./wood";

type Settings = {
  title?: string;
  principle_line1?: string;
  principle_line2?: string;
  intro_text?: string;
  animation_enabled?: boolean;
  empty_slots_mode?: string;
  continue_text?: string;
  wood?: WoodKey;
};

// A wooden ledge with medals hanging from a brass rail, one per category.
function Shelf({ label, medals, wood, onOpen }: { label: string; medals: Achievement[]; wood: any; onOpen: (a: Achievement) => void }) {
  return (
    <View style={styles.shelf}>
      {/* engraved category plaque */}
      <View style={styles.plaqueWrap}>
        <LinearGradient colors={wood.plaque} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.plaque}>
          <Text style={[styles.plaqueText, { color: wood.plaqueText }]} numberOfLines={1}>{label}</Text>
        </LinearGradient>
      </View>
      {/* brass hanging rail */}
      <View style={[styles.rail, { backgroundColor: wood.brass, borderColor: wood.brassDark }]} />
      <View style={styles.medalsRow}>
        {medals.map((m) => (
          <Medal key={m.id} a={m} size={72} onPress={() => onOpen(m)} />
        ))}
      </View>
      {/* wooden ledge base */}
      <LinearGradient colors={[wood.bevelLight, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.ledgeHi} />
      <LinearGradient colors={wood.frame} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.ledge} />
    </View>
  );
}

export default function BachecaDelCammino({ settings, achievements }: { settings: Settings; achievements: Achievement[] }) {
  const wood = WOODS[(settings.wood as WoodKey) || "walnut"] || WOODS.walnut;
  const [selected, setSelected] = useState<Achievement | null>(null);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const open = useSharedValue(0); // 0 closed, 1 open

  useEffect(() => {
    let reduced = false;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      reduced = r;
      const anim = settings.animation_enabled !== false && !reduced;
      if (anim) {
        open.value = withDelay(450, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
      } else {
        open.value = 1;
      }
      setDoorsOpen(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDoors = () => {
    const next = !doorsOpen;
    setDoorsOpen(next);
    open.value = withTiming(next ? 1 : 0, { duration: 700, easing: Easing.inOut(Easing.cubic) });
  };

  const leftDoor = useAnimatedStyle(() => ({
    transform: [{ perspective: 1400 }, { rotateY: `${open.value * -105}deg` }],
    opacity: open.value > 0.72 ? 0 : 1,
  }));
  const rightDoor = useAnimatedStyle(() => ({
    transform: [{ perspective: 1400 }, { rotateY: `${open.value * 105}deg` }],
    opacity: open.value > 0.72 ? 0 : 1,
  }));

  // Group medals by category, preserving their order.
  const shelves = useMemo(() => {
    const map: { label: string; medals: Achievement[] }[] = [];
    for (const a of achievements) {
      let g = map.find((x) => x.label === a.category);
      if (!g) { g = { label: a.category, medals: [] }; map.push(g); }
      g.medals.push(a);
    }
    return map;
  }, [achievements]);

  const earnedCount = achievements.filter((a) => a.earned).length;

  const Door = ({ side, style }: { side: "left" | "right"; style: any }) => (
    <Animated.View
      pointerEvents={doorsOpen ? "none" : "auto"}
      style={[styles.door, side === "left" ? styles.doorLeft : styles.doorRight, style]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={toggleDoors}>
        <LinearGradient colors={wood.frame} start={{ x: side === "left" ? 0 : 1, y: 0 }} end={{ x: side === "left" ? 1 : 0, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* carved inset panel */}
        <View style={[styles.doorPanel, { borderColor: wood.bevelDark }]}>
          <View style={[styles.doorPanelInner, { borderColor: wood.bevelLight }]} />
        </View>
        {/* grain */}
        {[0.22, 0.4, 0.6, 0.8].map((p) => (
          <View key={p} style={[styles.grainLine, { left: `${p * 100}%`, backgroundColor: wood.grain }]} />
        ))}
        {/* brass handle */}
        <View style={[styles.handle, side === "left" ? { right: 8 } : { left: 8 }, { backgroundColor: wood.brass, borderColor: wood.brassDark }]} />
      </Pressable>
    </Animated.View>
  );

  return (
    <View>
      {/* Principle header */}
      <View style={styles.principle}>
        <Text style={styles.principleLines}>{settings.principle_line1 || "NON È UNA GARA."}  <Text style={styles.principleAccent}>{settings.principle_line2 || "È UN CAMMINO."}</Text></Text>
        {!!settings.intro_text && <Text style={styles.intro}>{settings.intro_text}</Text>}
        <View style={styles.countBadge}>
          <Ionicons name="ribbon" size={15} color="#D9B26A" />
          <Text style={styles.countText}>{earnedCount} {earnedCount === 1 ? "traguardo raggiunto" : "traguardi raggiunti"} su {achievements.length}</Text>
        </View>
      </View>

      {/* Cabinet */}
      <View style={styles.cabinetOuter}>
        <LinearGradient colors={wood.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frameFace} />
        <View style={styles.cabinetInner}>
          {/* backboard */}
          <LinearGradient colors={wood.board} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {[0.14, 0.34, 0.5, 0.66, 0.86].map((p) => (
            <View key={p} style={[styles.boardGrain, { left: `${p * 100}%`, backgroundColor: wood.grain }]} />
          ))}
          <View style={styles.innerShadowTop} />

          <View style={styles.shelvesWrap}>
            {shelves.map((s) => (
              <Shelf key={s.label} label={s.label} medals={s.medals} wood={wood} onOpen={setSelected} />
            ))}

            {/* "Il cammino continua…" plaque */}
            <View style={styles.continueWrap}>
              <LinearGradient colors={wood.plaque} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.continuePlaque}>
                <Ionicons name="footsteps-outline" size={16} color={wood.plaqueText} />
                <Text style={[styles.continueText, { color: wood.plaqueText }]}>{settings.continue_text || "Il cammino continua…"}</Text>
              </LinearGradient>
            </View>
          </View>

          {/* Doors overlay */}
          <Door side="left" style={leftDoor} />
          <Door side="right" style={rightDoor} />
        </View>
      </View>

      {!doorsOpen && (
        <Text style={styles.openHint}>Tocca le ante per aprire la bacheca</Text>
      )}

      {selected && <MedalDetailOverlay a={selected} onClose={() => setSelected(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  principle: { alignItems: "center", paddingHorizontal: 24, marginBottom: 18 },
  principleLines: { fontSize: 15, fontWeight: "900", color: "#0A1128", letterSpacing: 1, textAlign: "center" },
  principleAccent: { color: "#0EA5E9" },
  intro: { fontSize: 13.5, lineHeight: 20, color: "#475569", textAlign: "center", marginTop: 8, fontStyle: "italic" },
  countBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: "#0A1128", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  countText: { color: "#F8FAFC", fontSize: 12.5, fontWeight: "700" },

  cabinetOuter: {
    marginHorizontal: 16, borderRadius: 18, padding: 14, overflow: "visible",
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 12,
  },
  frameFace: { ...StyleSheet.absoluteFillObject, borderRadius: 18, borderWidth: 2, borderColor: "rgba(0,0,0,0.35)" },
  cabinetInner: {
    borderRadius: 10, overflow: "hidden", minHeight: 200,
    borderWidth: 3, borderColor: "rgba(0,0,0,0.45)",
  },
  boardGrain: { position: "absolute", top: 0, bottom: 0, width: 1.5, opacity: 0.6 },
  innerShadowTop: { position: "absolute", top: 0, left: 0, right: 0, height: 26, backgroundColor: "rgba(0,0,0,0.4)" },
  shelvesWrap: { padding: 12, paddingTop: 18, gap: 6 },

  shelf: { marginBottom: 14 },
  plaqueWrap: { alignItems: "center", marginBottom: 8, zIndex: 2 },
  plaque: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.3)" },
  plaqueText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },
  rail: { height: 4, borderRadius: 2, marginHorizontal: 6, borderWidth: 0.5, opacity: 0.9, marginBottom: -6, zIndex: 1 },
  medalsRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-start", flexWrap: "wrap", gap: 4 },
  ledgeHi: { height: 3, borderRadius: 2, marginTop: 6, opacity: 0.7 },
  ledge: { height: 12, borderRadius: 3, marginTop: 1, borderBottomWidth: 2, borderBottomColor: "rgba(0,0,0,0.4)" },

  continueWrap: { alignItems: "center", marginTop: 4, marginBottom: 6 },
  continuePlaque: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.3)" },
  continueText: { fontSize: 13, fontWeight: "800", fontStyle: "italic" },

  door: { position: "absolute", top: 0, bottom: 0, width: "50%", overflow: "hidden", borderColor: "rgba(0,0,0,0.4)" },
  doorLeft: { left: 0, transformOrigin: "left center", borderRightWidth: 1, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  doorRight: { right: 0, transformOrigin: "right center", borderLeftWidth: 1, borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  doorPanel: { position: "absolute", top: 14, left: 14, right: 14, bottom: 14, borderWidth: 2, borderRadius: 6 },
  doorPanelInner: { flex: 1, margin: 4, borderWidth: 1, borderRadius: 4 },
  grainLine: { position: "absolute", top: 0, bottom: 0, width: 1.5, opacity: 0.5 },
  handle: { position: "absolute", top: "48%", width: 10, height: 26, borderRadius: 5, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },

  openHint: { textAlign: "center", color: "#64748B", fontSize: 12.5, fontWeight: "600", marginTop: 12 },
});

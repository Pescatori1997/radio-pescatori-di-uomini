import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions, Platform, Modal, Animated, Linking } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { DAYS, romeNow, romeDay, isOnAir } from "@/src/utils/onair";
import { colors, spacing, radius } from "@/src/theme";

const C_TEXT = colors.onSurface;
const C_CARD = colors.surfaceSecondary;

/** Horizontal 24h broadcast timeline. Data is fully dynamic (api.programs()),
 * so any change made by an admin is reflected automatically. */
const PPM = 2.2;                 // px per minute
const DAY_W = 24 * 60 * PPM;     // full-day track width
const SIDE_PAD = 16;
const RULER_H = 30;
const LANE_TOP = RULER_H + 26;   // leaves room for the "SEI QUI" pill
const BLOCK_H = 120;
const TRACK_H = LANE_TOP + BLOCK_H + 12;

/** Content types → legend colours/labels (coherent with the app palette). */
const TYPES: Record<string, { label: string; color: string; icon: any; emoji: string }> = {
  live:       { label: "LIVE",        color: "#E11D48", icon: "radio-outline",         emoji: "🔴" },
  recorded:   { label: "REGISTRATO",  color: "#0EA5E9", icon: "recording-outline",     emoji: "🔵" },
  music:      { label: "MUSICA",      color: "#A855F7", icon: "musical-notes-outline", emoji: "🟣" },
  reflection: { label: "RIFLESSIONE", color: "#22C55E", icon: "book-outline",          emoji: "🟢" },
};
const LEGEND = ["live", "recorded", "music", "reflection"];

function typeOf(p: any): string {
  const t = String(p?.type || "").toLowerCase();
  return TYPES[t] ? t : "recorded"; // "regular"/empty → REGISTRATO
}

function toMin(hm: string): number {
  if (!hm) return 0;
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function Avatars({ presenters, images, color, size = 40 }: any) {
  const pics = (images && images.length ? images : (presenters || []).map((p: any) => p.image)).filter(Boolean);
  const accent = color || colors.brandPrimary;
  if (!pics.length) {
    return <View style={[styles.avatar, styles.avatarEmpty, { width: size, height: size, borderRadius: size / 2, borderColor: accent }]}><Ionicons name="mic" size={size * 0.45} color={accent} /></View>;
  }
  return (
    <View style={{ flexDirection: "row" }}>
      {pics.slice(0, 3).map((uri: string, i: number) => (
        <Image key={i} source={{ uri }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, marginLeft: i === 0 ? 0 : -size * 0.32, borderColor: colors.surface, zIndex: 10 - i }]} contentFit="cover" />
      ))}
    </View>
  );
}

export default function Palinsesto() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(romeNow());
  const [offset, setOffset] = useState(0); // days from today
  const [selected, setSelected] = useState<any>(null);
  const scrollRef = useRef<ScrollView>(null);
  const didScroll = useRef(false);
  const pulse = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      setNow(romeNow());
      api.programs().then((list: any[]) => setPrograms(list || [])).catch(() => {}).finally(() => setLoading(false));
      const t = setInterval(() => setNow(romeNow()), 30000);
      return () => clearInterval(t);
    }, [])
  );

  // Subtle "on-air" pulse loop.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const dayInfo = useMemo(() => romeDay(offset), [offset]);
  const isToday = offset === 0;

  const dayPrograms = useMemo(() => {
    return (programs || [])
      .filter((p) => p.active !== false && p.start_time && p.end_time && (p.weekdays || []).includes(dayInfo.weekday))
      .map((p) => ({ ...p, _start: toMin(p.start_time), _end: p.end_time <= p.start_time ? 1440 : toMin(p.end_time) }))
      .sort((a, b) => a._start - b._start);
  }, [programs, dayInfo.weekday]);

  const liveProg = useMemo(() => (isToday ? dayPrograms.find((p) => isOnAir(p)) : null), [isToday, dayPrograms, now.hm]);
  const nowMin = toMin(now.hm);
  const cursorLeft = nowMin * PPM;

  const onContentReady = useCallback(() => {
    if (didScroll.current || !isToday || loading) return;
    didScroll.current = true;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: Math.max(0, cursorLeft - width / 3), animated: false });
    });
  }, [isToday, loading, cursorLeft, width]);

  // reset auto-scroll when switching day
  useEffect(() => { didScroll.current = false; }, [offset]);

  const hours = Array.from({ length: 9 }, (_, i) => i * 3); // 0,3,...,24

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] });

  const openListen = (p: any, live: boolean) => {
    if (p.stream_url) { Linking.openURL(p.stream_url).catch(() => {}); return; }
    router.push("/live");
    setSelected(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.kicker}>PALINSESTO</Text>
        <Text style={styles.date}>{dayInfo.dateLabel}</Text>

        {/* Day navigation: ‹ Ieri · Oggi · Domani › */}
        <View style={styles.nav}>
          <Pressable testID="day-prev" onPress={() => setOffset((o) => o - 1)} style={styles.navBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.white} />
            <Text style={styles.navText}>Ieri</Text>
          </Pressable>
          <Pressable testID="day-today" onPress={() => setOffset(0)} style={[styles.todayBtn, isToday && styles.todayBtnActive]} hitSlop={8}>
            <Text style={[styles.todayText, isToday && styles.todayTextActive]}>Oggi</Text>
          </Pressable>
          <Pressable testID="day-next" onPress={() => setOffset((o) => o + 1)} style={styles.navBtn} hitSlop={8}>
            <Text style={styles.navText}>Domani</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.white} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
          {/* Horizontal timeline */}
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator
            onContentSizeChange={onContentReady}
            contentContainerStyle={{ width: DAY_W + SIDE_PAD * 2, paddingHorizontal: SIDE_PAD, paddingTop: spacing.md }}
            style={styles.timelineScroll}
          >
            <View style={{ width: DAY_W, height: TRACK_H }}>
              {/* hour grid + ruler */}
              {hours.map((h) => {
                const left = h * 60 * PPM;
                return (
                  <View key={`h-${h}`} style={[styles.gridCol, { left }]} pointerEvents="none">
                    <Text style={[styles.hourLabel, h === 24 && { transform: [{ translateX: -34 }] }]}>{`${String(h).padStart(2, "0")}:00`}</Text>
                    <View style={styles.gridLine} />
                  </View>
                );
              })}

              {/* baseline under the ruler */}
              <View style={[styles.baseline, { top: RULER_H }]} pointerEvents="none" />

              {/* empty-day hint */}
              {dayPrograms.length === 0 && (
                <View style={[styles.emptyHint, { top: LANE_TOP + BLOCK_H / 2 - 20 }]} pointerEvents="none">
                  <Ionicons name="radio-outline" size={20} color={colors.muted} />
                  <Text style={styles.emptyText}>Nessun programma in griglia · Radio H24 in diretta</Text>
                </View>
              )}

              {/* program blocks */}
              {dayPrograms.map((p) => {
                const tc = TYPES[typeOf(p)];
                const left = p._start * PPM;
                const w = Math.max(6, (p._end - p._start) * PPM - 4);
                const live = !!liveProg && liveProg.id === p.id;
                const wide = w >= 68;
                return (
                  <Pressable
                    key={p.id}
                    testID={`slot-${p.id}`}
                    onPress={() => setSelected({ p, live })}
                    style={[styles.block, { left, width: w, top: LANE_TOP, height: BLOCK_H, backgroundColor: tc.color + "1A", borderColor: live ? tc.color : tc.color + "55" }]}
                  >
                    <View style={[styles.blockAccent, { backgroundColor: tc.color }]} />
                    {live && (
                      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.liveGlow, { borderColor: tc.color, opacity: glowOpacity }]} />
                    )}
                    {wide ? (
                      <View style={styles.blockInner}>
                        {live && <View style={[styles.onAir, { backgroundColor: tc.color }]}><Text style={styles.onAirText}>● IN ONDA</Text></View>}
                        <Text style={[styles.blockTitle, live && { color: tc.color }]} numberOfLines={2}>{p.title}</Text>
                        <Text style={styles.blockTime}>{p.start_time} – {p.end_time}</Text>
                        {!!p.host && w >= 120 && <Text style={styles.blockHost} numberOfLines={1}>{p.host}</Text>}
                      </View>
                    ) : (
                      <View style={styles.blockNarrow}><Ionicons name={tc.icon} size={16} color={tc.color} /></View>
                    )}
                  </Pressable>
                );
              })}

              {/* SEI QUI cursor (only for today) */}
              {isToday && (
                <View style={[styles.cursor, { left: cursorLeft, height: TRACK_H }]} pointerEvents="none" testID="now-cursor">
                  <View style={styles.cursorPill}><Text style={styles.cursorPillText}>🔴 SEI QUI</Text></View>
                  <View style={styles.cursorLine} />
                </View>
              )}
            </View>
          </ScrollView>

          {/* Legend */}
          <View style={[styles.legend, isWide && { justifyContent: "center" }]}>
            {LEGEND.map((k) => (
              <View key={k} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: TYPES[k].color }]} />
                <Text style={styles.legendText}>{TYPES[k].label}</Text>
              </View>
            ))}
          </View>

          {/* On-air quick banner */}
          {isToday && (
            <Pressable style={styles.nowBanner} onPress={() => (liveProg ? setSelected({ p: liveProg, live: true }) : router.push("/live"))}>
              <View style={[styles.nowDot, { backgroundColor: colors.error }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.nowLabel}>ORA IN ONDA · {now.hm}</Text>
                <Text style={styles.nowTitle} numberOfLines={1}>{liveProg ? liveProg.title : "Diretta Radio · Pescatori di Uomini"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* Program detail modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            {selected && (() => {
              const p = selected.p;
              const tc = TYPES[typeOf(p)];
              const live = selected.live;
              return (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}>
                  <View style={[styles.typeTag, { backgroundColor: tc.color + "22", borderColor: tc.color }]}>
                    <Ionicons name={tc.icon} size={13} color={tc.color} />
                    <Text style={[styles.typeTagText, { color: tc.color }]}>{tc.label}</Text>
                  </View>
                  {live && <View style={[styles.onAir, styles.onAirBig, { backgroundColor: tc.color }]}><Text style={styles.onAirText}>● IN ONDA</Text></View>}
                  <View style={styles.sheetHeader}>
                    <Avatars presenters={p.presenters} images={p.images} color={p.color} size={54} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetTitle}>{p.title}</Text>
                      <Text style={styles.sheetRange}>{p.start_time} – {p.end_time}</Text>
                    </View>
                  </View>
                  {!!p.host && (
                    <View style={styles.metaRow}><Ionicons name="mic-outline" size={16} color={colors.brandPrimary} /><Text style={styles.metaText}>{p.host}</Text></View>
                  )}
                  {!!p.description && <Text style={styles.sheetDesc}>{p.description}</Text>}
                  {(live || p.stream_url) && (
                    <Pressable testID="listen-btn" style={[styles.listenBtn, { backgroundColor: tc.color }]} onPress={() => openListen(p, live)}>
                      <Ionicons name="play" size={18} color={colors.white} />
                      <Text style={styles.listenText}>{live ? "Ascolta la diretta" : "Ascolta ora"}</Text>
                    </Pressable>
                  )}
                  <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
                    <Text style={styles.closeText}>Chiudi</Text>
                  </Pressable>
                </ScrollView>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border + "66" },
  kicker: { color: colors.brandPrimary, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  date: { color: C_TEXT, fontSize: 24, fontWeight: "900", marginTop: 2 },
  nav: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: C_CARD, borderWidth: 1, borderColor: colors.border },
  navText: { color: C_TEXT, fontSize: 13, fontWeight: "800" },
  todayBtn: { paddingVertical: 8, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: C_CARD, borderWidth: 1, borderColor: colors.border },
  todayBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  todayText: { color: C_TEXT, fontSize: 13, fontWeight: "900" },
  todayTextActive: { color: colors.white },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  timelineScroll: { backgroundColor: colors.surface },

  gridCol: { position: "absolute", top: 0, bottom: 0, width: 1 },
  hourLabel: { position: "absolute", top: 4, left: 4, color: colors.muted, fontSize: 11, fontWeight: "800" },
  gridLine: { position: "absolute", top: RULER_H, bottom: 12, left: 0, width: 1, backgroundColor: colors.border + "55" },
  baseline: { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: colors.border + "88", borderRadius: 1 },

  emptyHint: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 6 },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: "700" },

  block: { position: "absolute", borderRadius: radius.md, borderWidth: 1.5, overflow: "hidden" },
  blockAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  liveGlow: { borderRadius: radius.md, borderWidth: 2.5 },
  blockInner: { flex: 1, paddingVertical: spacing.sm, paddingLeft: 14, paddingRight: 10, justifyContent: "center" },
  blockNarrow: { flex: 1, alignItems: "center", justifyContent: "center", paddingLeft: 4 },
  blockTitle: { color: C_TEXT, fontSize: 14, fontWeight: "900", lineHeight: 18 },
  blockTime: { color: colors.muted, fontSize: 11.5, fontWeight: "700", marginTop: 4 },
  blockHost: { color: colors.muted, fontSize: 11, marginTop: 2 },
  onAir: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginBottom: 6 },
  onAirBig: { marginBottom: spacing.sm },
  onAirText: { color: colors.white, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  cursor: { position: "absolute", top: 0, width: 2, alignItems: "center" },
  cursorPill: { backgroundColor: colors.error, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, transform: [{ translateX: 0 }], zIndex: 5 },
  cursorPillText: { color: colors.white, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  cursorLine: { flex: 1, width: 2, backgroundColor: colors.error, marginTop: 2 },

  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },

  nowBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: C_CARD, borderWidth: 1, borderColor: colors.border },
  nowDot: { width: 12, height: 12, borderRadius: 6 },
  nowLabel: { color: colors.error, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  nowTitle: { color: C_TEXT, fontSize: 15, fontWeight: "800", marginTop: 2 },

  avatar: { borderWidth: 2 },
  avatarEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: C_CARD },

  backdrop: { flex: 1, backgroundColor: "rgba(4,10,24,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "82%" },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md },
  typeTag: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, marginBottom: spacing.sm },
  typeTagText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  sheetTitle: { color: C_TEXT, fontSize: 20, fontWeight: "900" },
  sheetRange: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800", marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
  metaText: { color: C_TEXT, fontSize: 14, fontWeight: "700" },
  sheetDesc: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 4, marginBottom: spacing.md },
  listenBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.sm },
  listenText: { color: colors.white, fontSize: 16, fontWeight: "900" },
  closeBtn: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  closeText: { color: colors.muted, fontSize: 15, fontWeight: "700" },
});

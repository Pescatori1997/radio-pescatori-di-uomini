import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions, Platform } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { DAYS, romeNow } from "@/src/utils/onair";
import { colors, spacing, radius } from "@/src/theme";

const H24_DESC = "Musica cristiana, meditazioni, podcast e contenuti biblici in onda 24 ore su 24.";

/** Vertical scale: pixels per hour. The whole day is a real 24h chronological scale. */
const HOUR_H = 120;
const DAY_H = 24 * HOUR_H;
const LABEL_W = 44;      // left hour-labels column
const SPINE_X = 52;      // x position of the vertical timeline line
const CARD_LEFT = 64;    // where program cards begin
const GAP = 4;           // vertical gap between stacked cards

/** "HH:MM" -> minutes from 00:00 (00:00→0, 24:00→1440). */
function toMin(hm: string): number {
  if (!hm) return 0;
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/** Build a continuous 00:00 → 24:00 sequence of slots: real programs positioned
 * at their time, with "Radio H24" fillers covering every gap so the day is complete. */
function buildSlots(programs: any[]) {
  const timed = programs
    .filter((p) => p.active !== false && p.start_time && p.end_time)
    .map((p) => ({ ...p, _s: p.start_time, _e: p.end_time <= p.start_time ? "24:00" : p.end_time }))
    .sort((a, b) => a._s.localeCompare(b._s));
  const slots: any[] = [];
  let cursor = "00:00";
  for (const p of timed) {
    if (p._s > cursor) slots.push({ type: "h24", start: cursor, end: p._s, id: `h24-${cursor}` });
    if (p._e > cursor) {
      slots.push({ type: "program", start: p._s, end: p._e, data: p, id: p.id });
      cursor = p._e;
    }
  }
  if (cursor < "24:00") slots.push({ type: "h24", start: cursor, end: "24:00", id: `h24-${cursor}-end` });
  return slots;
}

function Avatars({ presenters, images, color }: { presenters: any[]; images: string[]; color?: string }) {
  const pics = (images && images.length ? images : (presenters || []).map((p) => p.image)).filter(Boolean);
  const accent = color || colors.brandPrimary;
  if (!pics.length) {
    return <View style={[styles.avatar, styles.avatarEmpty, { borderColor: accent }]}><Ionicons name="mic" size={20} color={accent} /></View>;
  }
  return (
    <View style={styles.avatarStack}>
      {pics.slice(0, 3).map((uri: string, i: number) => (
        <Image key={i} source={{ uri }} style={[styles.avatar, { marginLeft: i === 0 ? 0 : -14, borderColor: colors.surface, zIndex: 10 - i }]} contentFit="cover" />
      ))}
    </View>
  );
}

export default function Palinsesto() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(romeNow());
  const [day, setDay] = useState(DAYS[romeNow().idx]);
  const scrollRef = useRef<ScrollView>(null);
  const didScroll = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setNow(romeNow());
      api.programs().then((list: any[]) => setPrograms(list || [])).catch(() => {}).finally(() => setLoading(false));
      // Update the live cursor every minute so it tracks the real clock.
      const t = setInterval(() => setNow(romeNow()), 60000);
      return () => clearInterval(t);
    }, [])
  );

  const isToday = day === DAYS[now.idx];
  const dayPrograms = useMemo(() => programs.filter((p) => (p.weekdays || []).includes(day)), [programs, day]);
  const slots = useMemo(() => buildSlots(dayPrograms), [dayPrograms]);

  const nowMin = toMin(now.hm);
  const cursorTop = (nowMin / 60) * HOUR_H;

  // Index of the slot currently on air (only for today)
  const liveIdx = useMemo(() => {
    if (!isToday) return -1;
    return slots.findIndex((s) => s.start <= now.hm && now.hm < s.end);
  }, [slots, isToday, now.hm]);

  // Auto-scroll so the current-time cursor is visible when viewing today.
  const onContentReady = useCallback(() => {
    if (didScroll.current || !isToday || loading) return;
    didScroll.current = true;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, cursorTop - 220), animated: false });
    });
  }, [isToday, loading, cursorTop]);

  const hours = Array.from({ length: 25 }, (_, h) => h);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.h1}>Palinsesto</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={styles.chipsScroll}>
          {DAYS.map((d) => (
            <Pressable key={d} testID={`day-chip-${d}`} onPress={() => setDay(d)} style={[styles.chip, day === d && styles.chipActive]}>
              <Text style={[styles.chipText, day === d && styles.chipTextActive]}>{d.slice(0, 3)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View>
      ) : (
        <ScrollView
          ref={scrollRef}
          onContentSizeChange={onContentReady}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 180, maxWidth: isWide ? 720 : undefined, width: "100%", alignSelf: "center" }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.timeline, { height: DAY_H + 16 }]}>
            {/* Hour grid: labels + subtle lines every hour */}
            {hours.map((h) => (
              <View key={`hr-${h}`} style={[styles.hourRow, { top: h * HOUR_H }]} pointerEvents="none">
                <Text style={styles.hourLabel}>{`${String(h).padStart(2, "0")}:00`}</Text>
                <View style={styles.hourLine} />
              </View>
            ))}

            {/* Vertical spine */}
            <View style={styles.spine} />

            {/* Program / Radio H24 slots, positioned proportionally to their time */}
            {slots.map((s, i) => {
              const startMin = toMin(s.start);
              const endMin = toMin(s.end);
              const top = (startMin / 60) * HOUR_H;
              const h = Math.max(28, ((endMin - startMin) / 60) * HOUR_H - GAP);
              const compact = h < 92;
              const live = i === liveIdx;
              const isH24 = s.type !== "program";
              const p = s.data;
              const accent = isH24 ? colors.brandSecondary : (p.color || colors.brandPrimary);
              const liveShadow = live ? (Platform.select({ web: { boxShadow: `0 0 16px ${colors.error}55` } as any, default: { shadowColor: colors.error, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8 } }) as any) : null;

              return (
                <View key={s.id} testID={`slot-${s.id}`} style={[styles.slot, { top, height: h }]}>
                  <View style={[styles.card, isH24 && styles.h24Card, live && [styles.cardLive, { borderColor: colors.error }, liveShadow], !live && !isH24 && { borderColor: accent + "44" }]}>
                    {isH24 ? (
                      <View style={[styles.avatar, styles.h24Icon]}><Text style={{ fontSize: 20 }}>🎙️</Text></View>
                    ) : (
                      <Avatars presenters={p.presenters} images={p.images} color={p.color} />
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {live && (
                        <View style={[styles.liveBadge, { backgroundColor: colors.error }]}><Text style={styles.liveText}>🔴 ORA IN ONDA</Text></View>
                      )}
                      <Text style={styles.name} numberOfLines={1}>{isH24 ? "Radio H24" : p.title}</Text>
                      {!isH24 && !!p.host && !compact && (
                        <View style={styles.hostRow}><Ionicons name="mic-outline" size={13} color={accent} /><Text style={styles.host} numberOfLines={1}>{p.host}</Text></View>
                      )}
                      <Text style={styles.range}>{s.start} – {s.end}</Text>
                      {!compact && !!(isH24 ? H24_DESC : p.description) && (
                        <Text style={styles.desc} numberOfLines={h > 150 ? 3 : 2}>{isH24 ? H24_DESC : p.description}</Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Single real-time cursor — only for today. Slides along the 24h scale. */}
            {isToday && (
              <View style={[styles.cursor, { top: cursorTop }]} pointerEvents="none" testID="now-cursor">
                <View style={styles.cursorPill}><Text style={styles.cursorPillText}>{now.hm}</Text></View>
                <View style={styles.cursorDot} />
                <View style={styles.cursorLine} />
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const AV = 44;
const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  h1: { fontSize: 30, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.md },
  chipsScroll: { marginHorizontal: -spacing.lg },
  chipsRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: { height: 36, minWidth: 52, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.navy },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  timeline: { position: "relative" },
  spine: { position: "absolute", left: SPINE_X, top: 0, bottom: 0, width: 2, backgroundColor: colors.border, borderRadius: 1 },

  hourRow: { position: "absolute", left: 0, right: 0, height: 0, flexDirection: "row", alignItems: "center" },
  hourLabel: { position: "absolute", left: 0, top: -7, width: LABEL_W, textAlign: "right", color: colors.muted, fontSize: 11, fontWeight: "700" },
  hourLine: { position: "absolute", left: CARD_LEFT, right: 0, height: 1, backgroundColor: colors.border + "55" },

  slot: { position: "absolute", left: CARD_LEFT, right: 0, overflow: "hidden" },
  card: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.sm, borderWidth: 1, borderColor: "transparent", overflow: "hidden" },
  cardLive: { borderWidth: 2 },
  h24Card: { backgroundColor: colors.surfaceTertiary, borderColor: colors.border },
  h24Icon: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  avatar: { width: AV, height: AV, borderRadius: AV / 2, borderWidth: 2, backgroundColor: colors.navy },
  avatarEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  avatarStack: { flexDirection: "row", alignItems: "center" },

  liveBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, marginBottom: 3 },
  liveText: { color: colors.white, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  name: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  host: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600", flex: 1 },
  range: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: "600" },
  desc: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },

  // Real-time cursor
  cursor: { position: "absolute", left: 0, right: 0, height: 18, marginTop: -9, flexDirection: "row", alignItems: "center", zIndex: 50 },
  cursorPill: { width: LABEL_W, height: 18, borderRadius: 5, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  cursorPillText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  cursorDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.error, marginLeft: SPINE_X - LABEL_W - 6, borderWidth: 2, borderColor: colors.surface },
  cursorLine: { flex: 1, height: 2, backgroundColor: colors.error, marginLeft: 2 },
});

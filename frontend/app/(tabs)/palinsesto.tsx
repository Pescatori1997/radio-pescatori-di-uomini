import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions, Platform, Modal } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { DAYS, romeNow } from "@/src/utils/onair";
import { colors, spacing, radius } from "@/src/theme";

/** Vertical scale. Scheduled programs use a real proportional scale; the empty
 * gaps between them (e.g. long night hours) are heavily COMPRESSED so the day
 * fits with minimal scrolling while keeping the timeline look intact. */
const ACTIVE_PPM = 1.4;   // px per minute inside scheduled programs (~84px/hour)
const GAP_PPM = 0.14;     // px per minute inside empty gaps (compressed)
const GAP_MIN = 26;       // min height for any empty gap
const GAP_MAX = 62;       // cap so long empty gaps never waste space
const HOUR_LABEL_MIN_GAP = 30; // hide hour labels that would overlap (in gaps)
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

type Seg = { t0: number; t1: number; y0: number; y1: number; active: boolean };

function mergeIntervals(iv: [number, number][]): [number, number][] {
  const sorted = iv.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** Build a piecewise time→y scale: normal inside programs, compressed in gaps. */
function buildScale(covered: [number, number][]): { segs: Seg[]; total: number } {
  const segs: Seg[] = [];
  let t = 0, y = 0;
  const push = (t0: number, t1: number, active: boolean) => {
    if (t1 <= t0) return;
    const dur = t1 - t0;
    const hgt = active ? dur * ACTIVE_PPM : Math.min(GAP_MAX, Math.max(GAP_MIN, dur * GAP_PPM));
    segs.push({ t0, t1, y0: y, y1: y + hgt, active });
    y += hgt;
  };
  for (const [a, b] of covered) { push(t, a, false); push(a, b, true); t = b; }
  push(t, 1440, false);
  return { segs, total: y };
}

function yOf(segs: Seg[], min: number): number {
  for (const s of segs) {
    if (min <= s.t1) {
      const f = s.t1 > s.t0 ? (min - s.t0) / (s.t1 - s.t0) : 0;
      return s.y0 + f * (s.y1 - s.y0);
    }
  }
  return segs.length ? segs[segs.length - 1].y1 : 0;
}

/** Only real programs, positioned at their own time. Empty gaps stay empty
 * (no "Radio H24" filler cards): the timeline shows just the scheduled shows. */
function buildSlots(programs: any[]) {
  return programs
    .filter((p) => p.active !== false && p.start_time && p.end_time)
    .map((p) => ({ type: "program", start: p.start_time, end: p.end_time <= p.start_time ? "24:00" : p.end_time, data: p, id: p.id }))
    .sort((a, b) => a.start.localeCompare(b.start));
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
  const [selected, setSelected] = useState<any>(null);

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

  // Piecewise scale: proportional inside programs, compressed in empty gaps.
  const scale = useMemo(
    () => buildScale(mergeIntervals(slots.map((s) => [toMin(s.start), toMin(s.end)] as [number, number]))),
    [slots]
  );
  const yAt = useCallback((min: number) => yOf(scale.segs, min), [scale]);
  const TOTAL_H = scale.total;

  const nowMin = toMin(now.hm);
  const cursorTop = yAt(nowMin);

  // Hour labels placed through the compressed scale; skip those that would
  // overlap (i.e. multiple hours collapsed inside a compressed gap).
  const hourTicks = useMemo(() => {
    const ticks: { h: number; y: number }[] = [];
    let lastY = -999;
    for (let h = 0; h <= 24; h++) {
      const y = yAt(h * 60);
      if (y - lastY >= HOUR_LABEL_MIN_GAP) { ticks.push({ h, y }); lastY = y; }
    }
    return ticks;
  }, [yAt]);

  // Compressed empty gaps worth marking on the spine (>= 45 min).
  const gapMarks = useMemo(
    () => scale.segs.filter((s) => !s.active && s.t1 - s.t0 >= 45),
    [scale]
  );

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
          <View style={[styles.timeline, { height: TOTAL_H + 16 }]}>
            {/* Hour grid: labels + subtle lines (compressed scale) */}
            {hourTicks.map(({ h, y }) => (
              <View key={`hr-${h}`} style={[styles.hourRow, { top: y }]} pointerEvents="none">
                <Text style={styles.hourLabel}>{`${String(h).padStart(2, "0")}:00`}</Text>
                <View style={styles.hourLine} />
              </View>
            ))}

            {/* Vertical spine */}
            <View style={styles.spine} />

            {/* Compressed empty-gap markers (dashed) so skipped time reads clearly */}
            {gapMarks.map((s, i) => (
              <View key={`gap-${i}`} style={[styles.gapMark, { top: s.y0, height: s.y1 - s.y0 }]} pointerEvents="none">
                <View style={styles.gapDash} />
              </View>
            ))}

            {/* Program slots, positioned proportionally to their time */}
            {slots.map((s, i) => {
              const startMin = toMin(s.start);
              const endMin = toMin(s.end);
              const top = yAt(startMin);
              const h = Math.max(28, yAt(endMin) - yAt(startMin) - GAP);
              const compact = h < 92;
              const live = i === liveIdx;
              const p = s.data;
              const accent = p.color || colors.brandPrimary;
              const liveShadow = live ? (Platform.select({ web: { boxShadow: `0 0 16px ${colors.error}55` } as any, default: { shadowColor: colors.error, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8 } }) as any) : null;

              return (
                <View key={s.id} testID={`slot-${s.id}`} style={[styles.slot, { top, height: h }]}>
                  <Pressable style={[styles.card, live && [styles.cardLive, { borderColor: colors.error }, liveShadow], !live && { borderColor: accent + "44" }]} onPress={() => setSelected({ p, start: s.start, end: s.end, live })}>
                    <Avatars presenters={p.presenters} images={p.images} color={p.color} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {live && (
                        <View style={[styles.liveBadge, { backgroundColor: colors.error }]}><Text style={styles.liveText}>🔴 ORA IN ONDA</Text></View>
                      )}
                      <Text style={styles.name} numberOfLines={1}>{p.title}</Text>
                      {!!p.host && !compact && (
                        <View style={styles.hostRow}><Ionicons name="mic-outline" size={13} color={accent} /><Text style={styles.host} numberOfLines={1}>{p.host}</Text></View>
                      )}
                      <Text style={styles.range}>{s.start} – {s.end}</Text>
                      {!compact && !!p.description && (
                        <Text style={styles.desc} numberOfLines={h > 150 ? 3 : 2}>{p.description}</Text>
                      )}
                      {!compact && !!p.description && (
                        <Text style={styles.readMore}>Tocca per leggere di più</Text>
                      )}
                    </View>
                  </Pressable>
                </View>
              );
            })}

            {/* Single real-time cursor — only for today. Slides along the 24h scale.
             * When no program is on air, it shows the "Diretta Radio" live status. */}
            {isToday && (
              <View style={[styles.cursor, { top: cursorTop }]} pointerEvents="none" testID="now-cursor">
                <View style={styles.cursorPill}><Text style={styles.cursorPillText}>{now.hm}</Text></View>
                <View style={styles.cursorDot} />
                <View style={styles.cursorLine} />
                {liveIdx < 0 && (
                  <View style={styles.cursorLiveChip}><Text style={styles.cursorLiveText}>🔴 Diretta Radio</Text></View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Program detail modal — full title, presenters, time and complete description */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}>
                {selected.live && (
                  <View style={[styles.liveBadge, { backgroundColor: colors.error, marginBottom: spacing.sm }]}><Text style={styles.liveText}>🔴 ORA IN ONDA</Text></View>
                )}
                <View style={styles.sheetHeader}>
                  <Avatars presenters={selected.p.presenters} images={selected.p.images} color={selected.p.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle}>{selected.p.title}</Text>
                    <Text style={styles.sheetRange}>{selected.start} – {selected.end}</Text>
                  </View>
                </View>
                {!!selected.p.host && (
                  <View style={styles.sheetHostRow}>
                    <Ionicons name="mic" size={16} color={selected.p.color || colors.brandPrimary} />
                    <Text style={styles.sheetHost}>{selected.p.host}</Text>
                  </View>
                )}
                {!!selected.p.description ? (
                  <Text style={styles.sheetDesc}>{selected.p.description}</Text>
                ) : (
                  <Text style={styles.sheetNoDesc}>Nessuna descrizione disponibile per questo programma.</Text>
                )}
                <Pressable testID="program-close" style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeBtnText}>Chiudi</Text>
                </Pressable>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  gapMark: { position: "absolute", left: SPINE_X - 2, width: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  gapDash: { flex: 1, borderLeftWidth: 2, borderColor: colors.border, borderStyle: "dashed", opacity: 0.9 },

  hourRow: { position: "absolute", left: 0, right: 0, height: 0, flexDirection: "row", alignItems: "center" },
  hourLabel: { position: "absolute", left: 0, top: -7, width: LABEL_W, textAlign: "right", color: colors.muted, fontSize: 11, fontWeight: "700" },
  hourLine: { position: "absolute", left: CARD_LEFT, right: 0, height: 1, backgroundColor: colors.border + "55" },

  slot: { position: "absolute", left: CARD_LEFT, right: 0, overflow: "hidden" },
  card: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.sm, borderWidth: 1, borderColor: "transparent", overflow: "hidden" },
  cardLive: { borderWidth: 2 },
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
  readMore: { color: colors.brandPrimary, fontSize: 11, fontWeight: "700", marginTop: 3 },

  backdrop: { flex: 1, backgroundColor: "rgba(6,10,26,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: "80%" },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sheetRange: { color: colors.muted, fontSize: 14, fontWeight: "600", marginTop: 2 },
  sheetHostRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  sheetHost: { color: colors.onSurfaceSecondary, fontSize: 15, fontWeight: "700" },
  sheetDesc: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 23, marginTop: spacing.lg },
  sheetNoDesc: { color: colors.muted, fontSize: 14, fontStyle: "italic", marginTop: spacing.lg },
  closeBtn: { backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.xl },
  closeBtnText: { color: colors.white, fontSize: 16, fontWeight: "800" },

  // Real-time cursor
  cursor: { position: "absolute", left: 0, right: 0, height: 18, marginTop: -9, flexDirection: "row", alignItems: "center", zIndex: 50 },
  cursorPill: { width: LABEL_W, height: 18, borderRadius: 5, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  cursorPillText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  cursorDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.error, marginLeft: SPINE_X - LABEL_W - 6, borderWidth: 2, borderColor: colors.surface },
  cursorLine: { flex: 1, height: 2, backgroundColor: colors.error, marginLeft: 2 },
  cursorLiveChip: { position: "absolute", right: 0, top: -20, flexDirection: "row", alignItems: "center", backgroundColor: colors.error, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  cursorLiveText: { color: colors.white, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
});

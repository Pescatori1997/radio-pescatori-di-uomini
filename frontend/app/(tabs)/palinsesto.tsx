import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions, Platform, Modal } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { DAYS, romeNow } from "@/src/utils/onair";
import { colors, spacing, radius } from "@/src/theme";

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

            {/* Program slots, positioned proportionally to their time */}
            {slots.map((s, i) => {
              const startMin = toMin(s.start);
              const endMin = toMin(s.end);
              const top = (startMin / 60) * HOUR_H;
              const h = Math.max(28, ((endMin - startMin) / 60) * HOUR_H - GAP);
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

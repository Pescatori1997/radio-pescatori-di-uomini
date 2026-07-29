import React, { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions, LayoutAnimation, Platform, UIManager } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { DAYS, romeNow } from "@/src/utils/onair";
import { colors, spacing, radius } from "@/src/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const H24_DESC = "Musica cristiana, meditazioni, podcast e contenuti biblici in onda 24 ore su 24.";

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
    return <View style={[styles.avatar, styles.avatarEmpty, { borderColor: accent }]}><Ionicons name="mic" size={22} color={accent} /></View>;
  }
  return (
    <View style={styles.avatarStack}>
      {pics.slice(0, 3).map((uri: string, i: number) => (
        <Image key={i} source={{ uri }} style={[styles.avatar, { marginLeft: i === 0 ? 0 : -16, borderColor: colors.surface, zIndex: 10 - i }]} contentFit="cover" />
      ))}
    </View>
  );
}

function ExpandableDesc({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 120;
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setExpanded((e) => !e);
  };
  return (
    <View>
      <Text style={styles.desc} numberOfLines={expanded ? undefined : 3}>{text}</Text>
      {long && (
        <Pressable onPress={toggle} hitSlop={8}>
          <Text style={styles.readMore}>{expanded ? "Mostra meno" : "Leggi tutto"}</Text>
        </Pressable>
      )}
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

  useFocusEffect(
    useCallback(() => {
      setNow(romeNow());
      api.programs().then((list: any[]) => setPrograms(list || [])).catch(() => {}).finally(() => setLoading(false));
      const t = setInterval(() => setNow(romeNow()), 30000);
      return () => clearInterval(t);
    }, [])
  );

  const isToday = day === DAYS[now.idx];
  const dayPrograms = useMemo(() => programs.filter((p) => (p.weekdays || []).includes(day)), [programs, day]);
  const slots = useMemo(() => buildSlots(dayPrograms), [dayPrograms]);
  // Index of the slot currently on air (only for today)
  const liveIdx = useMemo(() => {
    if (!isToday) return -1;
    return slots.findIndex((s) => s.start <= now.hm && now.hm < s.end);
  }, [slots, isToday, now.hm]);

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
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 180, maxWidth: isWide ? 720 : undefined, width: "100%", alignSelf: "center" }} showsVerticalScrollIndicator={false}>
          <View style={styles.timeline}>
            <View style={styles.spine} />
            {slots.map((s, i) => {
              const live = i === liveIdx;
              const isH24 = s.type === "program" ? false : true;
              const p = s.data;
              const accent = isH24 ? colors.brandSecondary : (p.color || colors.brandPrimary);
              const cardLiveStyle = live ? [styles.cardLive, { borderColor: colors.error }, Platform.select({ web: { boxShadow: `0 0 16px ${colors.error}55` } as any, default: { shadowColor: colors.error, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8 } }) as any] : null;
              return (
                <View key={s.id} testID={`slot-${s.id}`} style={styles.item}>
                  <View style={styles.timeCol}>
                    <Text style={[styles.time, live && { color: colors.error }]}>{s.start}</Text>
                    <View style={[styles.node, { borderColor: live ? colors.error : accent }, live && styles.nodeLive, live && { backgroundColor: colors.error }]} />
                    {live && <View style={styles.nodeRing} />}
                  </View>

                  {isH24 ? (
                    <View style={[styles.card, styles.h24Card, cardLiveStyle]}>
                      <View style={[styles.avatar, styles.h24Icon]}><Text style={{ fontSize: 24 }}>🎙️</Text></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        {live && (
                          <View style={[styles.liveBadge, { backgroundColor: colors.error }]}><Text style={styles.liveText}>🔴 ORA IN ONDA</Text></View>
                        )}
                        <Text style={styles.name}>Radio H24</Text>
                        <Text style={styles.range}>{s.start} – {s.end}</Text>
                        <Text style={styles.desc}>{H24_DESC}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.card, live && cardLiveStyle, !live && { borderColor: accent + "44" }]}>
                      <Avatars presenters={p.presenters} images={p.images} color={p.color} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        {live && (
                          <View style={[styles.liveBadge, { backgroundColor: colors.error }]}><Text style={styles.liveText}>🔴 ORA IN ONDA</Text></View>
                        )}
                        <Text style={styles.name}>{p.title}</Text>
                        {!!p.host && (
                          <View style={styles.hostRow}><Ionicons name="mic-outline" size={13} color={accent} /><Text style={styles.host} numberOfLines={1}>{p.host}</Text></View>
                        )}
                        <Text style={styles.range}>{s.start} – {s.end}</Text>
                        {!!p.description && <ExpandableDesc text={p.description} />}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
            {/* end-of-day marker */}
            <View style={styles.item}>
              <View style={styles.timeCol}><Text style={styles.timeEnd}>24:00</Text><View style={[styles.node, { borderColor: colors.border }]} /></View>
              <View style={{ flex: 1, justifyContent: "center" }}><Text style={styles.endText}>Fine giornata</Text></View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const AV = 56;
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
  timeline: { position: "relative", paddingLeft: 4 },
  spine: { position: "absolute", left: 30, top: 12, bottom: 12, width: 2, backgroundColor: colors.border, borderRadius: 1 },
  item: { flexDirection: "row", marginBottom: spacing.lg },
  timeCol: { width: 58, alignItems: "center" },
  time: { color: colors.brandPrimary, fontSize: 14, fontWeight: "800" },
  timeEnd: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  node: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, backgroundColor: colors.surface, marginTop: 6 },
  nodeLive: { width: 16, height: 16, borderRadius: 8, marginTop: 4 },
  nodeRing: { position: "absolute", top: 0, width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.error + "55" },
  card: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: "transparent" },
  cardLive: { borderWidth: 2 },
  h24Card: { backgroundColor: colors.surfaceTertiary, borderColor: colors.border },
  h24Icon: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  avatar: { width: AV, height: AV, borderRadius: AV / 2, borderWidth: 2, backgroundColor: colors.navy },
  avatarEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  liveBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginBottom: 4 },
  liveText: { color: colors.white, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  name: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  host: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "600", flex: 1 },
  range: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: "600" },
  desc: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: spacing.sm, lineHeight: 18 },
  readMore: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800", marginTop: 6 },
  endText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
});

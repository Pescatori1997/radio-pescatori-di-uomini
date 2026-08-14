import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, mediaUrl } from "@/src/api";
import { DAYS, romeNow, romeDay, isOnAir } from "@/src/utils/onair";
import { colors, spacing, radius } from "@/src/theme";

const ACCENT = colors.brandPrimary;
const LIVE = colors.error;

function toMin(hm: string): number {
  if (!hm) return 0;
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function dayChipLabel(offset: number): string {
  if (offset === 0) return "Oggi";
  if (offset === 1) return "Domani";
  const d = new Date(Date.now() + offset * 86400000);
  let wd = DAYS[(d.getDay() + 6) % 7];
  try {
    wd = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long" }).format(d);
    wd = wd.charAt(0).toUpperCase() + wd.slice(1);
  } catch {}
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${wd} ${dd}/${mm}`;
}

export default function Palinsesto() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(romeNow());
  const [offset, setOffset] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setNow(romeNow());
      api.programs().then((l: any[]) => setPrograms(l || [])).catch(() => {}).finally(() => setLoading(false));
      const t = setInterval(() => setNow(romeNow()), 30000);
      return () => clearInterval(t);
    }, [])
  );

  const dayInfo = useMemo(() => romeDay(offset), [offset]);
  const isToday = offset === 0;

  const dayPrograms = useMemo(() => {
    return (programs || [])
      .filter((p) => p.active !== false && p.start_time && (p.weekdays || []).includes(dayInfo.weekday))
      .slice()
      .sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
  }, [programs, dayInfo.weekday]);

  const days = Array.from({ length: 14 }, (_, i) => i);
  const hours = Array.from({ length: 24 }, (_, h) => h); // full 24h timeline

  const renderCard = (p: any) => {
    const live = isToday && isOnAir(p);
    const startMin = toMin(p.start_time);
    const endMin = p.end_time && p.end_time <= p.start_time ? toMin(p.end_time) + 1440 : toMin(p.end_time || p.start_time);
    const nowMin = toMin(now.hm);
    const pct = live && endMin > startMin ? Math.min(1, Math.max(0, (nowMin - startMin) / (endMin - startMin))) : 0;
    const img = p.images && p.images[0] ? mediaUrl(p.images[0]) : null;
    return (
      <Pressable key={p.id} testID={`prog-${p.id}`} onPress={() => router.push(`/programma/${p.slug || p.id}` as any)} style={[styles.card, live && styles.cardLive]}>
        <View style={styles.thumbWrap}>
          {img ? <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="mic" size={24} color={ACCENT} /></View>}
        </View>
        <View style={{ flex: 1 }}>
          {live && <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>IN ONDA</Text></View>}
          <Text style={styles.cardTime}>{p.start_time}{p.end_time ? ` – ${p.end_time}` : ""}</Text>
          <Text style={styles.title} numberOfLines={2}>{p.title}</Text>
          {!!p.host && <Text style={styles.host} numberOfLines={1}>con {p.host}</Text>}
          {!!p.subtitle && <Text style={styles.subtitle} numberOfLines={1}>{p.subtitle}</Text>}
          {live && <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${pct * 100}%` }]} /></View>}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} style={{ alignSelf: "center" }} />
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 6 }}>
        <Text style={styles.kicker}>PALINSESTO</Text>
        <Text style={styles.date}>{dayInfo.dateLabel}</Text>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}>
          {days.map((o) => {
            const active = o === offset;
            return (
              <Pressable key={o} testID={`day-chip-${o}`} onPress={() => setOffset(o)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{dayChipLabel(o)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={ACCENT} size="large" /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 120, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
          {dayPrograms.length === 0 && (
            <View style={styles.emptyBanner}>
              <Ionicons name="radio-outline" size={18} color={colors.muted} />
              <Text style={styles.emptyText}>Nessun programma in griglia oggi · Radio H24 in diretta</Text>
            </View>
          )}
          {hours.map((h) => {
            const inHour = dayPrograms.filter((p) => Math.floor(toMin(p.start_time) / 60) === h);
            const nowHour = isToday && Math.floor(toMin(now.hm) / 60) === h;
            return (
              <View key={h} style={styles.hourRow}>
                <View style={styles.spineCol}>
                  <View style={styles.lineTop} />
                  <View style={[styles.hourPill, nowHour && styles.hourPillNow]}>
                    <Text style={[styles.hourText, nowHour && { color: colors.white }]}>{String(h).padStart(2, "0")}:00</Text>
                  </View>
                  <View style={styles.lineBottom} />
                </View>
                <View style={styles.hourContent}>
                  {inHour.length === 0 ? <View style={styles.emptySlot} /> : inHour.map(renderCard)}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { color: ACCENT, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  date: { color: colors.onSurface, fontSize: 22, fontWeight: "900", marginTop: 2 },
  chip: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  chipTextActive: { color: colors.white },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: "600", flex: 1 },

  hourRow: { flexDirection: "row", minHeight: 60 },
  spineCol: { width: 66, alignItems: "center" },
  lineTop: { width: 2, height: 16, backgroundColor: colors.border },
  lineBottom: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2 },
  hourPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  hourPillNow: { backgroundColor: ACCENT, borderColor: ACCENT },
  hourText: { color: colors.muted, fontSize: 12.5, fontWeight: "800" },
  hourContent: { flex: 1, paddingBottom: 8 },
  emptySlot: { height: 44 },

  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 10, marginBottom: 10, marginTop: 6, borderWidth: 1, borderColor: colors.border },
  cardLive: { borderColor: LIVE, borderWidth: 1.5, backgroundColor: LIVE + "0D" },
  thumbWrap: { width: 60, height: 60, borderRadius: 12, overflow: "hidden" },
  thumb: { width: 60, height: 60 },
  thumbEmpty: { backgroundColor: ACCENT + "14", alignItems: "center", justifyContent: "center" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: LIVE, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginBottom: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
  liveText: { color: colors.white, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.5 },
  cardTime: { color: ACCENT, fontSize: 12, fontWeight: "800" },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", lineHeight: 20, marginTop: 1 },
  host: { color: colors.muted, fontSize: 13, marginTop: 3 },
  subtitle: { color: colors.onSurface, fontSize: 12.5, marginTop: 2, opacity: 0.8 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 8, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: LIVE },
});

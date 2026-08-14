import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, mediaUrl } from "@/src/api";
import { DAYS, romeNow, romeDay, isOnAir } from "@/src/utils/onair";

const DARK = "#05070D";
const CARD = "#12151C";
const GREEN = "#34D399";
const WHITE = "#FFFFFF";
const GREY = "#9098A6";

function toMin(hm: string): number {
  if (!hm) return 0;
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/** Short chip label: Oggi / Domani / "Domenica 16/08". */
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
  const { width } = useWindowDimensions();
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

  return (
    <View style={{ flex: 1, backgroundColor: DARK }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 6 }}>
        <Text style={styles.kicker}>PALINSESTO</Text>
        <Text style={styles.date}>{dayInfo.dateLabel}</Text>
      </View>

      {/* Day selector */}
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
        <View style={styles.center}><ActivityIndicator color={GREEN} size="large" /></View>
      ) : dayPrograms.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="radio-outline" size={30} color={GREY} />
          <Text style={styles.empty}>Nessun programma in griglia per questo giorno.</Text>
          <Text style={styles.emptySub}>Radio H24 sempre in diretta.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 120, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {dayPrograms.map((p, i) => {
            const live = isToday && isOnAir(p);
            const startMin = toMin(p.start_time);
            const endMin = p.end_time && p.end_time <= p.start_time ? toMin(p.end_time) + 1440 : toMin(p.end_time || p.start_time);
            const nowMin = toMin(now.hm);
            const pct = live && endMin > startMin ? Math.min(1, Math.max(0, (nowMin - startMin) / (endMin - startMin))) : 0;
            const img = (p.images && p.images[0]) ? mediaUrl(p.images[0]) : null;
            const last = i === dayPrograms.length - 1;
            return (
              <View key={p.id} style={styles.row}>
                {/* timeline spine */}
                <View style={styles.spineCol}>
                  {i > 0 && <View style={[styles.line, { top: 0, height: 30 }]} />}
                  <View style={[styles.pill, live && styles.pillLive]}>
                    <Text style={[styles.pillText, live && { color: DARK }]}>{p.start_time}</Text>
                  </View>
                  {!last && <View style={[styles.line, { top: 54, bottom: 0 }]} />}
                </View>

                {/* program card */}
                <Pressable
                  testID={`prog-${p.id}`}
                  onPress={() => router.push(`/programma/${p.slug || p.id}` as any)}
                  style={[styles.card, live && styles.cardLive]}
                >
                  <View style={styles.thumbWrap}>
                    {img ? (
                      <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" />
                    ) : (
                      <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="mic" size={26} color={GREEN} /></View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    {live && (
                      <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>IN ONDA</Text></View>
                    )}
                    <Text style={styles.title} numberOfLines={2}>{p.title}</Text>
                    {!!p.host && <Text style={styles.host} numberOfLines={1}>con {p.host}</Text>}
                    {!!p.subtitle && <Text style={styles.subtitle} numberOfLines={1}>{p.subtitle}</Text>}
                    {live && (
                      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${pct * 100}%` }]} /></View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={GREY} style={{ alignSelf: "center" }} />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { color: GREEN, fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  date: { color: WHITE, fontSize: 22, fontWeight: "900", marginTop: 2 },
  chip: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: "#2A2F3A", backgroundColor: "transparent" },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { color: WHITE, fontSize: 14, fontWeight: "800" },
  chipTextActive: { color: DARK },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, padding: 40 },
  empty: { color: WHITE, fontSize: 15, fontWeight: "700", marginTop: 6 },
  emptySub: { color: GREY, fontSize: 13 },

  row: { flexDirection: "row", minHeight: 96 },
  spineCol: { width: 74, alignItems: "center" },
  line: { position: "absolute", width: 2, backgroundColor: "#2A2F3A", left: 36 },
  pill: { marginTop: 20, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: GREEN + "66", backgroundColor: DARK, zIndex: 2 },
  pillLive: { backgroundColor: GREEN, borderColor: GREEN },
  pillText: { color: GREEN, fontSize: 13, fontWeight: "900" },

  card: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: CARD, borderRadius: 16, padding: 10, marginBottom: 16, marginTop: 8, borderWidth: 1, borderColor: "#1C212B" },
  cardLive: { borderColor: GREEN, borderWidth: 1.5, backgroundColor: "#0E1A16" },
  thumbWrap: { width: 64, height: 64, borderRadius: 12, overflow: "hidden" },
  thumb: { width: 64, height: 64 },
  thumbEmpty: { backgroundColor: "#0C1F18", alignItems: "center", justifyContent: "center" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: GREEN, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginBottom: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DARK },
  liveText: { color: DARK, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.5 },
  title: { color: WHITE, fontSize: 16, fontWeight: "800", lineHeight: 20 },
  host: { color: GREY, fontSize: 13, marginTop: 3 },
  subtitle: { color: WHITE, fontSize: 12.5, marginTop: 2, opacity: 0.85 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: "#243027", marginTop: 8, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: GREEN },
});

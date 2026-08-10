import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "@/src/api";
import { usePlayer } from "@/src/context/PlayerContext";
import { useAuth } from "@/src/context/AuthContext";
import LivePlayer from "@/src/components/live/LivePlayer";
import PressableScale from "@/src/components/PressableScale";
import { getEmbedHost, liveIsEmbeddable, LivePlayerConfig } from "@/src/livePlayer";
import { configuredPlatforms } from "@/src/livePlatforms";
import { goBackOrHome } from "@/src/utils/nav";
import { colors, spacing, radius } from "@/src/theme";

function formatNext(iso?: string): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "long" });
  const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return { date: date.charAt(0).toUpperCase() + date.slice(1), time };
}

export default function LiveHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { liveInfo } = usePlayer();
  const { user } = useAuth();
  const [reminded, setReminded] = useState(false);
  const [remindBusy, setRemindBusy] = useState(false);

  const cfg: LivePlayerConfig = liveInfo?.live_player || {};
  const isLive = !!liveInfo?.live_mode;
  const host = useMemo(() => getEmbedHost(), []);
  const platforms = configuredPlatforms(liveInfo?.live_links);
  const next = formatNext(cfg.next_at);

  const openExternal = (url: string) => Linking.openURL(url).catch(() => {});

  const remindMe = async () => {
    if (!user) { router.push("/login?mode=register"); return; }
    setRemindBusy(true);
    try {
      const prefs = await api.getNotifPrefs();
      await api.updateNotifPrefs({ ...prefs, live: true });
      setReminded(true);
    } catch { /* ignore */ }
    finally { setRemindBusy(false); }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0A1B3A", "#0A1128"]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 140, paddingHorizontal: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable testID="live-back" onPress={goBackOrHome} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="chevron-down" size={26} color={colors.white} />
          </Pressable>
          <Text style={styles.topLabel}>LIVE HUB</Text>
          <View style={{ width: 40 }} />
        </View>

        {isLive ? (
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>SIAMO IN DIRETTA</Text>
            </View>
            <Text style={styles.brand}>PESCATORI DI UOMINI</Text>
            {!!cfg.title && <Text style={styles.title}>{cfg.title}</Text>}
            {!!cfg.subtitle && <Text style={styles.subtitle}>{cfg.subtitle}</Text>}

            <View style={styles.playerWrap}>
              <LivePlayer config={cfg} host={host} />
            </View>

            <Text style={styles.caption}>🎣 Pescatori di Uomini — LIVE</Text>

            {/* Single "watch on platform" (from live_player.external_url) */}
            {!!cfg.external_url && (
              <PressableScale testID="live-external" style={styles.watchBtn} onPress={() => openExternal(cfg.external_url!)}>
                <Ionicons name="play-circle" size={20} color={colors.navy} />
                <Text style={styles.watchBtnText}>{cfg.external_label || "Guarda sulla piattaforma"}</Text>
              </PressableScale>
            )}

            {/* Per-platform external buttons (from the existing live_links) */}
            {platforms.length > 0 && (
              <View style={styles.platRow}>
                {platforms.map((p) => (
                  <PressableScale key={p.key} testID={`live-platform-${p.key}`} style={styles.platBtn} onPress={() => openExternal(p.url)}>
                    <View style={[styles.platIcon, { backgroundColor: p.color === "#000000" ? "#111827" : p.color }]}>
                      <Ionicons name={p.icon as any} size={18} color={colors.white} />
                    </View>
                    <Text style={styles.platLabel} numberOfLines={1}>Guarda su {p.label}</Text>
                    <Ionicons name="open-outline" size={16} color={colors.muted} />
                  </PressableScale>
                ))}
              </View>
            )}

            {!liveIsEmbeddable(cfg) && (
              <Text style={styles.hintMuted}>Il player incorporato non è configurato: usa i pulsanti qui sopra per guardare la diretta.</Text>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.offlineWrap}>
            <Text style={styles.offlineEmoji}>🎣</Text>
            <Text style={styles.brand}>PESCATORI DI UOMINI</Text>
            <Text style={styles.offlineMsg}>Al momento non siamo in diretta.</Text>

            {next && (
              <View style={styles.nextCard}>
                {cfg.next_cover ? (
                  <Image source={{ uri: cfg.next_cover }} style={styles.nextCover} contentFit="cover" />
                ) : (
                  <View style={[styles.nextCover, styles.nextCoverEmpty]}><Ionicons name="calendar" size={26} color={colors.brandSecondary} /></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextKicker}>PROSSIMA DIRETTA</Text>
                  <Text style={styles.nextTitle} numberOfLines={2}>{cfg.next_title || "Diretta in programma"}</Text>
                  <Text style={styles.nextWhen}>{next.date} · {next.time}</Text>
                </View>
              </View>
            )}

            <PressableScale
              testID="live-remind"
              style={[styles.remindBtn, reminded && styles.remindBtnDone]}
              onPress={remindMe}
              disabled={remindBusy || reminded}
            >
              <Ionicons name={reminded ? "notifications" : "notifications-outline"} size={20} color={reminded ? colors.success : colors.navy} />
              <Text style={[styles.remindText, reminded && { color: colors.success }]}>
                {reminded ? "Ti avviseremo prima della diretta" : "🔔 Ricordamelo"}
              </Text>
            </PressableScale>

            {platforms.length > 0 && (
              <View style={styles.platRow}>
                {platforms.map((p) => (
                  <PressableScale key={p.key} testID={`live-platform-${p.key}`} style={styles.platBtn} onPress={() => openExternal(p.url)}>
                    <View style={[styles.platIcon, { backgroundColor: p.color === "#000000" ? "#111827" : p.color }]}>
                      <Ionicons name={p.icon as any} size={18} color={colors.white} />
                    </View>
                    <Text style={styles.platLabel} numberOfLines={1}>Seguici su {p.label}</Text>
                    <Ionicons name="open-outline" size={16} color={colors.muted} />
                  </PressableScale>
                ))}
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  topLabel: { color: colors.brandSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },

  liveBadge: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: colors.error, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.white },
  liveBadgeText: { color: colors.white, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  brand: { color: colors.white, fontSize: 22, fontWeight: "900", letterSpacing: 0.5, marginTop: spacing.md },
  title: { color: colors.white, fontSize: 18, fontWeight: "800", marginTop: spacing.sm },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4, lineHeight: 20 },

  playerWrap: { marginTop: spacing.lg },
  caption: { color: colors.brandSecondary, fontSize: 14, fontWeight: "700", textAlign: "center", marginTop: spacing.lg },

  watchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.white, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.lg },
  watchBtnText: { color: colors.navy, fontSize: 15, fontWeight: "800" },

  platRow: { marginTop: spacing.md, gap: spacing.sm },
  platBtn: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.12)" },
  platIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  platLabel: { flex: 1, color: colors.white, fontSize: 15, fontWeight: "700" },
  hintMuted: { color: colors.muted, fontSize: 12.5, textAlign: "center", marginTop: spacing.md, lineHeight: 18 },

  offlineWrap: { alignItems: "center", marginTop: spacing["2xl"] },
  offlineEmoji: { fontSize: 52 },
  offlineMsg: { color: colors.muted, fontSize: 15, marginTop: spacing.sm, textAlign: "center" },
  nextCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)", marginTop: spacing.xl, alignSelf: "stretch" },
  nextCover: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.navy },
  nextCoverEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  nextKicker: { color: colors.brandSecondary, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8 },
  nextTitle: { color: colors.white, fontSize: 16, fontWeight: "800", marginTop: 3 },
  nextWhen: { color: colors.brandTertiary, fontSize: 13, fontWeight: "600", marginTop: 3 },
  remindBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.white, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.xl, alignSelf: "stretch" },
  remindBtnDone: { backgroundColor: "rgba(16,185,129,0.15)", borderWidth: 1, borderColor: colors.success },
  remindText: { color: colors.navy, fontSize: 15, fontWeight: "800" },
});

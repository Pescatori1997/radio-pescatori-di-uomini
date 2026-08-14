import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Share, Linking } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, mediaUrl, audioSrc } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius } from "@/src/theme";

const ACCENT = colors.brandPrimary;
const LIVE = colors.error;
const TEXT = colors.onSurface;

function imgUri(v?: string): string | null {
  if (!v) return null;
  if (/^https?:\/\//i.test(v) || v.startsWith("/api/") || v.startsWith("data:")) return v;
  return mediaUrl(v);
}

function fmtDate(s: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ProgramDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"episodes" | "info">("episodes");
  const [fav, setFav] = useState(false);

  useEffect(() => {
    api.programBySlug(String(slug)).then(setP).catch(() => setP(null)).finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!user || !p) return;
    api.favoriteProgramIds().then((ids: string[]) => setFav(ids.includes(p.id))).catch(() => {});
  }, [user, p]);

  const shareUrl = `https://evangelic-stream.emergent.host/programma/${slug}`;
  const doShare = useCallback(async () => {
    try { await Share.share({ message: `${p?.title} · Pescatori di Uomini\n${shareUrl}`, url: shareUrl }); } catch {}
  }, [p, shareUrl]);
  const toggleFav = useCallback(async () => {
    if (!user) { router.push("/login" as any); return; }
    setFav((v) => !v);
    try { const r = await api.toggleFavoriteProgram(p.id); setFav(r.favorited); } catch { setFav((v) => !v); }
  }, [user, p, router]);
  const contact = useCallback(() => {
    const c = p?.contact_url || "";
    if (c) Linking.openURL(c.includes("@") && !c.startsWith("mailto") ? `mailto:${c}` : c).catch(() => {});
    else router.push("/contact" as any);
  }, [p, router]);
  const playEpisode = useCallback((ep: any) => { if (ep?.audio_url) Linking.openURL(audioSrc(ep.audio_url)).catch(() => {}); }, []);

  if (loading) return <View style={[styles.screen, styles.center]}><ActivityIndicator color={ACCENT} size="large" /></View>;
  if (!p) return (
    <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
      <Text style={{ color: TEXT }}>Programma non trovato.</Text>
      <Pressable onPress={() => router.back()} style={styles.backChip}><Text style={{ color: ACCENT, fontWeight: "800" }}>Indietro</Text></Pressable>
    </View>
  );

  const hero = imgUri(p.hero_image) || imgUri(p.images?.[0]);
  const episodes = p.episodes || [];
  const presenters = (p.presenters || []).filter((x: any) => x && (x.name || x.image));
  const lastEp = episodes[0];
  const scheduleLabel = `${(p.weekdays || []).join(", ")}${p.start_time ? ` · ore ${p.start_time}` : ""}`;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 130 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {hero ? <Image source={{ uri: hero }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <LinearGradient colors={[ACCENT, colors.navy]} style={StyleSheet.absoluteFill} />}
          <LinearGradient colors={["rgba(10,17,40,0.15)", "rgba(10,17,40,0.55)", "rgba(10,17,40,0.9)"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroTop, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}><Ionicons name="chevron-back" size={24} color="#fff" /></Pressable>
            <Pressable onPress={doShare} hitSlop={10} style={styles.iconBtn}><Ionicons name="share-social-outline" size={22} color="#fff" /></Pressable>
          </View>
          <View style={styles.heroText}>
            {!!p.category && <Text style={styles.cat}>{String(p.category).toUpperCase()}</Text>}
            <Text style={styles.hTitle}>{p.title}</Text>
            {!!p.host && <Text style={styles.hHost}>con {p.host}</Text>}
            {!!scheduleLabel.trim() && <Text style={styles.hSched}>{scheduleLabel}</Text>}
          </View>
        </View>

        {lastEp ? (
          <Pressable style={styles.playBtn} onPress={() => playEpisode(lastEp)}>
            <Ionicons name="play-circle" size={30} color="#fff" />
            <Text style={styles.playText}>AVVIA ULTIMA PUNTATA</Text>
          </Pressable>
        ) : (
          <View style={[styles.playBtn, styles.playBtnOff]}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.muted} />
            <Text style={[styles.playText, { color: colors.muted }]}>Nessuna puntata disponibile</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable style={styles.action} onPress={contact}>
            <View style={styles.actionCircle}><Ionicons name="mail-outline" size={20} color={TEXT} /></View>
            <Text style={styles.actionLabel}>Contattaci</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={toggleFav}>
            <View style={[styles.actionCircle, fav && { backgroundColor: ACCENT, borderColor: ACCENT }]}><Ionicons name={fav ? "heart" : "heart-outline"} size={20} color={fav ? "#fff" : TEXT} /></View>
            <Text style={styles.actionLabel}>{fav ? "Nei Preferiti" : "Aggiungi ai Preferiti"}</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={doShare}>
            <View style={styles.actionCircle}><Ionicons name="link-outline" size={20} color={TEXT} /></View>
            <Text style={styles.actionLabel}>Condividi</Text>
          </Pressable>
        </View>

        {presenters.length > 0 && (
          <View style={styles.presentersWrap}>
            <Text style={styles.presentersTitle}>{presenters.length > 1 ? "Conduttori" : "Conduttore"}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presentersRow}>
              {presenters.map((pr: any, i: number) => {
                const pi = imgUri(pr.image);
                return (
                  <View key={`${pr.name || i}`} style={styles.presenter}>
                    {pi ? (
                      <Image source={{ uri: pi }} style={styles.presenterImg} contentFit="cover" />
                    ) : (
                      <View style={[styles.presenterImg, styles.presenterImgEmpty]}>
                        <Ionicons name="person" size={28} color={ACCENT} />
                      </View>
                    )}
                    {!!pr.name && <Text style={styles.presenterName} numberOfLines={2}>{pr.name}</Text>}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, tab === "episodes" && styles.tabActive]} onPress={() => setTab("episodes")}>
            <Text style={[styles.tabText, tab === "episodes" && styles.tabTextActive]}>Le puntate</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === "info" && styles.tabActive]} onPress={() => setTab("info")}>
            <Text style={[styles.tabText, tab === "info" && styles.tabTextActive]}>Informazioni</Text>
          </Pressable>
        </View>

        {tab === "episodes" ? (
          <View style={{ paddingHorizontal: 16 }}>
            {episodes.length === 0 ? (
              <Text style={styles.infoMuted}>Ancora nessuna puntata pubblicata.</Text>
            ) : episodes.map((ep: any) => (
              <View key={ep.id || ep.title} style={styles.epRow}>
                <Pressable onPress={() => playEpisode(ep)} hitSlop={8}>
                  <Ionicons name="play-circle" size={34} color={ep.audio_url ? ACCENT : colors.muted} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.epTitle} numberOfLines={2}>{ep.title}</Text>
                  <Text style={styles.epMeta}>{fmtDate(ep.date)}{ep.duration_min ? `   ◷ ${ep.duration_min} min` : ""}</Text>
                  {!!ep.description && <Text style={styles.epDesc} numberOfLines={2}>{ep.description}</Text>}
                </View>
                <Pressable hitSlop={8} onPress={() => Share.share({ message: `${ep.title} · ${p.title}\n${shareUrl}` }).catch(() => {})}>
                  <Ionicons name="share-social-outline" size={20} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {!!p.long_description && <Text style={styles.infoText}>{p.long_description}</Text>}
            <View style={styles.metaBlock}>
              {!!p.host && <InfoLine icon="mic-outline" label="Conduttore" value={p.host} />}
              {(p.weekdays || []).length > 0 && <InfoLine icon="calendar-outline" label="Giorni" value={p.weekdays.join(", ")} />}
              {!!p.start_time && <InfoLine icon="time-outline" label="Orario" value={`${p.start_time}${p.end_time ? ` – ${p.end_time}` : ""}`} />}
              {!!p.category && <InfoLine icon="pricetag-outline" label="Categoria" value={p.category} />}
            </View>
            {p.social && Object.values(p.social).some(Boolean) && (
              <View style={styles.socialRow}>
                {Object.entries(p.social).filter(([, v]) => !!v).map(([k, v]) => (
                  <Pressable key={k} style={styles.socialBtn} onPress={() => Linking.openURL(String(v)).catch(() => {})}>
                    <Ionicons name={(k.includes("face") ? "logo-facebook" : k.includes("insta") ? "logo-instagram" : k.includes("you") ? "logo-youtube" : "globe-outline") as any} size={18} color={ACCENT} />
                    <Text style={styles.socialText}>{k}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoLine({ icon, label, value }: any) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={16} color={ACCENT} />
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoVal} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  backChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: ACCENT },
  hero: { height: 400, justifyContent: "flex-end" },
  heroTop: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  heroText: { padding: 20 },
  cat: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1.5, marginBottom: 4, opacity: 0.95 },
  hTitle: { color: "#fff", fontSize: 30, fontWeight: "900", lineHeight: 34 },
  hHost: { color: "#fff", fontSize: 16, opacity: 0.92, marginTop: 6 },
  hSched: { color: "#fff", fontSize: 14, marginTop: 4, opacity: 0.8 },
  playBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 20, marginTop: 16, paddingVertical: 14, borderRadius: 999, backgroundColor: ACCENT },
  playBtnOff: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  playText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
  actions: { flexDirection: "row", justifyContent: "space-around", marginTop: 20, paddingHorizontal: 20 },
  action: { alignItems: "center", gap: 6, flex: 1 },
  actionCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  actionLabel: { color: colors.muted, fontSize: 11.5, fontWeight: "700", textAlign: "center" },
  tabs: { flexDirection: "row", margin: 20, backgroundColor: colors.surfaceSecondary, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: colors.border },
  presentersWrap: { marginTop: 22, paddingLeft: 16 },
  presentersTitle: { color: TEXT, fontSize: 17, fontWeight: "900", marginBottom: 12 },
  presentersRow: { gap: 16, paddingRight: 16 },
  presenter: { alignItems: "center", width: 84 },
  presenterImg: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.surfaceSecondary, borderWidth: 2, borderColor: colors.border },
  presenterImgEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: ACCENT + "14", borderColor: ACCENT + "33" },
  presenterName: { color: TEXT, fontSize: 12.5, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 15 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  tabActive: { backgroundColor: ACCENT },
  tabText: { color: TEXT, fontSize: 14, fontWeight: "800" },
  tabTextActive: { color: "#fff" },
  epRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  epTitle: { color: TEXT, fontSize: 15, fontWeight: "800" },
  epMeta: { color: colors.muted, fontSize: 12.5, marginTop: 3 },
  epDesc: { color: colors.muted, fontSize: 12.5, marginTop: 3 },
  infoText: { color: TEXT, fontSize: 15, lineHeight: 23, marginBottom: 16 },
  infoMuted: { color: colors.muted, fontSize: 14, paddingVertical: 20, textAlign: "center" },
  metaBlock: { gap: 10, marginBottom: 16 },
  infoLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabel: { color: colors.muted, fontSize: 13.5, fontWeight: "700" },
  infoVal: { color: TEXT, fontSize: 13.5, flex: 1 },
  socialRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  socialBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  socialText: { color: TEXT, fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
});

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Share, Linking, Platform } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, mediaUrl, audioSrc } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";

const DARK = "#05070D";
const CARD = "#12151C";
const GREEN = "#34D399";
const WHITE = "#FFFFFF";
const GREY = "#9098A6";

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
    if (c) { Linking.openURL(c.includes("@") && !c.startsWith("mailto") ? `mailto:${c}` : c).catch(() => {}); }
    else router.push("/contact" as any);
  }, [p, router]);

  const playEpisode = useCallback((ep: any) => {
    const url = ep?.audio_url;
    if (url) Linking.openURL(audioSrc(url)).catch(() => {});
  }, []);

  if (loading) return <View style={[styles.screen, styles.center]}><ActivityIndicator color={GREEN} size="large" /></View>;
  if (!p) return (
    <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
      <Text style={{ color: WHITE }}>Programma non trovato.</Text>
      <Pressable onPress={() => router.back()} style={styles.backChip}><Text style={{ color: GREEN, fontWeight: "800" }}>Indietro</Text></Pressable>
    </View>
  );

  const hero = p.hero_image ? mediaUrl(p.hero_image) : (p.images?.[0] ? mediaUrl(p.images[0]) : null);
  const episodes = p.episodes || [];
  const lastEp = episodes[0];
  const scheduleLabel = `${(p.weekdays || []).join(", ")}${p.start_time ? ` · ore ${p.start_time}` : ""}`;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 130 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          {hero ? <Image source={{ uri: hero }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0C1F18" }]} />}
          <LinearGradient colors={["rgba(5,7,13,0.2)", "rgba(5,7,13,0.5)", DARK]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroTop, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}><Ionicons name="chevron-back" size={24} color={WHITE} /></Pressable>
            <Pressable onPress={doShare} hitSlop={10} style={styles.iconBtn}><Ionicons name="share-social-outline" size={22} color={WHITE} /></Pressable>
          </View>
          <View style={styles.heroText}>
            {!!p.category && <Text style={styles.cat}>{String(p.category).toUpperCase()}</Text>}
            <Text style={styles.hTitle}>{p.title}</Text>
            {!!p.host && <Text style={styles.hHost}>con {p.host}</Text>}
            {!!scheduleLabel.trim() && <Text style={styles.hSched}>{scheduleLabel}</Text>}
          </View>
        </View>

        {/* Play last episode */}
        {lastEp ? (
          <Pressable style={styles.playBtn} onPress={() => playEpisode(lastEp)}>
            <Ionicons name="play-circle" size={30} color={DARK} />
            <Text style={styles.playText}>AVVIA ULTIMA PUNTATA</Text>
          </Pressable>
        ) : (
          <View style={[styles.playBtn, styles.playBtnOff]}>
            <Ionicons name="alert-circle-outline" size={22} color={GREY} />
            <Text style={[styles.playText, { color: GREY }]}>Nessuna puntata disponibile</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.action} onPress={contact}>
            <View style={styles.actionCircle}><Ionicons name="mail-outline" size={20} color={WHITE} /></View>
            <Text style={styles.actionLabel}>Contattaci</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={toggleFav}>
            <View style={[styles.actionCircle, fav && { backgroundColor: GREEN }]}><Ionicons name={fav ? "heart" : "heart-outline"} size={20} color={fav ? DARK : WHITE} /></View>
            <Text style={styles.actionLabel}>{fav ? "Nei Preferiti" : "Aggiungi ai Preferiti"}</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={doShare}>
            <View style={styles.actionCircle}><Ionicons name="link-outline" size={20} color={WHITE} /></View>
            <Text style={styles.actionLabel}>Condividi</Text>
          </Pressable>
        </View>

        {/* Tabs */}
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
                <Pressable onPress={() => playEpisode(ep)} hitSlop={8} style={styles.epPlay}>
                  <Ionicons name="play-circle-outline" size={30} color={ep.audio_url ? GREEN : GREY} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.epTitle} numberOfLines={2}>{ep.title}</Text>
                  <Text style={styles.epMeta}>{fmtDate(ep.date)}{ep.duration_min ? `   ◷ ${ep.duration_min} min` : ""}</Text>
                  {!!ep.description && <Text style={styles.epDesc} numberOfLines={2}>{ep.description}</Text>}
                </View>
                <Pressable hitSlop={8} onPress={() => Share.share({ message: `${ep.title} · ${p.title}\n${shareUrl}` }).catch(() => {})}>
                  <Ionicons name="share-social-outline" size={20} color={GREY} />
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
                    <Ionicons name={(k.includes("face") ? "logo-facebook" : k.includes("insta") ? "logo-instagram" : k.includes("you") ? "logo-youtube" : "globe-outline") as any} size={18} color={GREEN} />
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
      <Ionicons name={icon} size={16} color={GREEN} />
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoVal} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DARK },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  backChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: GREEN },
  hero: { height: 420, justifyContent: "flex-end" },
  heroTop: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  heroText: { padding: 20 },
  cat: { color: GREEN, fontSize: 12, fontWeight: "900", letterSpacing: 1.5, marginBottom: 4 },
  hTitle: { color: WHITE, fontSize: 32, fontWeight: "900", lineHeight: 36 },
  hHost: { color: WHITE, fontSize: 16, opacity: 0.9, marginTop: 6 },
  hSched: { color: GREY, fontSize: 14, marginTop: 4 },
  playBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 20, marginTop: 4, paddingVertical: 14, borderRadius: 999, backgroundColor: GREEN, borderWidth: 2, borderColor: GREEN },
  playBtnOff: { backgroundColor: "transparent", borderColor: "#2A2F3A" },
  playText: { color: DARK, fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
  actions: { flexDirection: "row", justifyContent: "space-around", marginTop: 20, paddingHorizontal: 20 },
  action: { alignItems: "center", gap: 6, flex: 1 },
  actionCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: CARD, borderWidth: 1, borderColor: "#242A35", alignItems: "center", justifyContent: "center" },
  actionLabel: { color: GREY, fontSize: 11.5, fontWeight: "700", textAlign: "center" },
  tabs: { flexDirection: "row", margin: 20, backgroundColor: CARD, borderRadius: 999, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  tabActive: { backgroundColor: WHITE },
  tabText: { color: WHITE, fontSize: 14, fontWeight: "800" },
  tabTextActive: { color: DARK },
  epRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1C212B" },
  epPlay: {},
  epTitle: { color: WHITE, fontSize: 15, fontWeight: "800" },
  epMeta: { color: GREY, fontSize: 12.5, marginTop: 3 },
  epDesc: { color: GREY, fontSize: 12.5, marginTop: 3, opacity: 0.9 },
  infoText: { color: "#D5DAE2", fontSize: 15, lineHeight: 23, marginBottom: 16 },
  infoMuted: { color: GREY, fontSize: 14, paddingVertical: 20, textAlign: "center" },
  metaBlock: { gap: 10, marginBottom: 16 },
  infoLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabel: { color: GREY, fontSize: 13.5, fontWeight: "700" },
  infoVal: { color: WHITE, fontSize: 13.5, flex: 1 },
  socialRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  socialBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: CARD, borderWidth: 1, borderColor: "#242A35" },
  socialText: { color: WHITE, fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
});

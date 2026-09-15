import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { colors, spacing, radius } from "@/src/theme";

export type SpotifyEpisode = {
  title: string;
  description: string;
  published: string;
  duration: string;
  image: string | null;
  author: string;
  audio_url: string;
};

const STORE_KEY = "pdu.spotify.source";

/**
 * Admin helper: reads the podcast's public RSS feed (resolved from a Spotify show
 * URL or a direct feed URL) and lets the admin pick an episode. On select it
 * returns the episode with the DIRECT .mp3 URL, so the native PdU player can play
 * it — Spotify stays only the external source, never the site's player UI.
 */
export default function SpotifyImportModal({
  visible, onClose, onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (ep: SpotifyEpisode) => void;
}) {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [episodes, setEpisodes] = useState<SpotifyEpisode[]>([]);

  useEffect(() => {
    if (visible) AsyncStorage.getItem(STORE_KEY).then((v) => { if (v) setUrl(v); }).catch(() => {});
  }, [visible]);

  const loadEpisodes = async () => {
    const src = url.trim();
    if (!src) { setError("Incolla il link dello show Spotify o il feed RSS."); return; }
    setLoading(true); setError(""); setEpisodes([]);
    try {
      const r = await api.spotifyEpisodes(src);
      setTitle(r.podcast_title || "");
      setEpisodes(r.episodes || []);
      AsyncStorage.setItem(STORE_KEY, src).catch(() => {});
      if (!r.episodes?.length) setError("Nessun episodio trovato.");
    } catch (e: any) {
      setError(e?.message || "Errore durante il caricamento.");
    } finally {
      setLoading(false);
    }
  };

  const pick = (ep: SpotifyEpisode) => { onSelect(ep); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.header}>
          <PressableScale testID="spotify-import-close" onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={colors.white} />
          </PressableScale>
          <Text style={styles.headerTitle}>Importa da Spotify</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>
            Incolla il link del tuo show Spotify (open.spotify.com/show/...) oppure il feed RSS.
            Verranno mostrati gli episodi: scegline uno e i campi si compileranno da soli con il link audio diretto.
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              testID="spotify-import-url"
              value={url}
              onChangeText={setUrl}
              placeholder="https://open.spotify.com/show/..."
              placeholderTextColor={ADMIN.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
          <PressableScale testID="spotify-import-load" style={[styles.loadBtn, loading && { opacity: 0.6 }]} onPress={loadEpisodes} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="cloud-download-outline" size={18} color={colors.white} /><Text style={styles.loadText}>Carica episodi</Text></>}
          </PressableScale>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {title ? <Text style={styles.podcastTitle}>{title} · {episodes.length} episodi</Text> : null}

          {episodes.map((ep, i) => (
            <PressableScale key={`${ep.audio_url}-${i}`} testID={`spotify-ep-${i}`} style={styles.row} onPress={() => pick(ep)}>
              {ep.image ? <Image source={{ uri: ep.image }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="musical-notes" size={20} color={ADMIN.muted} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.epTitle} numberOfLines={2}>{ep.title}</Text>
                <Text style={styles.epMeta} numberOfLines={1}>{[ep.published, ep.duration].filter(Boolean).join(" · ")}</Text>
              </View>
              <Ionicons name="add-circle" size={26} color={colors.brandPrimary} />
            </PressableScale>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ADMIN.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: ADMIN.card, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.white, fontSize: 18, fontWeight: "800" },
  hint: { color: ADMIN.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  inputRow: { marginBottom: spacing.sm },
  input: { backgroundColor: ADMIN.card, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border, color: colors.white, fontSize: 15, paddingHorizontal: spacing.md, height: 46 },
  loadBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary, paddingVertical: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  loadText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  error: { color: colors.error, fontSize: 14, marginBottom: spacing.md },
  podcastTitle: { color: colors.white, fontSize: 15, fontWeight: "800", marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: ADMIN.surface },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  epTitle: { color: colors.white, fontSize: 14, fontWeight: "700" },
  epMeta: { color: ADMIN.muted, fontSize: 12, marginTop: 3 },
});

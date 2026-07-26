import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { uploadMediaChunked } from "@/src/api";
import { AInput } from "@/src/components/adminForm";
import { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import { alertMessage } from "@/src/utils/confirm";
import { detectProvider, PROVIDER_LABEL } from "@/src/utils/embeds";
import { colors, spacing, radius } from "@/src/theme";

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB
const TYPE_ICON: Record<string, any> = { video: "video", audio: "music", pdf: "file-pdf-box", image: "image" };

function fmtBytes(n?: number) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export type MediaValue = {
  media_id?: string | null;
  media_type?: string | null;
  media_mime?: string | null;
  media_filename?: string | null;
  video_url?: string;
  thumbnail?: string | null;
  duration?: string;
};

/**
 * Reusable "Carica file | URL esterno" media picker used by every CMS section.
 * Chunked upload with progress %, size, ETA, cancel & retry. Emits a MediaValue.
 */
export default function MediaUpload({
  value, onChange, accept = ["video/*", "audio/*", "image/*", "application/pdf"],
}: {
  value: MediaValue;
  onChange: (v: MediaValue) => void;
  accept?: string[];
}) {
  const [source, setSource] = useState<"upload" | "link">(value.media_id ? "upload" : "link");
  const [pct, setPct] = useState<number | null>(null);
  const [uploaded, setUploaded] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const controlRef = useRef<{ cancelled?: boolean }>({});
  const lastFileRef = useRef<{ uri: string; name: string; mime: string } | null>(null);

  const doUpload = async (file: { uri: string; name: string; mime: string }, size?: number) => {
    controlRef.current = { cancelled: false };
    lastFileRef.current = file;
    setTotalSize(size || 0);
    setStartedAt(Date.now());
    setPct(0);
    try {
      const info = await uploadMediaChunked(file, (p) => { setPct(p); setUploaded((size || 0) * p); }, controlRef.current);
      onChange({
        ...value,
        media_id: info.media_id, media_type: info.media_type, media_mime: info.media_mime,
        media_filename: info.media_filename, video_url: "",
        thumbnail: value.thumbnail || info.thumbnail || null,
        duration: value.duration || info.duration || "",
      });
      setPct(null);
    } catch (e: any) {
      setPct(null);
      if (e?.message !== "Caricamento annullato") alertMessage("Errore di caricamento", e?.message || "Riprova.");
    }
  };

  const pick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: accept, copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (a.size && a.size > MAX_BYTES) { alertMessage("File troppo grande", "La dimensione massima è 1 GB."); return; }
      await doUpload({ uri: a.uri, name: a.name || "file", mime: a.mimeType || "application/octet-stream" }, a.size || 0);
    } catch (e: any) {
      alertMessage("Errore", e?.message || "Selezione non riuscita.");
    }
  };

  const cancel = () => { controlRef.current.cancelled = true; setPct(null); };
  const retry = () => { if (lastFileRef.current) doUpload(lastFileRef.current, totalSize); };
  const clearMedia = () => onChange({ ...value, media_id: null, media_type: null, media_mime: null, media_filename: null });

  const eta = () => {
    if (!pct || pct <= 0.02 || !totalSize) return "";
    const elapsed = (Date.now() - startedAt) / 1000;
    const remaining = elapsed / pct - elapsed;
    return remaining > 1 ? ` · ~${Math.ceil(remaining)}s` : "";
  };
  const provider = source === "link" ? detectProvider(value.video_url || "") : null;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={styles.segment}>
        <Pressable testID="mu-upload" onPress={() => setSource("upload")} style={[styles.seg, source === "upload" && styles.segActive]}>
          <Ionicons name="cloud-upload-outline" size={16} color={source === "upload" ? colors.white : ADMIN.muted} />
          <Text style={[styles.segText, source === "upload" && styles.segTextActive]}>Carica file</Text>
        </Pressable>
        <Pressable testID="mu-link" onPress={() => setSource("link")} style={[styles.seg, source === "link" && styles.segActive]}>
          <Ionicons name="link-outline" size={16} color={source === "link" ? colors.white : ADMIN.muted} />
          <Text style={[styles.segText, source === "link" && styles.segTextActive]}>URL esterno</Text>
        </Pressable>
      </View>

      {source === "upload" ? (
        <View>
          {value.media_id ? (
            <View style={styles.card}>
              <MaterialCommunityIcons name={TYPE_ICON[value.media_type || ""] || "file"} size={26} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{value.media_filename || "File caricato"}</Text>
                <Text style={styles.meta}>{(value.media_type || "").toUpperCase()}{value.duration ? ` · ${value.duration}` : ""}</Text>
              </View>
              <Pressable testID="mu-remove" onPress={clearMedia} hitSlop={8}><Ionicons name="close-circle" size={22} color={ADMIN.muted} /></Pressable>
            </View>
          ) : null}

          {pct !== null ? (
            <View style={styles.progressWrap}>
              <View style={styles.bar}><View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} /></View>
              <View style={styles.progressRow}>
                <Text style={styles.progressText}>{Math.round(pct * 100)}%{totalSize ? ` · ${fmtBytes(uploaded)}/${fmtBytes(totalSize)}` : ""}{eta()}</Text>
                <Pressable testID="mu-cancel" onPress={cancel}><Text style={styles.cancel}>Annulla</Text></Pressable>
              </View>
            </View>
          ) : (
            <PressableScale testID="mu-pick" style={styles.pickBtn} onPress={pick}>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.white} />
              <Text style={styles.pickText}>{value.media_id ? "Sostituisci file" : "Scegli audio, video, immagine o PDF"}</Text>
            </PressableScale>
          )}
          {pct === null && lastFileRef.current && !value.media_id && (
            <Pressable testID="mu-retry" onPress={retry} style={styles.retryRow}><Ionicons name="refresh" size={14} color={colors.brandPrimary} /><Text style={styles.retryText}>Riprova upload</Text></Pressable>
          )}
          <Text style={styles.hint}>Max 1 GB. Le immagini vengono ottimizzate e convertite in WebP automaticamente.</Text>
        </View>
      ) : (
        <View>
          <AInput testID="mu-url" label="" value={value.video_url || ""} onChangeText={(v: string) => onChange({ ...value, video_url: v, media_id: null })} placeholder="Incolla un link (YouTube, Vimeo, ecc.) o l'URL di un file" />
          {!!provider && <View style={styles.badge}><Ionicons name="checkmark-circle" size={14} color={colors.success} /><Text style={styles.badgeText}>Rilevato: {PROVIDER_LABEL[provider]}</Text></View>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  seg: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 11, borderRadius: radius.md, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  segActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  segText: { color: ADMIN.muted, fontSize: 14, fontWeight: "700" },
  segTextActive: { color: colors.white },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border, marginBottom: spacing.sm },
  name: { color: colors.white, fontSize: 14, fontWeight: "700" },
  meta: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  pickBtn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy, paddingVertical: spacing.md, borderRadius: radius.md },
  pickText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  progressWrap: { marginVertical: spacing.sm },
  bar: { height: 8, borderRadius: 4, backgroundColor: ADMIN.card, overflow: "hidden" },
  fill: { height: 8, backgroundColor: colors.brandPrimary },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  progressText: { color: ADMIN.muted, fontSize: 12 },
  cancel: { color: colors.error, fontSize: 13, fontWeight: "700" },
  retryRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: spacing.sm },
  retryText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "700" },
  hint: { color: ADMIN.muted, fontSize: 12, lineHeight: 17, marginTop: spacing.xs },
  badge: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: -spacing.xs, marginBottom: spacing.sm },
  badgeText: { color: colors.success, fontSize: 13, fontWeight: "700" },
});
